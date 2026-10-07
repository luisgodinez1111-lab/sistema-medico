import{NextResponse}from"next/server";
import{handleResultReceived}from"../../../../lib/result-lifecycle";
import{resultsRegistry,resultsSummary,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
// EPIC G — POST /api/v1/results  (recibir un resultado diagnóstico -> RECEIVED)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleResultReceived(req);}

// EPIC AQ/UI — GET /api/v1/results -> registro de resultados de toda la clínica (vista Resultados).
// Cada resultado con paciente, analito/valor, estado-UI derivado (Hallazgos/Normal/En seguimiento/En revisión),
// tipo (Laboratorio/Imagenología) e interpretación determinista; MÁS KPIs (totales / con hallazgos / en
// seguimiento / pendientes de revisión). RLS-scoped.
const ABNORMAL=new Set(["HIGH","LOW","CRITICAL","ABNORMAL","PANIC"]);
// Auditoría 2026-09-19, anexo R04 (R04-F04) — EL TIPO DE ESTUDIO SE LEE, NO SE ADIVINA.
//
// Antes, esta función decidía «Laboratorio» o «Imagenología» con una expresión regular sobre el NOMBRE del analito. Dos
// falsos positivos comprobados: «Radioinmunoensayo de TSH» y «Placas de Petri (cultivo)» —ambos de laboratorio— salían
// como imagenología por contener «radio» y «placa». Y solo producía dos etiquetas cuando el dominio tiene CINCO tipos de
// orden, así que patología, procedimiento e interconsulta se presentaban como análisis de laboratorio.
//
// El tipo lo declara la ORDEN que originó el resultado, y el resultado lleva su orderId: el registro lo resuelve por join.
// Cuando no hay orden resoluble (filas heredadas), NO se adivina: se dice «Sin clasificar», porque un tipo inventado es
// peor que un hueco visible.
const TIPO_UI:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PATHOLOGY:"Patología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta"};
const tipoOf=(orderType:string|null):string=>orderType?(TIPO_UI[orderType]??"Otro"):"Sin clasificar";
function estadoOf(critical:boolean,status:string,lifecycle:string):"Hallazgos"|"Normal"|"En seguimiento"|"En revisión"{
 if(critical||ABNORMAL.has(status.toUpperCase()))return"Hallazgos";
 if(lifecycle==="ACTIONED")return"En seguimiento";
 if(lifecycle==="RECEIVED")return"En revisión";
 return"Normal";
}
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"result:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  // R06-20: lista acotada por página; los indicadores, contados en la base con la misma regla que la lista.
  const url=new URL(req.url);
  const page=await resultsRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>{const estado=estadoOf(r.critical,r.status,r.lifecycle);return{
   resultId:r.resultId,patientId:r.patientId,patientName:r.patientName,
   analyte:r.analyte,value:r.value,critical:r.critical,status:r.status,interpretation:r.interpretation,
   tipo:tipoOf(r.orderType),estado,lifecycle:r.lifecycle,receivedAt:r.receivedAt};});
  const{total,abnormal,enSeguimiento,pendientes}=await resultsSummary(ctx);
  return NextResponse.json({items,nextCursor:page.nextCursor,total,abnormal,enSeguimiento,pendientes},{status:200});
 });
}
