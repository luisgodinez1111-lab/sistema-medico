import{NextResponse}from"next/server";
import{calcReceipt,CLINICAL_USE_WARNING}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{interpretAcidBase,acidBaseCheck,type Specimen,type Chronicity}from"../../../../../../../../packages/acid-base/src";
import{anionGap}from"../../../../../../../../packages/lab-derivations/src";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BX — GET /api/v1/patients/:id/acid-base (interpretación de gasometría: trastorno primario + compensación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
const ALG={id:"ACID-BASE",version:"2",authority:"Winters 1967; Berend NEJM 2014; Henderson-Hasselbalch"}as const;
const SPECIMENS=["ARTERIAL","VENOUS","CAPILLARY"]as const;
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Auditoría R03-07: el tipo de MUESTRA es obligatorio y no se asume arterial. El sistema no lo registra con el
  // resultado (el analito no lo distingue), así que lo declara quien consulta. De una muestra venosa no se juzga la
  // compensación respiratoria: su pCO₂ es 4–6 mmHg mayor y la regla perdería el significado que dice tener.
  const q=new URL(req.url).searchParams;
  const sp=(q.get("specimen")??"").toUpperCase();
  if(!(SPECIMENS as readonly string[]).includes(sp))
   return NextResponse.json({patientId,computable:false,reasonCode:"SPECIMEN_REQUIRED",
    reason:"Indique el tipo de muestra (?specimen=ARTERIAL|VENOUS|CAPILLARY). El pH venoso es 0.03–0.05 menor y el pCO₂ 4–6 mmHg mayor que el arterial: interpretar una gasometría sin saber de dónde salió es interpretar otra cosa.",
    algorithm:ALG},{status:200});
  const specimen=sp as Specimen;
  const ch=(q.get("chronicity")??"").toUpperCase();
  const chronicity=ch==="ACUTE"||ch==="CHRONIC"?ch as Chronicity:undefined;
  // Una gasometría es un conjunto SIMULTÁNEO: pH, pCO₂ y HCO₃ deben venir de la misma muestra (o ≤1 h) y ser recientes.
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"PH",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS},{analyte:"PCO2",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS},{analyte:"BICARBONATE",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS}],{coherenceHours:COHERENCE_HOURS.BLOOD_GAS});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp),algorithm:ALG},{status:200});
  const ph=inp.values["PH"]!,pco2=inp.values["PCO2"]!,hco3=inp.values["BICARBONATE"]!;
  // R03-07: el panel se rechaza si es internamente incoherente (los tres valores están sobredeterminados). Antes,
  // (7.40, 40, 5) —imposible— se clasificaba como si nada, y una transposición de campos pasaba desapercibida.
  const rej=acidBaseCheck(ph,pco2,hco3);
  if(rej)return NextResponse.json({patientId,computable:false,reasonCode:rej.reasonCode,reason:rej.detail,ph,pco2,hco3,algorithm:ALG},{status:200});
  // R03-05: la brecha aniónica (corregida por albúmina cuando la hay) entra al análisis para bifurcar la acidosis
  // metabólica y calcular el delta-delta. Sodio y cloro pueden venir de otro tubo del mismo episodio: ventana de 24 h.
  const[ag,alb]=await Promise.all([
   readAnalyteInputs(tctx,patientId,[{analyte:"SODIUM",maxAgeDays:MAX_AGE_DAYS.METABOLIC_PANEL},{analyte:"CHLORIDE",maxAgeDays:MAX_AGE_DAYS.METABOLIC_PANEL},{analyte:"BICARBONATE",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS}],{coherenceHours:COHERENCE_HOURS.METABOLIC_PANEL}),
   readAnalyteInputs(tctx,patientId,[{analyte:"ALBUMIN",maxAgeDays:MAX_AGE_DAYS.METABOLIC_PANEL}]),
  ]);
  const gap=ag.ok?anionGap(ag.values["SODIUM"]!,ag.values["CHLORIDE"]!,ag.values["BICARBONATE"]!,alb.ok?alb.values["ALBUMIN"]:undefined):undefined;
  const r=interpretAcidBase(ph,pco2,hco3,{specimen,...(chronicity?{chronicity}:{}),
   ...(gap?{anionGap:gap.value,anionGapCorrected:gap.albuminCorrected}:{})});
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos",algorithm:ALG},{status:200});
  return NextResponse.json({patientId,computable:true,ph,pco2,hco3,specimen,phCalculated:r.phCalculated,
   status:r.status,primary:r.primary,
   expectedPco2:r.expectedPco2??null,expectedHco3:r.expectedHco3??null,
   compensation:r.compensation??null,compensationAssessed:r.compensationAssessed,
   scenarios:r.scenarios??null,chronicityDeclared:chronicity??null,
   anionGap:gap?{value:gap.value,raw:gap.raw,albuminCorrected:gap.albuminCorrected,status:gap.status}:null,
   anionGapBranch:r.anionGapBranch??null,deltaRatio:r.deltaRatio??null,deltaInterpretation:r.deltaInterpretation??null,
   interpretation:r.interpretation,
   ...(gap?{}:{anionGapNote:"Sin sodio y cloro coherentes (≤24 h): la acidosis metabólica no se bifurca en brecha aumentada vs hiperclorémica ni se calcula el delta-delta."}),
   algorithm:ALG,inputs:provenance([...inp.inputs,...(ag.ok?ag.inputs.filter(x=>x.analyte!=="BICARBONATE"):[]),...(alb.ok?alb.inputs:[])]),
   warnings:[...inp.warnings,...(ag.ok?ag.warnings:[]),...(alb.ok?alb.warnings:[])],
   receipt:calcReceipt(ALG,{ph,pco2,hco3,specimen,chronicity:chronicity??null,anionGap:gap?.value??null,inputs:provenance(inp.inputs),usageWarning:CLINICAL_USE_WARNING},"COMPUTED",r.primary)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
