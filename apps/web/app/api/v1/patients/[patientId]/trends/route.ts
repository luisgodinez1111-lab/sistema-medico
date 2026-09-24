import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{analyteSeries,latestAnalyteReading,patientEgfr}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CH — GET /api/v1/patients/:id/trends  (panel 4: "Resultados y evolución longitudinal")
// Series temporales de analitos clave + últimos valores para el grid de "otros resultados". Determinista.
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Detalle de una lectura para el grid: valor, unidad canónica, fecha y antigüedad en días. `null` si no hay dato.
type Reading=Readonly<{value:number;canonicalUnit:string|null;unit:string|null;occurredAt:string;unitAssumed:boolean}>;
const detail=(r:Reading|undefined)=>r?{value:r.value,unit:r.canonicalUnit??r.unit,occurredAt:r.occurredAt,
 ageDays:Math.floor((Date.now()-Date.parse(r.occurredAt))/86_400_000),unitAssumed:r.unitAssumed}:null;

export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const[hba1c,glucose,ldl,creatinine,latLdl,latCreat,latUacr,egfr]=await Promise.all([
   analyteSeries(tctx,patientId,"HBA1C"),
   analyteSeries(tctx,patientId,"GLUCOSE"),
   analyteSeries(tctx,patientId,"LDL"),
   analyteSeries(tctx,patientId,"CREATININE"),
   // R03-10: el último valor viaja con UNIDAD y FECHA. Antes era un número desnudo: el médico veía «LDL 98» sin saber
   // si era de esta semana o de 2019, y ninguna pantalla podía mostrar la unidad porque el lector no la devolvía.
   latestAnalyteReading(tctx,patientId,"LDL"),
   latestAnalyteReading(tctx,patientId,"CREATININE"),
   latestAnalyteReading(tctx,patientId,"UACR"),
   patientEgfr(tctx,patientId),
  ]);
  return NextResponse.json({patientId,
   series:{HBA1C:hba1c,GLUCOSE:glucose,LDL:ldl,CREATININE:creatinine},
   latest:{LDL:latLdl?.value??null,CREATININE:latCreat?.value??null,UACR:latUacr?.value??null,EGFR:typeof egfr==="number"&&Number.isFinite(egfr)?egfr:null},
   latestDetail:{LDL:detail(latLdl),CREATININE:detail(latCreat),UACR:detail(latUacr)}},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
