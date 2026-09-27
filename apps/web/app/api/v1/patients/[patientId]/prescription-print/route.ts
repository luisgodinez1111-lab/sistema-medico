import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{resolveDrug}from"../../../../../../../../packages/drug-catalog/src";
import{foldMedication}from"../../../../../../../../packages/medication-fold/src";
import{ageInYears}from"../../../../../../../../packages/prescription-safety/src";
import{checkPrescriptionLegal,describeMissing,renderPrescriptionHtml,type PrescriptionData,type PrescriptionItem}from"../../../../../../../../packages/prescription-print/src";
import{patientDemographics,officeSettings,readAggregateStream}from"../../../../../../lib/clinical-runtime";
import{requirePhysicianCredentials}from"../../../../../../lib/physician-profile-lifecycle";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// Auditoría 2026-09-19 (U-20, L-05) — GET /api/v1/patients/:id/prescription-print?medications=<id>[,<id>…]
// Receta imprimible con los requisitos legales mexicanos (RIS arts. 28–31; LGS arts. 83, 226, 241; NOM-004-SSA3-2012).
// Es una LECTURA: no crea eventos; reimprimir no altera el expediente. Reglas:
//  · solo un MÉDICO con cédula registrada emite la receta (428 PHYSICIAN_CREDENTIALS_REQUIRED si falta el perfil);
//  · solo medicaciones PRESCRITAS o ACTIVAS del paciente indicado y prescritas por el MISMO médico que la emite (la receta
//    lleva su cédula y su firma autógrafa: nadie firma la prescripción de otro; se re-prescribe si hace falta);
//  · si falta un dato legal (domicilio o teléfono del consultorio, duración del tratamiento…) responde 400 VALIDATION_ERROR con `missing` y DICE qué falta:
//    no se imprime una receta incompleta con huecos para rellenar a mano.
// Devuelve JSON {folio, issuedAt, html}: la UI abre el HTML en una ventana e invoca la impresión; el PDF lo genera el navegador.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS=12;
const str=(x:unknown):string|undefined=>typeof x==="string"&&x.trim()!==""?x.trim():undefined;
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const ids=[...new Set((new URL(req.url).searchParams.get("medications")??"").split(",").map(s=>s.trim()).filter(Boolean))];
  if(ids.length===0||ids.length>MAX_ITEMS||ids.some(id=>!UUID.test(id)))throw new ClinicalError("VALIDATION_ERROR",`medications: entre 1 y ${MAX_ITEMS} identificadores UUID separados por coma`);
  const cred=await requirePhysicianCredentials(tctx,claims);
  const[demo,office]=await Promise.all([patientDemographics(tctx,patientId),officeSettings(tctx)]);
  if(!demo)throw new ClinicalError("NOT_FOUND","Patient not registered");
  const issuedAt=new Date().toISOString();
  const items:PrescriptionItem[]=[];
  for(const medicationId of ids){
   const events=await readAggregateStream(tctx,"Medication",medicationId);
   const folded=foldMedication(events);
   if(!folded.exists||folded.patientId!==patientId)throw new ClinicalError("NOT_FOUND",`Medication ${medicationId} not found for this patient`);
   if(folded.state!=="PRESCRIBED"&&folded.state!=="ACTIVE")throw new ClinicalError("CONFLICT",`La medicación ${medicationId} está ${folded.state}: solo se imprimen medicaciones prescritas o activas`,{state:folded.state});
   const proposed=events.find(e=>e.payload["kind"]==="PROPOSED")?.payload??{};
   const prescribed=[...events].reverse().find(e=>e.payload["kind"]==="PRESCRIBED")?.payload??{};
   if(String(prescribed["prescriberId"]??"")!==claims.sub)throw new ClinicalError("FORBIDDEN","Solo el médico que prescribió puede emitir la receta de esta medicación",{medicationId});
   const drug=resolveDrug(folded.drugCode);
   const override=(prescribed["safety"] as{override?:{barriers?:string[]}}|undefined)?.override;
   const item:PrescriptionItem={medicationId,genericName:drug?.ingredient??folded.drugCode,drugCode:folded.drugCode,classes:drug?.classes??[],
    dose:folded.dose,route:folded.route,frequency:folded.frequency,
    ...(str(proposed["duration"])?{duration:str(proposed["duration"])!}:{}),
    ...(str(proposed["indication"])?{indication:`${str(proposed["indication"])!}${drug?"":" · Fármaco fuera del catálogo: verifique que la denominación sea la genérica"}`}:drug?{}:{indication:"Fármaco fuera del catálogo: verifique que la denominación sea la genérica"}),
    ...(override?.barriers?.length?{override:{barriers:override.barriers}}:{})};
   items.push(item);
  }
  const s=office.settings as Record<string,unknown>;
  const age=demo.birthDate?ageInYears(demo.birthDate,issuedAt):undefined;
  const folio=crypto.createHash("sha256").update(`${claims.tenantId}:${patientId}:${ids.slice().sort().join(",")}:${issuedAt.slice(0,10)}`).digest("hex").slice(0,10).toUpperCase();
  const data:PrescriptionData={folio,issuedAt,
   prescriber:{fullName:cred.fullName,cedulaProfesional:cred.cedulaProfesional,institution:cred.institution,...(cred.specialty?{specialty:cred.specialty}:{}),...(cred.cedulaEspecialidad?{cedulaEspecialidad:cred.cedulaEspecialidad}:{})},
   establishment:{name:str(s["officeName"])??"",address:str(s["address"])??"",phone:str(s["phone"])??""},
   patient:{name:demo.name??"",...(age!==undefined?{ageYears:age}:{}),...(demo.sexAtBirth?{sexAtBirth:demo.sexAtBirth}:{})},
   items};
  const legal=checkPrescriptionLegal(data);
  if(!legal.ok)throw new ClinicalError("VALIDATION_ERROR",`La receta no cumple los requisitos legales; falta: ${describeMissing(legal.missing).join("; ")}`,{missing:legal.missing});
  return NextResponse.json({patientId,folio,issuedAt,items:items.map(i=>({medicationId:i.medicationId,genericName:i.genericName})),html:renderPrescriptionHtml(data)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
