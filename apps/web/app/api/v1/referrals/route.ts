import{NextResponse}from"next/server";
import{handleReferralRequest}from"../../../../lib/referral-lifecycle";
import{referralsRegistry,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleReferralRequest(req);}

// EPIC G/UI (Lote G) — GET /api/v1/referrals -> registro POBLACIONAL de interconsultas de toda la clínica (vista
// Interconsultas) + directorio de destinatarios. Cada interconsulta con paciente/especialidad/destinatario/estado, MÁS
// conteos (abiertas/completadas/pacientes/destinatarios distintos). Lista acotada por cursor. RLS-scoped.
const STATUS_ES:Record<string,string>={REQUESTED:"Solicitada",ACCEPTED:"Aceptada",DECLINED:"Declinada",COMPLETED:"Completada",CANCELLED:"Cancelada"};
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"referral:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  const url=new URL(req.url);
  const page=await referralsRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>({...r,statusLabel:STATUS_ES[r.status]??r.status}));
  // Directorio: destinatarios distintos ya usados, con su especialidad/institución más frecuente y cuántas interconsultas.
  const dir=new Map<string,{name:string;specialty:string;institution:string;count:number}>();
  for(const r of page.items){const n=r.recipientName.trim();if(!n)continue;const e=dir.get(n)??{name:n,specialty:r.specialty,institution:r.recipientInstitution,count:0};e.count++;if(!e.institution&&r.recipientInstitution)e.institution=r.recipientInstitution;dir.set(n,e);}
  const directory=[...dir.values()].sort((a,b)=>b.count-a.count);
  return NextResponse.json({items,nextCursor:page.nextCursor,total:page.total,openCount:page.openCount,completedCount:page.completedCount,patientsCount:page.patientsCount,recipientsCount:page.recipientsCount,directory},{status:200});
 });
}
