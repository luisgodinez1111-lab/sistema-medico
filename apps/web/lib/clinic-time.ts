// Auditoría 2026-09-19 (L-09, L-12) — tiempo civil del consultorio. Los instantes se guardan en UTC (ISO con "Z"); el mes
// contable y el día de agenda se calculan en la zona horaria del consultorio (México): sin ella, un pago a las 23:30 del
// día 31 en CDMX caería en el mes siguiente y una cita de las 22:00 aparecería en la agenda del día siguiente. Puro; sin PHI.
export const CLINIC_TZ="America/Mexico_City";
const parts=(d:Date,timeZone:string)=>{
 const p=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(d);
 const g=(t:string)=>p.find(x=>x.type===t)!.value;return{y:g("year"),m:g("month"),d:g("day"),h:g("hour")==="24"?"00":g("hour"),mi:g("minute"),s:g("second")};
};
export function monthOf(iso:string,timeZone=CLINIC_TZ):string{
 const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";
 const x=parts(d,timeZone);return `${x.y}-${x.m}`;
}
// `?month=YYYY-MM` válido -> ese mes; si no, el mes en curso.
export function periodOf(q:string|null,now=new Date()):string{return q&&/^\d{4}-(0[1-9]|1[0-2])$/.test(q)?q:monthOf(now.toISOString());}
// Desfase (ms) de la zona horaria respecto a UTC en un instante dado (DST incluido).
function offsetMs(at:Date,timeZone:string):number{
 const x=parts(at,timeZone);
 const asUtc=Date.UTC(Number(x.y),Number(x.m)-1,Number(x.d),Number(x.h),Number(x.mi),Number(x.s));
 return asUtc-Math.floor(at.getTime()/1000)*1000;
}
// Ventana UTC [from, to) del día civil YYYY-MM-DD en la zona del consultorio.
export function dayWindow(dateStr:string,timeZone=CLINIC_TZ):{fromIso:string;toIso:string}{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))throw new RangeError("dateStr must be YYYY-MM-DD");
 const guess=new Date(`${dateStr}T00:00:00.000Z`);
 const from=new Date(guess.getTime()-offsetMs(guess,timeZone));
 const from2=new Date(guess.getTime()-offsetMs(from,timeZone)); // segunda pasada por si el desfase cambia en la medianoche (DST)
 const nextGuess=new Date(guess.getTime()+864e5);
 const to=new Date(nextGuess.getTime()-offsetMs(new Date(nextGuess.getTime()-offsetMs(nextGuess,timeZone)),timeZone));
 return{fromIso:from2.toISOString(),toIso:to.toISOString()};
}
// Día civil YYYY-MM-DD de un instante en la zona del consultorio.
export function dayOf(iso:string,timeZone=CLINIC_TZ):string{const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";const x=parts(d,timeZone);return `${x.y}-${x.m}-${x.d}`;}
