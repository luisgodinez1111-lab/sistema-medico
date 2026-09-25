import{pathIds}from"../../../../../../lib/http-command";
import{handleRegulatoryObligationComply}from"../../../../../../lib/regulatory-obligation-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// R2B-024: marcar cumplida una obligación regulatoria, con evidencia. Antes solo existía crear.
export async function POST(req:Request,ctx:{params:Promise<{obligationId:string}>}){
 // El identificador se valida ANTES de tocar el kernel (R04-007), como en toda ruta con parámetro.
 const{obligationId}=await pathIds(ctx.params);
 return handleRegulatoryObligationComply(req,obligationId);
}
