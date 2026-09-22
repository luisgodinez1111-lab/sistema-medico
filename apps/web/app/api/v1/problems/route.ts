import{NextResponse}from"next/server";
import{handleProblemCreate}from"../../../../lib/problem-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{problemRegistry}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleProblemCreate(req);}

// EPIC Q/UI — GET /api/v1/problems -> registro de problemas de toda la clínica (vista Problemas).
// Cada problema con paciente, CIE-10, categoría-UI, estado y fecha, MÁS conteos por estado (activos/en
// seguimiento/resueltos/inactivos), por categoría (para el donut) y top de pacientes con más problemas. RLS-scoped.
const STATUS_ES:Record<string,string>={ACTIVE:"Activo",CHRONIC:"En seguimiento",RESOLVED:"Resuelto",INACTIVE:"Inactivo"};
// Categorías internas del catálogo CIE-10 -> etiquetas de la UI (donut). El resto cae en "Otros".
const CAT_UI:Record<string,string>={Endocrino:"Endocrinológicos",Cardiovascular:"Cardiovasculares",["Salud mental"]:"Psiquiátricos",Respiratorio:"Respiratorios",Obstétrico:"Ginecológicos",Genitourinario:"Genitourinarios",Digestivo:"Digestivos",Musculoesquelético:"Musculoesqueléticas",Infeccioso:"Infecciosas",["Hematológico"]:"Hematológicas"};
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"problem:read",purpose:"TREATMENT"});
  const rows=await problemRegistry(ctx);
  const items=rows.map(r=>({
   problemId:r.problemId,patientId:r.patientId,patientName:r.patientName,
   code:r.code,description:r.description,category:CAT_UI[r.category]??"Otros",
   chronic:r.status==="CHRONIC",status:r.status,statusLabel:STATUS_ES[r.status]??"Activo",
   recordedAt:r.recordedAt,registeredBy:r.registeredBy}));
  const total=items.length;
  const byStatus={activos:0,enSeguimiento:0,resueltos:0,inactivos:0};
  const byCategory:Record<string,number>={};
  const perPatient:Record<string,{name:string;count:number}>={};
  for(const it of items){
   if(it.status==="ACTIVE")byStatus.activos++;else if(it.status==="CHRONIC")byStatus.enSeguimiento++;else if(it.status==="RESOLVED")byStatus.resueltos++;else byStatus.inactivos++;
   byCategory[it.category]=(byCategory[it.category]??0)+1;
   const p=perPatient[it.patientId]??{name:it.patientName,count:0};p.count++;perPatient[it.patientId]=p;
  }
  const topPatients=Object.values(perPatient).sort((a,b)=>b.count-a.count).slice(0,5);
  return NextResponse.json({items,total,byStatus,byCategory,topPatients},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
