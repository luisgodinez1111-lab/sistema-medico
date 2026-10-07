import{NextResponse}from"next/server";
import{handleAllergyCreate}from"../../../../lib/allergy-lifecycle";
import{classifyAllergen,type AllergenType}from"../../../../../../packages/drug-catalog/src";
import{allergyRegistry,registrySummary,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAllergyCreate(req);}

// EPIC R/UI — GET /api/v1/allergies -> registro de alergias de toda la clínica (vista Alergias).
// Cada alergia con paciente, tipo derivado (classifyAllergen), gravedad, reacción y estado, MÁS conteos
// agregados por gravedad (grave/moderada/leve/incierta) y por tipo (para KPIs y gráficas). RLS-scoped.
const SEV_ES:Record<string,string>={SEVERE:"Grave",MODERATE:"Moderada",MILD:"Leve"};
const STATUS_ES:Record<string,string>={ACTIVE:"Activa",REFUTED:"Refutada",INACTIVE:"Inactiva"};
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"allergy:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  // R06-20: lista acotada por página; los indicadores, contados en la base.
  const url=new URL(req.url);
  const page=await allergyRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>{const type=classifyAllergen(r.substance);return{
   allergyId:r.allergyId,patientId:r.patientId,patientName:r.patientName,
   substance:r.substance,type,reaction:r.reaction,
   severity:r.severity,severityLabel:SEV_ES[r.severity]??"Leve",
   status:r.status,statusLabel:STATUS_ES[r.status]??"Activa",
   recordedAt:r.recordedAt,registeredBy:r.registeredBy};});
  // Dos agrupaciones del mismo registro: por GRAVEDAD (campo del payload) y por SUSTANCIA. El TIPO de alérgeno no se
  // puede agrupar en SQL porque lo decide `classifyAllergen`, una regla del dominio; se clasifica cada sustancia DISTINTA
  // —unas pocas docenas— y se suman sus recuentos. Exacto, y sin traer una fila por alergia.
  const[porGravedad,porSustancia]=await Promise.all([
   registrySummary(ctx,{aggregateType:"Allergy",baseKind:"RECORDED",groupField:"severity"}),
   registrySummary(ctx,{aggregateType:"Allergy",baseKind:"RECORDED",groupField:"substance"}),
  ]);
  const total=porGravedad.total;
  // Misma regla que la lista: SEVERE es grave, MODERATE es moderada y TODO lo demás cuenta como leve (incluida una
  // gravedad ausente o desconocida), así que `leve` es el resto y los tres suman siempre el total.
  const grave=porGravedad.byGroup["SEVERE"]??0,moderada=porGravedad.byGroup["MODERATE"]??0;
  const bySeverity={grave,moderada,leve:porGravedad.total-grave-moderada,incierta:0};
  const byType:Record<AllergenType,number>={Medicamento:0,Alimento:0,Ambiental:0,Contraste:0,Otros:0};
  for(const[sustancia,n]of Object.entries(porSustancia.byGroup))byType[classifyAllergen(sustancia)]+=Number(n);
  const activeCount=(porGravedad.byStatus["RECORDED"]??0)+(porGravedad.byStatus["REACTIVATED"]??0);
  return NextResponse.json({items,nextCursor:page.nextCursor,total,patientsWithAllergies:porGravedad.patients,bySeverity,byType,activeCount},{status:200});
 });
}
