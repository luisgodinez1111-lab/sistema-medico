import{NextResponse}from"next/server";
import{handleOrderCreate}from"../../../../lib/order-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{ordersRegistry,registrySummary,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleOrderCreate(req);}

// EPIC E/UI — GET /api/v1/orders -> registro de órdenes/solicitudes de estudio de toda la clínica
// (Resultados › Solicitudes). Cada solicitud con paciente, tipo (Laboratorio/Imagenología/…), detalle y estado
// derivado por transición, MÁS conteos por estado. RLS-scoped.
const TYPE_UI:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PATHOLOGY:"Patología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta"};
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"order:read",purpose:"TREATMENT"});
  // R06-20: la lista va ACOTADA (página con cursor) y los indicadores se calculan EN LA BASE. Antes se traía el tenant
  // entero y se contaba en Node, así que acotar la página sin mover los recuentos habría falseado todos los KPI.
  const url=new URL(req.url);
  const page=await ordersRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>({orderId:r.orderId,patientId:r.patientId,patientName:r.patientName,orderType:r.orderType,typeLabel:TYPE_UI[r.orderType]??"Otro",detail:r.detail,status:r.status,createdAt:r.createdAt,version:r.version}));
  const resumen=await registrySummary(ctx,{aggregateType:"ClinicalOrder",baseKind:"CREATED"});
  const total=resumen.total;
  const solicitadas=resumen.byStatus["CREATED"]??0;
  const enviadas=resumen.byStatus["PLACED"]??0;
  const completadas=resumen.byStatus["FULFILLED"]??0;
  return NextResponse.json({items,nextCursor:page.nextCursor,total,solicitadas,enviadas,completadas},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
