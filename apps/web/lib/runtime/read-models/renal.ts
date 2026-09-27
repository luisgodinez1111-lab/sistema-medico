// Lote 11 (ADR-0300) — TFG del paciente a partir de su creatinina y demografía. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{normalizeLabValue}from"../../../../../packages/lab-reference/src";
import{computeEGFR,type Sex}from"../../../../../packages/renal-function/src";
import{patientDemographics}from"./patient";
import{latestAnalyteReading}from"./results";
// EPIC BM — eGFR del paciente (CKD-EPI) desde demografía + última creatinina. undefined si no computable
// (sin datos, pediátrico, sexo no binario). Para el gate renal de la prescripción.
// Antigüedad máxima de la creatinina para decidir dosis (criterio de ingeniería, pendiente de validación clínica).
const EGFR_MAX_CREATININE_AGE_DAYS=365;
export async function patientEgfr(ctx:HttpTenantContext,patientId:string):Promise<number|undefined>{
 const demo=await patientDemographics(ctx,patientId);
 if(!demo?.birthDate)return undefined;
 const sex=demo.sexAtBirth;if(sex!=="FEMALE"&&sex!=="MALE")return undefined;
 const b=new Date(demo.birthDate),a=new Date();
 if(Number.isNaN(b.getTime()))return undefined;
 let age=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))age-=1;
 if(age<18)return undefined; // CKD-EPI adulto; en pediatría se usa Schwartz
 // Auditoría C-01/C-12: la barrera renal de prescripción NO debe decidir con una creatinina en otra unidad, implausible
 // u obsoleta. Si el dato no es utilizable, el eGFR es "desconocido" (=> la barrera queda NOT_EVALUATED, nunca "OK").
 const r=await latestAnalyteReading(ctx,patientId,"CREATININE");
 if(!r)return undefined;
 const n=normalizeLabValue("CREATININE",r.value);
 if(!n.ok)return undefined;
 if((Date.now()-new Date(r.occurredAt).getTime())/86_400_000>EGFR_MAX_CREATININE_AGE_DAYS)return undefined;
 return computeEGFR(n.canonicalValue,age,sex as Sex)?.egfr;
}
