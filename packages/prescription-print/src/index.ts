// Auditoría 2026-09-19 (U-20, L-05) — Receta médica IMPRIMIBLE con los requisitos legales mexicanos. Puro, sin E/S.
//
// Base legal (México):
//  · Reglamento de Insumos para la Salud, arts. 28–31: la receta lleva impreso el nombre, domicilio completo y número de
//    cédula profesional de quien prescribe, fecha y firma autógrafa; indica dosis, presentación, vía de administración,
//    frecuencia y tiempo de duración del tratamiento; los medicamentos se prescriben por denominación genérica (y, si se
//    desea, distintiva).
//  · Ley General de Salud, art. 83: los documentos que usa el profesional consignan la institución que expidió el título y
//    el número de cédula profesional; art. 226 (fracciones I–VI): medicamentos que exigen receta; art. 241 y RIS arts. 50–52:
//    los estupefacientes/psicotrópicos (fracciones I–III) exigen receta especial (código de barras) que esta impresión NO
//    sustituye.
//  · Acuerdo DOF 27/05/2010 y RIS art. 31 bis: los antibióticos solo se venden con receta, que la farmacia retiene o sella.
//  · NOM-004-SSA3-2012 (expediente clínico) numeral 5.10 y 6.2: nombre completo del paciente, edad, sexo, y fecha y hora en
//    la documentación clínica; 8.6: la receta forma parte del expediente.
// El render es HTML autocontenido (estilos en línea, sin scripts) pensado para `window.print()`; el PDF lo produce el
// navegador. Todo texto se escapa: nada de lo que escribió un usuario llega al HTML sin escapar.
export type PrescriberIdentity=Readonly<{fullName:string;cedulaProfesional:string;institution:string;specialty?:string;cedulaEspecialidad?:string}>;
export type EstablishmentIdentity=Readonly<{name:string;address:string;phone:string}>;
export type PrescriptionPatient=Readonly<{name:string;ageYears?:number;sexAtBirth?:string}>;
export type PrescriptionItem=Readonly<{
 medicationId:string;genericName:string;drugCode:string;classes:readonly string[];
 dose:string;route:string;frequency:string;duration?:string;indication?:string;
 override?:Readonly<{barriers:readonly string[]}>; // U-19: una anulación de barrera consta en la receta (transparencia)
}>;
export type PrescriptionData=Readonly<{folio:string;issuedAt:string;prescriber:PrescriberIdentity;establishment:EstablishmentIdentity;patient:PrescriptionPatient;items:readonly PrescriptionItem[];notes?:string}>;
export type LegalCheck=Readonly<{ok:boolean;missing:readonly string[]}>;

// Cédula profesional (Dirección General de Profesiones, SEP): número de 7 u 8 dígitos.
export const CEDULA_RE=/^\d{7,8}$/;
export const isValidCedula=(s:string):boolean=>CEDULA_RE.test(s.trim());
// Clases del catálogo con régimen legal propio en la receta.
export const ANTIBIOTIC_CLASSES:readonly string[]=["BETA_LACTAM","PENICILLIN","CEPHALOSPORIN","SULFONAMIDE","MACROLIDE","LINCOSAMIDE","FLUOROQUINOLONE","TETRACYCLINE","AMINOGLYCOSIDE","NITROIMIDAZOLE"];
export const CONTROLLED_CLASSES:readonly string[]=["OPIOID","BENZODIAZEPINE","BARBITURATE","STIMULANT"];
export const isAntibiotic=(classes:readonly string[]):boolean=>classes.some(c=>ANTIBIOTIC_CLASSES.includes(c));
export const isControlled=(classes:readonly string[]):boolean=>classes.some(c=>CONTROLLED_CLASSES.includes(c));
const blank=(s:string|undefined):boolean=>s===undefined||s.trim()==="";

// Qué falta para que la receta cumpla la ley. Devuelve rutas de campo estables (para que la UI señale qué completar).
export function checkPrescriptionLegal(d:PrescriptionData):LegalCheck{
 const missing:string[]=[];
 if(blank(d.prescriber.fullName))missing.push("prescriber.fullName");
 if(!isValidCedula(d.prescriber.cedulaProfesional))missing.push("prescriber.cedulaProfesional");
 if(blank(d.prescriber.institution))missing.push("prescriber.institution");
 if(blank(d.establishment.address))missing.push("establishment.address");
 if(blank(d.establishment.phone))missing.push("establishment.phone");
 if(blank(d.patient.name))missing.push("patient.name");
 if(Number.isNaN(Date.parse(d.issuedAt)))missing.push("issuedAt");
 if(d.items.length===0)missing.push("items");
 d.items.forEach((it,i)=>{
  if(blank(it.genericName))missing.push(`items[${i}].genericName`);
  if(blank(it.dose))missing.push(`items[${i}].dose`);
  if(blank(it.route))missing.push(`items[${i}].route`);
  if(blank(it.frequency))missing.push(`items[${i}].frequency`);
  if(blank(it.duration))missing.push(`items[${i}].duration`); // RIS art. 30: tiempo de duración del tratamiento
 });
 return{ok:missing.length===0,missing};
}
// Texto en español de cada campo faltante (para el médico).
export const LEGAL_FIELD_LABEL_ES:Readonly<Record<string,string>>={
 "prescriber.fullName":"nombre completo del médico (perfil profesional)",
 "prescriber.cedulaProfesional":"cédula profesional válida de 7 u 8 dígitos (perfil profesional)",
 "prescriber.institution":"institución que expidió el título (perfil profesional)",
 "establishment.address":"domicilio del consultorio (configuración)",
 "establishment.phone":"teléfono del consultorio (configuración)",
 "patient.name":"nombre del paciente","issuedAt":"fecha de expedición","items":"al menos un medicamento prescrito",
};
export function describeMissing(missing:readonly string[]):string[]{
 return missing.map(m=>{const it=/^items\[(\d+)\]\.(\w+)$/.exec(m);if(it){const f:Record<string,string>={genericName:"denominación genérica",dose:"dosis",route:"vía",frequency:"frecuencia",duration:"duración del tratamiento"};return `medicamento ${Number(it[1])+1}: ${f[it[2]!]??it[2]}`;}return LEGAL_FIELD_LABEL_ES[m]??m;});
}

