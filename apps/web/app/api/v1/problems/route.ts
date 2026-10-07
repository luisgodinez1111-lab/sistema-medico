import{NextResponse}from"next/server";
import{handleProblemCreate}from"../../../../lib/problem-lifecycle";
import{problemRegistry,registrySummary,topPatientsOfRegistry,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleProblemCreate(req);}

// EPIC Q/UI — GET /api/v1/problems -> registro de problemas de toda la clínica (vista Problemas).
// Cada problema con paciente, CIE-10, categoría-UI, estado y fecha, MÁS conteos por estado (activos/en
// seguimiento/resueltos/inactivos), por categoría (para el donut) y top de pacientes con más problemas. RLS-scoped.
const STATUS_ES:Record<string,string>={ACTIVE:"Activo",CHRONIC:"En seguimiento",RESOLVED:"Resuelto",INACTIVE:"Inactivo"};
// Categorías internas del catálogo CIE-10 -> etiquetas de la UI (donut). El resto cae en "Otros".
const CAT_UI:Record<string,string>={Endocrino:"Endocrinológicos",Cardiovascular:"Cardiovasculares",["Salud mental"]:"Psiquiátricos",Respiratorio:"Respiratorios",Obstétrico:"Ginecológicos",Genitourinario:"Genitourinarios",Digestivo:"Digestivos",Musculoesquelético:"Musculoesqueléticas",Infeccioso:"Infecciosas",["Hematológico"]:"Hematológicas"};
// Transiciones que cambian el estado del problema (las anotaciones EPISTEMIC/EVIDENCE no lo cambian: ADR-0240 §2).
const LIFECYCLE=["ADDED","REACTIVATED","MARKED_CHRONIC","RESOLVED","ENTERED_IN_ERROR"] as const;
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"problem:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  // R06-20: la lista va ACOTADA (página con cursor) y los indicadores se calculan EN LA BASE. Antes se traía el tenant
  // entero y se contaba en Node, así que acotar la página sin mover los recuentos habría falseado todos los KPI.
  const url=new URL(req.url);
  const page=await problemRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>({
   problemId:r.problemId,patientId:r.patientId,patientName:r.patientName,
   code:r.code,description:r.description,category:CAT_UI[r.category]??"Otros",
   chronic:r.status==="CHRONIC",status:r.status,statusLabel:STATUS_ES[r.status]??"Activo",
   recordedAt:r.recordedAt,registeredBy:r.registeredBy}));
  const[resumen,top]=await Promise.all([
   registrySummary(ctx,{aggregateType:"ClinicalProblem",baseKind:"ADDED",lifecycleKinds:LIFECYCLE,groupField:"category"}),
   topPatientsOfRegistry(ctx,{aggregateType:"ClinicalProblem",baseKind:"ADDED"}),
  ]);
  const total=resumen.total;
  const byStatus={
   activos:(resumen.byStatus["ADDED"]??0)+(resumen.byStatus["REACTIVATED"]??0),
   enSeguimiento:resumen.byStatus["MARKED_CHRONIC"]??0,
   resueltos:resumen.byStatus["RESOLVED"]??0,
   inactivos:resumen.byStatus["ENTERED_IN_ERROR"]??0,
  };
  // Las categorías se etiquetan igual que en la lista: el agrupado viene de la base con el código del payload.
  const byCategory:Record<string,number>={};
  for(const[cat,n]of Object.entries(resumen.byGroup)){const etiqueta=CAT_UI[cat]??"Otros";byCategory[etiqueta]=(byCategory[etiqueta]??0)+Number(n);}
  const topPatients=top.map(t=>({name:t.name,count:t.count}));
  return NextResponse.json({items,nextCursor:page.nextCursor,total,byStatus,byCategory,topPatients},{status:200});
 });
}
