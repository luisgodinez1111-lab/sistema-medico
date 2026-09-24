import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{anionGap,correctedCalcium,correctedSodiumForGlucose,calculatedOsmolality}from"../../../../../../../../packages/lab-derivations/src";
import{latestAnalyteReading}from"../../../../../../lib/clinical-runtime";
import{verifyAnalyteReadings,provenance,MAX_AGE_DAYS,COHERENCE_HOURS}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// EPIC BN — GET /api/v1/patients/:id/metabolic-panel (derivaciones multi-analito: anion gap, calcio corregido)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Se lee cada analito UNA vez (valor canónico + unidad + fecha) y cada derivada exige sus entradas plausibles,
  // vigentes y de la MISMA extracción (≤24 h): una brecha aniónica con sodio de hoy y cloro del mes pasado no es válida.
  const NAMES=["SODIUM","CHLORIDE","BICARBONATE","CALCIUM","ALBUMIN","GLUCOSE","BUN"] as const;
  const readings=await Promise.all(NAMES.map(a=>latestAnalyteReading(tctx,patientId,a)));
  const pick=(...as:(typeof NAMES[number])[])=>verifyAnalyteReadings(as.map(a=>({analyte:a,maxAgeDays:MAX_AGE_DAYS.METABOLIC_PANEL})),as.map(a=>readings[NAMES.indexOf(a)]),{coherenceHours:COHERENCE_HOURS.METABOLIC_PANEL});
  const gAg=pick("SODIUM","CHLORIDE","BICARBONATE"),gCa=pick("CALCIUM","ALBUMIN"),gNa=pick("SODIUM","GLUCOSE"),gOsm=pick("SODIUM","GLUCOSE","BUN");
  // C-22: la brecha se corrige por albúmina cuando hay una albúmina coherente con la misma extracción; si no, se declara sin corregir.
  const gAgAlb=pick("SODIUM","CHLORIDE","BICARBONATE","ALBUMIN");
  const ag=gAg.ok?anionGap(gAg.values["SODIUM"]!,gAg.values["CHLORIDE"]!,gAg.values["BICARBONATE"]!,gAgAlb.ok?gAgAlb.values["ALBUMIN"]:undefined):undefined;
  const cca=gCa.ok?correctedCalcium(gCa.values["CALCIUM"]!,gCa.values["ALBUMIN"]!):undefined;
  const cna=gNa.ok?correctedSodiumForGlucose(gNa.values["SODIUM"]!,gNa.values["GLUCOSE"]!):undefined;
  const osm=gOsm.ok?calculatedOsmolality(gOsm.values["SODIUM"]!,gOsm.values["GLUCOSE"]!,gOsm.values["BUN"]!):undefined;
  const missing:string[]=[];
  if(!gAg.ok)missing.push(`anionGap: ${gAg.reason}`);
  if(!gCa.ok)missing.push(`correctedCalcium: ${gCa.reason}`);
  if(!gNa.ok)missing.push(`correctedSodium: ${gNa.reason}`);
  if(!gOsm.ok)missing.push(`osmolality: ${gOsm.reason}`);
  const used=[gAg,gCa,gNa,gOsm].flatMap(g=>g.ok?g.inputs:[]);const inputs=provenance(used.filter((x,i)=>used.findIndex(y=>y.analyte===x.analyte)===i));
  return NextResponse.json({patientId,anionGap:ag??null,correctedCalcium:cca??null,correctedSodium:cna??null,osmolality:osm??null,missing,
   // Auditoría R03-05: este caveat afirmaba «SIN corrección por albúmina y sin delta-delta» cuando la corrección ya
   // existía (C-22) y el delta-delta se calcula ahora en /acid-base, que es donde tiene sentido (necesita el HCO₃ y el
   // trastorno primario). Un caveat obsoleto es desinformación con apariencia de prudencia.
   caveat:ag?(ag.albuminCorrected?"Brecha aniónica corregida por albúmina (Figge). El delta-delta y la bifurcación brecha aumentada vs hiperclorémica se obtienen en /acid-base, que además interpreta la compensación.":"Brecha aniónica SIN corregir por albúmina (no hay albúmina coherente con la misma extracción): una hipoalbuminemia la subestima. El delta-delta se obtiene en /acid-base."):"Sin brecha aniónica: faltan entradas coherentes.",
   algorithm:{id:"METABOLIC-DERIVATIONS",version:"2"},inputs},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
