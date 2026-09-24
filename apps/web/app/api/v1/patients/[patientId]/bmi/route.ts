import{NextResponse}from"next/server";
import{calcReceipt}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{bmiFromVitals,BMI_PLAUSIBLE,BMI_MIN_ADULT_AGE_YEARS}from"../../../../../../../../packages/anthropometrics/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readVitalInputs,vitalProvenance,vitalNotComputable,MAX_VITAL_AGE_HOURS}from"../../../../../../lib/vital-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BO — GET /api/v1/patients/:id/bmi (IMC + clasificación nutricional WHO; pediatría -> percentil)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(birthDate:string|undefined):number|undefined{
 if(!birthDate)return undefined;const b=new Date(birthDate),a=new Date();if(Number.isNaN(b.getTime()))return undefined;
 let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
const ALG={id:"BMI",version:"2",authority:"WHO 1995/2000 (categorías de adulto)"}as const;
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Auditoría R03-09/R03-33: la ruta ya no infiere la unidad por la magnitud del número ni reimplementa el IMC. Pide las
  // tomas por la guarda de signos vitales (unidad canónica kg/cm verificada, valor plausible, vigencia declarada) y
  // calcula con la ÚNICA implementación, `bmiFromVitals`. Antes, 150 lb se trataban como 150 kg sin que nada lo notara.
  const vit=await readVitalInputs(tctx,patientId,[
   {vitalType:"WEIGHT",maxAgeHours:MAX_VITAL_AGE_HOURS.ANTHROPOMETRY},
   {vitalType:"HEIGHT",maxAgeHours:MAX_VITAL_AGE_HOURS.ANTHROPOMETRY},
  ]);
  if(!vit.ok)return NextResponse.json({patientId,computable:false,...vitalNotComputable(vit),algorithm:ALG},{status:200});
  const w=vit.inputs.find(x=>x.vitalType==="WEIGHT"),h=vit.inputs.find(x=>x.vitalType==="HEIGHT");
  const r=w&&h?bmiFromVitals({value:w.value,unit:w.unit},{value:h.value,unit:h.unit}):undefined;
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Peso/talla no utilizables tras la verificación de unidad y plausibilidad",algorithm:ALG},{status:200});
  // Auditoría R03-09: un IMC fuera de las cotas humanas es un error de captura (p. ej. la talla en metros escrita en el
  // campo de centímetros), no un hallazgo nutricional. No se clasifica: se devuelve el motivo.
  if(r.bmi<BMI_PLAUSIBLE[0]||r.bmi>BMI_PLAUSIBLE[1])
   return NextResponse.json({patientId,computable:false,reasonCode:"IMPLAUSIBLE_BMI",
    reason:`IMC ${r.bmi} kg/m² fuera del rango plausible ${BMI_PLAUSIBLE[0]}–${BMI_PLAUSIBLE[1]} (peso ${r.weightKg} kg, talla ${r.heightM} m): verifique la captura.`,
    weightKg:r.weightKg,heightM:r.heightM,algorithm:ALG,inputs:vitalProvenance(vit.inputs)},{status:200});
  const demo=await patientDemographics(tctx,patientId);
  const age=ageYears(demo?.birthDate);
  const base={patientId,weightKg:r.weightKg,heightM:r.heightM,algorithm:ALG,inputs:vitalProvenance(vit.inputs),warnings:vit.warnings};
  // Auditoría R03-09: en pediatría el IMC NO se clasifica con los cortes de adulto (se interpreta con percentil
  // IMC-para-edad, que este sistema no implementa). Antes se devolvía `computable:true` con el número y una nota; un
  // número acompañado de `computable:true` se lee como resultado válido. Ahora la clasificación es NO computable.
  if(age!==undefined&&age<BMI_MIN_ADULT_AGE_YEARS)
   return NextResponse.json({...base,computable:false,pediatric:true,reasonCode:"PEDIATRIC_PERCENTILE_REQUIRED",bmi:r.bmi,
    reason:`Paciente pediátrico (${age} años): el IMC se interpreta con percentil IMC-para-edad y sexo (OMS/CDC), no con las categorías de adulto. El valor ${r.bmi} kg/m² se informa sin clasificación.`},{status:200});
  if(age===undefined)
   return NextResponse.json({...base,computable:false,reasonCode:"AGE_REQUIRED",bmi:r.bmi,
    reason:"Sin fecha de nacimiento no puede decidirse si aplican las categorías de adulto o el percentil pediátrico."},{status:200});
  return NextResponse.json({...base,computable:true,bmi:r.bmi,category:r.category,label:r.label,
   receipt:calcReceipt(ALG,{weightKg:r.weightKg,heightM:r.heightM,ageYears:age,inputs:base.inputs},"COMPUTED",r.bmi)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
