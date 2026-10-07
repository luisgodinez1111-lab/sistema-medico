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
// Auditoría 2026-09-19, anexo R04 (R04-F05): «umbral de 30 días "Próxima" sin fuente». El hallazgo tiene razón en que el
// número estaba suelto, y la respuesta honesta no es inventarle una norma: **ninguna norma fija este umbral**. Es un
// criterio OPERATIVO del tablero —cuánta antelación quiere el consultorio para empezar a preocuparse por un trámite— y
// como tal se declara aquí, con nombre, con su naturaleza y con quién puede cambiarlo. Lo que sí es normativo es la fecha
// límite de cada obligación, y esa viene en el evento, no de este cálculo.
//
// Se declara en lugar de parametrizarse porque un ajuste por consultorio sin nadie que lo pida sería especulación; cuando
// el dueño lo pida, entra en los ajustes del consultorio (`office-settings`) y este constante pasa a ser su valor inicial.
const PROXIMA_DIAS=30;
const PROXIMA_BASIS="Criterio OPERATIVO del tablero, no normativo: ninguna NOM fija la antelación con la que una obligación regulatoria pasa a «próxima». Cambiarlo es decisión del dueño del consultorio.";
function computeStatus(dueDate:string|null,now:Date):Estado{
 if(!dueDate)return"Vigente";
 const d=new Date(dueDate);if(isNaN(d.getTime()))return"Vigente";
 const days=Math.floor((d.getTime()-now.getTime())/86400000);
 if(days<0)return"Vencida";
 if(days<=PROXIMA_DIAS)return"Próxima";
 return"Al día";
}
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"obligation:read",purpose:"TREATMENT"});
  const now=new Date();
  const{rows,truncated}=await regulatoryObligations(ctx);
  const items=rows.map(r=>{const estado=computeStatus(r.dueDate,now);const days=r.dueDate?Math.floor((new Date(r.dueDate).getTime()-now.getTime())/86400000):null;
   // Estado del ciclo + versión (If-Match) + evidencia: la UI puede CUMPLIR/RENOVAR (acción→evento), no solo leer.
   return{obligationId:r.obligationId,name:r.name,category:r.category,periodicity:r.periodicity,dueDate:r.dueDate,estado,daysUntil:days,lifecycleState:r.lifecycleState,version:r.version,evidenceRef:r.evidenceRef,compliedAt:r.compliedAt};});
  const total=items.length;
  const alDia=items.filter(i=>i.estado==="Al día"||i.estado==="Vigente").length;
  const proximas=items.filter(i=>i.estado==="Próxima").length;
  const vencidas=items.filter(i=>i.estado==="Vencida").length;
  // Cumplimiento por categoría = % de obligaciones no vencidas.
  const byCat:Record<string,{ok:number;total:number}>={};
  for(const it of items){const c=byCat[it.category]??{ok:0,total:0};c.total++;if(it.estado!=="Vencida")c.ok++;byCat[it.category]=c;}
  const compliance:Record<string,number>={};
  for(const[c,v]of Object.entries(byCat))compliance[c]=v.total?Math.round(v.ok/v.total*100):0;
  // R04-008: si el tope de lectura muerde, el porcentaje de cumplimiento se habría calculado sobre un conjunto PARCIAL y
  // se presentaría como el del consultorio. Se DICE, en vez de publicar un número falso con apariencia de medición.
  return NextResponse.json({
   proximaThreshold:{days:PROXIMA_DIAS,basis:PROXIMA_BASIS},items,total,alDia,proximas,vencidas,compliance,truncated,
   ...(truncated?{truncatedNote:"Este consultorio supera el techo de lectura: los KPI y el cumplimiento por categoría se calcularon sobre una lista PARCIAL y no representan el total."}:{})},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
