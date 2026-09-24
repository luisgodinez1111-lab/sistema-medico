import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{aaGradient}from"../../../../../../../../packages/oxygenation/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CA — GET /api/v1/patients/:id/aa-gradient (gradiente alveolo-arterial de O2; opcional ?atm=<mmHg> por altitud)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  // PaO₂ y PaCO₂ de la MISMA gasometría (≤1 h) y recientes.
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"PO2",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS},{analyte:"PCO2",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS}],{coherenceHours:COHERENCE_HOURS.BLOOD_GAS});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  // Auditoría C-02: la FiO₂ NUNCA se pasaba (todo paciente con oxígeno se evaluaba como aire ambiente) y la presión
  // atmosférica era 760 mmHg por defecto (CDMX ≈ 585). El sistema no guarda ninguna de las dos con la gasometría,
  // así que DEBE declararlas quien consulta: ?fio2=0.21..1 y ?atm=<mmHg>. Sin FiO₂ no se calcula.
  const q=new URL(req.url).searchParams;const fio2=Number(q.get("fio2"));const atmParam=Number(q.get("atm"));
  if(!q.has("fio2")||!(fio2>=0.21&&fio2<=1))return NextResponse.json({patientId,computable:false,reason:"Indique la FiO₂ con la que se tomó la gasometría (?fio2=0.21 para aire ambiente; 0.21–1.0). El sistema no la registra y no puede asumirla."},{status:200});
  const atmDeclared=q.has("atm")&&Number.isFinite(atmParam)&&atmParam>=400&&atmParam<=800;
  const r=aaGradient(inp.values["PO2"]!,inp.values["PCO2"]!,ageYears(demo.birthDate),{fio2,...(atmDeclared?{atmPressure:atmParam}:{})});
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,alveolarPo2:r.alveolarPo2,gradient:r.gradient,expected:r.expected,elevated:r.elevated,interpretation:r.interpretation,
   expectedValid:r.expectedValid,fio2:r.fio2,atmPressure:r.atmPressure,pfRatio:r.pfRatio,
   warnings:[...inp.warnings,...(atmDeclared?[]:["Presión atmosférica NO declarada: se usó 760 mmHg (nivel del mar). En altitud (p. ej. CDMX ≈ 585 mmHg) el gradiente queda SOBRESTIMADO; indique ?atm=."])],
   algorithm:{id:"AA-GRADIENT",version:"2"},inputs:provenance(inp.inputs)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
