import{NextResponse}from"next/server";
import{handleClaimDraft}from"../../../../lib/claim-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{claimsRegistry}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
import{monthOf,periodOf}from"../../../../lib/clinic-time";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleClaimDraft(req);}

// EPIC Y/UI — GET /api/v1/claims -> registro de facturación de toda la clínica (vista Facturación).
// Cada factura con paciente, monto, estado y folio (secuencial), MÁS KPIs: ingresos pagados del periodo,
// facturas emitidas, pendientes de pago (conteo + monto) y cancelaciones. RLS-scoped.
const STATUS_ES:Record<string,string>={PENDING:"Pendiente",PAID:"Pagada",REJECTED:"Rechazada",VOID:"Cancelada"};
const num=(s:string)=>{const n=parseFloat(String(s).replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:0;};

export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"billing:read",purpose:"TREATMENT"});
  const rows=await claimsRegistry(ctx);
  const total=rows.length;
  // Folio secuencial descendente (la más reciente tiene el folio mayor).
  const items=rows.map((r,i)=>({
   claimId:r.claimId,folio:`F-${String(total-i).padStart(6,"0")}`,
   patientId:r.patientId,patientName:r.patientName,
   amount:num(r.amount),currency:r.currency,
   status:r.status,statusLabel:STATUS_ES[r.status]??"Pendiente",
   recordedAt:r.recordedAt,paidAt:r.paidAt}));
  const paid=items.filter(i=>i.status==="PAID");
  const pending=items.filter(i=>i.status==="PENDING");
  const voided=items.filter(i=>i.status==="VOID");
  // Auditoría L-09: "ingresos del mes" sumaba TODAS las facturas pagadas de la historia. Ahora: pagadas cuya fecha de
  // pago cae en el mes en curso (zona horaria de México; `?month=YYYY-MM` permite pedir otro mes). Se declara el periodo.
  const month=periodOf(new URL(req.url).searchParams.get("month"));
  const paidInPeriod=paid.filter(i=>i.paidAt!==null&&monthOf(i.paidAt)===month);
  return NextResponse.json({
   items,total,
   incomePeriod:month,
   incomeThisMonth:Math.round(paidInPeriod.reduce((s,i)=>s+i.amount,0)*100)/100,
   incomeAllTime:Math.round(paid.reduce((s,i)=>s+i.amount,0)*100)/100,
   issuedCount:total,
   pendingCount:pending.length,pendingAmount:Math.round(pending.reduce((s,i)=>s+i.amount,0)*100)/100,
   cancellations:voided.length,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
