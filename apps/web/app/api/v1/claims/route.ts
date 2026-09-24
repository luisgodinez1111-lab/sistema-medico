import{NextResponse}from"next/server";
import{handleClaimDraft}from"../../../../lib/claim-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{claimsRegistry,claimsIncome,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
import{CLINIC_TZ,periodOf}from"../../../../lib/clinic-time";
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
  authorize(principalFrom(claims),{scope:"billing:read",purpose:"TREATMENT"});
  // R06-20: los indicadores se suman EN LA BASE (antes se traían todas las facturas del tenant y se sumaban en Node).
  //
  // El FOLIO queda sin paginar a propósito, y es una cuestión de fondo, no técnica: hoy se deriva de la POSICIÓN en la
  // lista (`total - i`), así que emitir una factura nueva RENUMERA las anteriores. Para un comprobante fiscal eso no es
  // aceptable, y el folio real tendría que asignarse al emitir y viajar en el evento. Mientras esa decisión sea del dueño,
  // esta ruta devuelve la PRIMERA página (las más recientes, que es lo que muestra el tablero) y no acepta cursor: la
  // numeración sigue siendo exactamente la de antes para las filas que entrega, en vez de quedar mal en la página 2.
  const page=await claimsRegistry(ctx,{limit:PAGE_LIMIT_MAX});
  const rows=page.items;
  const total=page.total;
  // Folio secuencial descendente (la más reciente tiene el folio mayor).
  const items=rows.map((r,i)=>({
   claimId:r.claimId,folio:`F-${String(total-i).padStart(6,"0")}`,
   patientId:r.patientId,patientName:r.patientName,
   amount:num(r.amount),currency:r.currency,
   status:r.status,statusLabel:STATUS_ES[r.status]??"Pendiente",
   recordedAt:r.recordedAt,paidAt:r.paidAt}));
  // Auditoría L-09: "ingresos del mes" sumaba TODAS las facturas pagadas de la historia. Ahora: pagadas cuya fecha de
  // pago cae en el mes en curso (zona horaria de la clínica; `?month=YYYY-MM` permite pedir otro mes). Se declara el periodo.
  const month=periodOf(new URL(req.url).searchParams.get("month"));
  const kpi=await claimsIncome(ctx,month,CLINIC_TZ);
  return NextResponse.json({
   items,total,
   incomePeriod:month,
   incomeThisMonth:kpi.incomeThisMonth,
   incomeAllTime:kpi.incomeAllTime,
   issuedCount:kpi.issued,
   pendingCount:kpi.pendingCount,pendingAmount:kpi.pendingAmount,
   cancellations:kpi.cancellations,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
