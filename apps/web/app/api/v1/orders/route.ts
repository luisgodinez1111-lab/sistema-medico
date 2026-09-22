import{NextResponse}from"next/server";
import{handleOrderCreate}from"../../../../lib/order-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{ordersRegistry}from"../../../../lib/clinical-runtime";
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
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"order:read",purpose:"TREATMENT"});
  const rows=await ordersRegistry(ctx);
  const items=rows.map(r=>({orderId:r.orderId,patientId:r.patientId,patientName:r.patientName,orderType:r.orderType,typeLabel:TYPE_UI[r.orderType]??"Otro",detail:r.detail,status:r.status,createdAt:r.createdAt,version:r.version}));
  const total=items.length;
  const solicitadas=items.filter(i=>i.status==="Solicitada").length;
  const enviadas=items.filter(i=>i.status==="Enviada").length;
  const completadas=items.filter(i=>i.status==="Completada").length;
  return NextResponse.json({items,total,solicitadas,enviadas,completadas},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
