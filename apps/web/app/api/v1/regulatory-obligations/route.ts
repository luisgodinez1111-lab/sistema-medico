import{NextResponse}from"next/server";
import{handleRegulatoryObligationCreate}from"../../../../lib/regulatory-obligation-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{regulatoryObligations}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleRegulatoryObligationCreate(req);}

// EPIC AC/UI — GET /api/v1/regulatory-obligations -> obligaciones regulatorias del consultorio (vista Obligaciones).
// Cada obligación con estado COMPUTADO de la fecha límite (Al día / Próxima / Vencida / Vigente), MÁS KPIs
// (al día / próximas / vencidas / total) y cumplimiento por categoría (% al día). Determinista, RLS-scoped.
type Estado="Al día"|"Próxima"|"Vencida"|"Vigente";
function computeStatus(dueDate:string|null,now:Date):Estado{
 if(!dueDate)return"Vigente";
 const d=new Date(dueDate);if(isNaN(d.getTime()))return"Vigente";
 const days=Math.floor((d.getTime()-now.getTime())/86400000);
 if(days<0)return"Vencida";
 if(days<=30)return"Próxima";
 return"Al día";
}
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"obligation:read",purpose:"TREATMENT"});
  const now=new Date();
  const rows=await regulatoryObligations(ctx);
  const items=rows.map(r=>{const estado=computeStatus(r.dueDate,now);const days=r.dueDate?Math.floor((new Date(r.dueDate).getTime()-now.getTime())/86400000):null;
   return{obligationId:r.obligationId,name:r.name,category:r.category,periodicity:r.periodicity,dueDate:r.dueDate,estado,daysUntil:days};});
  const total=items.length;
  const alDia=items.filter(i=>i.estado==="Al día"||i.estado==="Vigente").length;
  const proximas=items.filter(i=>i.estado==="Próxima").length;
  const vencidas=items.filter(i=>i.estado==="Vencida").length;
  // Cumplimiento por categoría = % de obligaciones no vencidas.
  const byCat:Record<string,{ok:number;total:number}>={};
  for(const it of items){const c=byCat[it.category]??{ok:0,total:0};c.total++;if(it.estado!=="Vencida")c.ok++;byCat[it.category]=c;}
  const compliance:Record<string,number>={};
  for(const[c,v]of Object.entries(byCat))compliance[c]=v.total?Math.round(v.ok/v.total*100):0;
  return NextResponse.json({items,total,alDia,proximas,vencidas,compliance},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
