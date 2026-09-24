import{NextResponse}from"next/server";
import{calcReceipt}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{aaGradient,atmPressureFromAltitude}from"../../../../../../../../packages/oxygenation/src";
import{patientDemographics,officeSettings}from"../../../../../../lib/clinical-runtime";
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
  // Auditoría R03-08: la presión atmosférica ya NO cae en 760 mmHg con un aviso. Se toma, en este orden: la declarada en
  // la consulta, o la derivada de la ALTITUD de la sede (configuración del consultorio). Si no hay ninguna, NO se calcula:
  // en una sede a 2 240 m, asumir el nivel del mar sobrestima el gradiente ~37 mmHg y convierte una hipoxemia por
  // hipoventilación en un «problema de intercambio gaseoso».
  const atmDeclared=q.has("atm")&&Number.isFinite(atmParam)&&atmParam>=300&&atmParam<=800;
  const settings=atmDeclared?undefined:await officeSettings(tctx);
  const altitudTexto=String((settings?.settings as Record<string,unknown>|undefined)?.["altitudeMeters"]??"");
  const altitud=Number(altitudTexto);
  const atmFromAltitude=altitudTexto!==""&&Number.isFinite(altitud)?atmPressureFromAltitude(altitud):undefined;
  const atmPressure=atmDeclared?atmParam:atmFromAltitude;
  if(atmPressure===undefined)return NextResponse.json({patientId,computable:false,
   reason:"Falta la presión atmosférica: declare ?atm=<mmHg> o configure la altitud de la sede (Configuración → altitudeMeters). Asumir el nivel del mar en altitud sobrestima el gradiente A-a y puede convertir una hipoxemia por hipoventilación en un falso problema de intercambio gaseoso.",
   reasonCode:"ATM_PRESSURE_REQUIRED"},{status:200});
  const r=aaGradient(inp.values["PO2"]!,inp.values["PCO2"]!,ageYears(demo.birthDate),{fio2,atmPressure});
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,alveolarPo2:r.alveolarPo2,gradient:r.gradient,expected:r.expected,elevated:r.elevated,interpretation:r.interpretation,
   expectedValid:r.expectedValid,fio2:r.fio2,atmPressure:r.atmPressure,pfRatio:r.pfRatio,
   atmPressureSource:atmDeclared?"DECLARED":"SITE_ALTITUDE",
   warnings:[...inp.warnings,...(atmDeclared?[]:[`Presión atmosférica derivada de la altitud de la sede (${altitud} m → ${atmPressure} mmHg, atmósfera estándar ISO 2533). El clima la mueve ±10 mmHg: declare ?atm= si dispone de la barométrica local.`])],
   algorithm:{id:"AA-GRADIENT",version:"3",authority:"Ecuación del gas alveolar; esperado por edad Mellemgaard 1966; presión ISO 2533"},
   receipt:calcReceipt({id:"AA-GRADIENT",version:"3",authority:"Mellemgaard 1966; ISO 2533"},{fio2,atmPressure,ageYears:ageYears(demo.birthDate),inputs:provenance(inp.inputs)},"COMPUTED",r.gradient),
   inputs:provenance(inp.inputs)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