const esc=(s:string|number|undefined|null):string=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const fmtDate=(iso:string):string=>{const d=new Date(iso);if(Number.isNaN(d.getTime()))return esc(iso);return d.toLocaleString("es-MX",{timeZone:"America/Mexico_City",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});};
const SEX_ES:Record<string,string>={MALE:"Masculino",FEMALE:"Femenino",INTERSEX:"Intersexual",UNKNOWN:"No especificado"};

// HTML autocontenido de la receta. Determinista: el mismo dato produce el mismo HTML (sin fechas "ahora" ni aleatoriedad).
export function renderPrescriptionHtml(d:PrescriptionData):string{
 const p=d.prescriber,e=d.establishment,pt=d.patient;
 const items=d.items.map((it,i)=>{
  const legal=[isAntibiotic(it.classes)?"Antibiótico: venta exclusiva con receta; la farmacia la retiene o sella (Acuerdo DOF 27/05/2010).":"",
   isControlled(it.classes)?"Medicamento controlado: requiere receta especial con código de barras (LGS art. 241; RIS arts. 50–52). Esta impresión no la sustituye.":""].filter(Boolean);
  return `<li class="item"><div class="drug"><b>${i+1}. ${esc(it.genericName)}</b>${it.drugCode&&it.drugCode!==it.genericName?` <span class="muted">(${esc(it.drugCode)})</span>`:""}</div>
<div class="order">Dosis: <b>${esc(it.dose)}</b> · Vía: <b>${esc(it.route)}</b> · Frecuencia: <b>${esc(it.frequency)}</b> · Duración: <b>${esc(it.duration??"")}</b></div>
${it.indication?`<div class="muted">Indicación: ${esc(it.indication)}</div>`:""}
${it.override?`<div class="muted">Prescrito con anulación justificada de barrera(s): ${esc(it.override.barriers.join(", "))} (constancia en el expediente).</div>`:""}
${legal.map(l=>`<div class="legal">${esc(l)}</div>`).join("")}</li>`;}).join("\n");
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Receta ${esc(d.folio)}</title>
<style>
body{font-family:Georgia,"Times New Roman",serif;color:#111;margin:0;padding:24mm 18mm;font-size:12.5pt;line-height:1.35}
header{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
h1{font-size:15pt;margin:0 0 4px}.muted{color:#555;font-size:10.5pt}.legal{color:#7a2e2e;font-size:10pt;margin-top:2px}
.meta{display:flex;justify-content:space-between;gap:16px;margin:10px 0 14px}.box{border:1px solid #999;padding:8px 10px;border-radius:4px;flex:1}
ol{padding-left:0;list-style:none;margin:0}.item{padding:8px 0;border-bottom:1px dashed #bbb}.drug{font-size:13pt}.order{margin-top:2px}
footer{margin-top:36px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}.sig{border-top:1px solid #111;padding-top:6px;min-width:260px;text-align:center}
@media print{body{padding:16mm 14mm}@page{size:letter;margin:0}}
</style></head><body>
<header><div><h1>${esc(p.fullName)}</h1><div>${esc(p.specialty??"Medicina general")}${p.cedulaEspecialidad?` · Cédula de especialidad ${esc(p.cedulaEspecialidad)}`:""}</div>
<div>Cédula profesional <b>${esc(p.cedulaProfesional)}</b> · Título expedido por ${esc(p.institution)}</div></div>
<div style="text-align:right"><div><b>${esc(e.name)}</b></div><div class="muted">${esc(e.address)}</div><div class="muted">Tel. ${esc(e.phone)}</div></div></header>
<div class="meta"><div class="box"><div class="muted">Paciente</div><div><b>${esc(pt.name)}</b></div><div class="muted">${pt.ageYears!==undefined?`${esc(pt.ageYears)} años`:"Edad no registrada"}${pt.sexAtBirth?` · ${esc(SEX_ES[pt.sexAtBirth]??pt.sexAtBirth)}`:""}</div></div>
<div class="box"><div class="muted">Fecha de expedición</div><div><b>${esc(fmtDate(d.issuedAt))}</b></div><div class="muted">Folio ${esc(d.folio)}</div></div></div>
<ol>${items}</ol>
${d.notes?`<p class="muted">Indicaciones generales: ${esc(d.notes)}</p>`:""}
<footer><div class="muted">Receta generada electrónicamente a partir del expediente clínico. Válida con la firma autógrafa del médico que prescribe.</div>
<div class="sig">Firma autógrafa<br><b>${esc(p.fullName)}</b><br><span class="muted">Cédula profesional ${esc(p.cedulaProfesional)}</span></div></footer>
</body></html>`;
}
