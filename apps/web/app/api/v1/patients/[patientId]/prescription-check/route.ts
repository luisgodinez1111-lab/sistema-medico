import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{resolveDrug,checkDrugAllergy,checkInteractions,checkContraindications,checkRenalDosing,monitoringFor}from"../../../../../../../../packages/drug-catalog/src";
import{checkDoseCeiling,validateMedicationOrder}from"../../../../../../../../packages/medication-validation/src";
import{activeAllergySubstances,activeMedicationDrugCodes,activeProblemCodes,patientEgfr}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CG — POST /api/v1/patients/:id/prescription-check  (panel 3: "Prescripción segura y verificación")
// DRY-RUN de las barreras de seguridad SIN escribir: alergia, interacción, duplicado terapéutico,
// contraindicación por dx, dosis-techo, y ajuste renal por eGFR + monitorización. Núcleo determinista.
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Status="OK"|"WARN"|"BLOCK";
// Normaliza a la clave del catálogo: NFD descompone acentos; se elimina todo lo que no sea [a-z0-9 -].
const norm=(s:string)=>s.normalize("NFD").replace(/[^a-z0-9 -]/gi,"").toLowerCase().trim();

export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const body=await req.json().catch(()=>({}));
  const drugInput=String(body.drug??"").trim();
  const dose=String(body.dose??"").trim(),route=String(body.route??"").trim(),frequency=String(body.frequency??"").trim();
  const code=norm(drugInput);
  const resolved=resolveDrug(code)??null;
  const[substances,activeMeds,conditions,egfrRaw]=await Promise.all([
   activeAllergySubstances(tctx,patientId),
   activeMedicationDrugCodes(tctx,patientId),
   activeProblemCodes(tctx,patientId),
   patientEgfr(tctx,patientId),
  ]);
  const egfr=typeof egfrRaw==="number"&&Number.isFinite(egfrRaw)?egfrRaw:null;
  const checks:{id:string;label:string;status:Status;detail:string}[]=[];

  // Formato de la orden (dosis · vía · frecuencia)
  const order=validateMedicationOrder({dose,route,frequency});
  checks.push({id:"order",label:"Orden válida (dosis · vía · frecuencia)",status:order.ok?"OK":"BLOCK",detail:order.ok?"Formato correcto":order.errors.join("; ")});

  if(!resolved){
   checks.push({id:"catalog",label:"Fármaco en catálogo",status:"WARN",detail:`"${drugInput}" no está en el catálogo de demostración; verificación de seguridad limitada.`});
   const verdict:Status=order.ok?"WARN":"BLOCK";
   return NextResponse.json({patientId,drug:{input:drugInput,resolved:null},egfr,order,checks,monitoring:[],indications:instr(dose,route,frequency),verdict},{status:200});
  }

  // 1) Alergia (incl. reactividad cruzada beta-lactámicos)
  const al=checkDrugAllergy(code,substances);
  checks.push({id:"allergy",label:"Sin conflicto de alergia",status:al.blocked?"BLOCK":"OK",detail:al.blocked?`Alergia a ${al.allergen} (por ${al.via==="class"?"clase":"principio activo"})`:"Sin alergias en conflicto"});
  // 2) Interacción farmacológica
  const ix=checkInteractions(code,activeMeds);
  checks.push({id:"interaction",label:"Sin interacciones críticas",status:ix.found?(ix.severity==="MAJOR"?"BLOCK":"WARN"):"OK",detail:ix.found?`${ix.note} (con ${ix.conflictDrug})`:"Sin interacciones detectadas"});
  // 3) Duplicado terapéutico (misma clase que un fármaco activo)
  let dup:{cls:string;drug:string}|null=null;
  for(const c of activeMeds){const r2=resolveDrug(norm(c));if(r2&&norm(c)!==code){const shared=r2.classes.find(x=>resolved.classes.includes(x));if(shared){dup={cls:shared,drug:r2.ingredient};break;}}}
  checks.push({id:"duplicate",label:"Sin duplicados terapéuticos",status:dup?"WARN":"OK",detail:dup?`Duplica clase ${dup.cls} (ya activo: ${dup.drug})`:"Sin duplicados de clase"});
  // 4) Contraindicación por diagnóstico
  const ci=checkContraindications(code,conditions);
  checks.push({id:"contraindication",label:"Sin contraindicaciones por diagnóstico",status:ci.found?(ci.severity==="MAJOR"?"BLOCK":"WARN"):"OK",detail:ci.found?`${ci.note} (${ci.condition})`:"Sin contraindicaciones"});
  // 5) Dosis-techo (mg/día)
  const dc=checkDoseCeiling(resolved.ingredient,dose,frequency);
  checks.push({id:"dose",label:"Dosis dentro del máximo",status:dc.exceeded?"BLOCK":"OK",detail:dc.checked?(dc.exceeded?`${dc.computedMgPerDay} mg/día excede el máximo ${dc.maxMgPerDay} mg/día`:`${dc.computedMgPerDay??"—"} mg/día · dentro del máximo`):"Sin regla de dosis-techo para este fármaco"});
  // 6) Ajuste renal por eGFR
  if(egfr!==null){const rn=checkRenalDosing(code,egfr);checks.push({id:"renal",label:"Ajuste renal verificado (eGFR)",status:rn.action==="BLOCK"?"BLOCK":rn.action==="CAUTION"?"WARN":"OK",detail:`${rn.note??"Sin ajuste renal requerido"} (eGFR ${egfr})`});}
  else checks.push({id:"renal",label:"Ajuste renal verificado (eGFR)",status:"WARN",detail:"Sin eGFR disponible para verificar el ajuste renal"});

  const monitoring=monitoringFor(code).map(m=>({test:m.test,note:m.note,dueInDays:m.dueInDays}));
  const verdict:Status=checks.some(c=>c.status==="BLOCK")?"BLOCK":checks.some(c=>c.status==="WARN")?"WARN":"OK";
  return NextResponse.json({patientId,drug:{input:drugInput,resolved},egfr,order,checks,monitoring,indications:instr(dose,route,frequency),verdict},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
function instr(dose:string,route:string,frequency:string):string{
 const parts=[dose&&`Tomar ${dose}`,route&&`por vía ${route.toLowerCase()}`,frequency&&`${frequency}`].filter(Boolean);
 return parts.length?parts.join(" ")+".":"";
}
