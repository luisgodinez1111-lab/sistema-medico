import{NextResponse}from"next/server";
import{handleAllergyCreate}from"../../../../lib/allergy-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{classifyAllergen,type AllergenType}from"../../../../../../packages/drug-catalog/src";
import{allergyRegistry}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAllergyCreate(req);}

// EPIC R/UI — GET /api/v1/allergies -> registro de alergias de toda la clínica (vista Alergias).
// Cada alergia con paciente, tipo derivado (classifyAllergen), gravedad, reacción y estado, MÁS conteos
// agregados por gravedad (grave/moderada/leve/incierta) y por tipo (para KPIs y gráficas). RLS-scoped.
const SEV_ES:Record<string,string>={SEVERE:"Grave",MODERATE:"Moderada",MILD:"Leve"};
const STATUS_ES:Record<string,string>={ACTIVE:"Activa",REFUTED:"Refutada",INACTIVE:"Inactiva"};
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"allergy:read",purpose:"TREATMENT"});
  const rows=await allergyRegistry(ctx);
  const items=rows.map(r=>{const type=classifyAllergen(r.substance);return{
   allergyId:r.allergyId,patientId:r.patientId,patientName:r.patientName,
   substance:r.substance,type,reaction:r.reaction,
   severity:r.severity,severityLabel:SEV_ES[r.severity]??"Leve",
   status:r.status,statusLabel:STATUS_ES[r.status]??"Activa",
   recordedAt:r.recordedAt,registeredBy:r.registeredBy};});
  const total=items.length;
  const bySeverity={grave:0,moderada:0,leve:0,incierta:0};
  const byType:Record<AllergenType,number>={Medicamento:0,Alimento:0,Ambiental:0,Contraste:0,Otros:0};
  const patients=new Set<string>();
  for(const it of items){
   if(it.severity==="SEVERE")bySeverity.grave++;else if(it.severity==="MODERATE")bySeverity.moderada++;else bySeverity.leve++;
   byType[it.type]++;patients.add(it.patientId);
  }
  return NextResponse.json({items,total,patientsWithAllergies:patients.size,bySeverity,byType,activeCount:items.filter(i=>i.status==="ACTIVE").length},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
