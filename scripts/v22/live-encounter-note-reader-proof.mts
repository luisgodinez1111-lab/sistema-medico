// Auditoría clínica multiespecialidad (06-oct-2026) — EVIDENCIA FÍSICA: LA NOTA FIRMADA SE PUEDE LEER.
//
// EL HALLAZGO que cuatro especialistas pusieron en primer lugar POR SEPARADO (medicina interna, urgencias, medicina familiar
// y oncología): el texto de la consulta se escribía en `ENCOUNTER_ASSESSED`, se firmaba por hash y NINGUNA ruta lo devolvía.
// El médico familiar: «volteo la hoja de papel y leo lo que escribí hace tres meses en dos segundos; aquí ese acto no tiene
// ruta». El oncólogo: «la nota que un médico firma no puede volver a leerse jamás por ninguna ruta — eso solo ya lo
// descalifica para un paciente crónico».
//
// Esta prueba ejercita el ciclo COMPLETO contra PostgreSQL real: abrir dos consultas del mismo paciente, documentarlas,
// firmar una, y después LEERLAS — el índice con fechas y el texto de cada una. Y comprueba las tres propiedades que hacen
// que esto sea un expediente y no un formulario: que el texto vuelva íntegro, que la firma viaje con él, y que leer PHI
// quede registrado.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{freshPatient}=await import("./_patient.mts");
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts");
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{directEndpoint}=await import("../../packages/pg-endpoint/src");
const postgres=(await import("postgres")).default;
const encR=await import("../../apps/web/app/api/v1/encounters/route");
const assessR=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const signR=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const noteR=await import("../../apps/web/app/api/v1/encounters/[encounterId]/note/route");
const listR=await import("../../apps/web/app/api/v1/patients/[patientId]/encounters/route");
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SUB=crypto.randomUUID();
function tok(scopes=["patient:read","patient:write","encounter:write"],sub=SUB){
 return signSession({sub,tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PE=(id:string)=>({params:Promise.resolve({encounterId:id})});
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
const idem=()=>crypto.randomUUID();
const sha256=(s:string)=>crypto.createHash("sha256").update(s).digest("hex");
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}

// Dos notas con texto DISTINTO y reconocible: lo que se lee tiene que ser lo que se escribió, no «una nota».
const NOTA_1={assessment:"Hipertensión esencial en control. TA 128/82 hoy, mejor que 148/94 de la visita previa.",
 plan:"Continuar losartán 50 mg cada 24 h. Dieta hiposódica. Control en 3 meses con creatinina y potasio."};
const NOTA_2={assessment:"Acude por tos seca de 5 días, sin fiebre ni disnea. Exploración pulmonar sin alteraciones.",
 plan:"Manejo sintomático. Signos de alarma explicados. Volver si fiebre o dificultad respiratoria."};

async function abrir(t:string,patientId:string,at:string):Promise<string>{
 const id=crypto.randomUUID();
 const r=await encR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),
  body:JSON.stringify({encounterId:id,patientId,occurredAt:at})}));
 if(r.status>=400)throw new Error(`ABRIR_${r.status}:${JSON.stringify(await r.json())}`);
 return id;
}
async function documentar(t:string,encounterId:string,v:number,nota:{assessment:string;plan:string},at:string){
 return assessR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),
  body:JSON.stringify({...nota,occurredAt:at})}),PE(encounterId));
}

try{
 const phys=tok();
 await registerPhysicianCredentials(phys); // L-05: sin cédula registrada no se firma
 const pat=await freshPatient(TA);

 // ── Dos consultas del MISMO paciente, en fechas distintas ────────────────────────────────────────────────────────────
 const e1=await abrir(phys,pat,"2026-07-14T10:00:00.000Z");
 ok((await documentar(phys,e1,1,NOTA_1,"2026-07-14T10:20:00.000Z")).status===201,"CONSULTA_1_DOCUMENTADA");
 const firma=await signR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),
  body:JSON.stringify({occurredAt:"2026-07-14T10:25:00.000Z",contentHash:sha256(`${NOTA_1.assessment}\n${NOTA_1.plan}`)})}),PE(e1));
 ok(firma.status===201,`CONSULTA_1_FIRMADA:${firma.status} ${firma.status>=400?JSON.stringify(await firma.json()):""}`);

 const e2=await abrir(phys,pat,"2026-10-02T09:00:00.000Z");
 ok((await documentar(phys,e2,1,NOTA_2,"2026-10-02T09:15:00.000Z")).status===201,"CONSULTA_2_DOCUMENTADA");

 // ── EL ÍNDICE: qué consultas existen, con sus fechas ─────────────────────────────────────────────────────────────────
 const lista=await listR.GET(new Request("http://l/",{headers:H(phys)}),PP(pat));
 ok(lista.status===200,`INDICE_200:${lista.status}`);
 const lb=await lista.json() as{items:{encounterId:string;openedAt:string;signedAt:string|null;hasNote:boolean;status:string}[]};
 ok(lb.items.length===2,`INDICE_LISTA_LAS_DOS_CONSULTAS:${lb.items.length}`);
 // El orden es de la más reciente a la más antigua: en una consulta se busca «la vez pasada», no «la primera de su vida».
 ok(lb.items[0]!.encounterId===e2&&lb.items[1]!.encounterId===e1,"INDICE_ORDENADO_DE_LA_MAS_RECIENTE");
 // LAS FECHAS, que es lo que el expediente no tenía en ninguna parte.
 ok(lb.items[1]!.openedAt.startsWith("2026-07-14"),`INDICE_TRAE_LA_FECHA:${lb.items[1]!.openedAt}`);
 ok(lb.items[1]!.signedAt!==null&&lb.items[0]!.signedAt===null,"INDICE_DISTINGUE_FIRMADA_DE_ABIERTA");
 ok(lb.items.every(i=>i.hasNote),"INDICE_DISTINGUE_DOCUMENTADA_DE_VACIA");

 // ── EL TEXTO: lo que el médico escribió, íntegro ─────────────────────────────────────────────────────────────────────
 const n1=await noteR.GET(new Request("http://l/",{headers:H(phys)}),PE(e1));
 ok(n1.status===200,`NOTA_200:${n1.status}`);
 const nb=await n1.json() as{assessment:string|null;plan:string|null;signedAt:string|null;signatureDigest:string|null;
  contentHash:string|null;signer:{fullName?:string;cedulaProfesional?:string}|null;patientId:string;openedAt:string};
 ok(nb.assessment===NOTA_1.assessment,"LA_VALORACION_VUELVE_INTEGRA");
 ok(nb.plan===NOTA_1.plan,"EL_PLAN_VUELVE_INTEGRO");
 ok(nb.patientId===pat,"LA_NOTA_DICE_DE_QUE_PACIENTE_ES");
 ok(nb.openedAt.startsWith("2026-07-14"),`LA_NOTA_TRAE_SU_FECHA:${nb.openedAt}`);
 // LA FIRMA viaja con la nota: sin ella, leer el texto no dice si es un borrador o un documento médico-legal.
 ok(nb.signedAt!==null&&nb.signatureDigest!==null,"LA_FIRMA_VIAJA_CON_LA_NOTA");
 ok(nb.contentHash===sha256(`${NOTA_1.assessment}\n${NOTA_1.plan}`),"LA_HUELLA_CORRESPONDE_AL_TEXTO_QUE_SE_LEE");
 // Y la identidad legal del firmante: una nota sin firmante identificado no sirve médico-legalmente.
 ok(!!nb.signer&&!!nb.signer.fullName&&!!nb.signer.cedulaProfesional,`EL_FIRMANTE_ESTA_IDENTIFICADO:${JSON.stringify(nb.signer)}`);

 // La segunda, sin firmar, se lee igual: durante la consulta el médico necesita ver su propio borrador.
 const n2=await noteR.GET(new Request("http://l/",{headers:H(phys)}),PE(e2));
 const nb2=await n2.json() as{assessment:string|null;signedAt:string|null;status:string};
 ok(nb2.assessment===NOTA_2.assessment&&nb2.signedAt===null,"UNA_NOTA_SIN_FIRMAR_TAMBIEN_SE_LEE");
 // Y las dos notas son DISTINTAS: una lectura que devolviera siempre la última sería peor que no leer.
 ok(nb.assessment!==nb2.assessment,"CADA_CONSULTA_DEVUELVE_SU_PROPIO_TEXTO");

 // ── LEER PHI QUEDA REGISTRADO ────────────────────────────────────────────────────────────────────────────────────────
 const accesos=await sql`select count(*)::int as n from phi_access_log
  where tenant_id=${TA} and resource_type='ENCOUNTER_NOTE' and resource_id=${e1} and patient_id=${pat}`;
 ok(Number(accesos[0]!.n)>=1,`EL_ACCESO_A_LA_NOTA_QUEDA_REGISTRADO:${accesos[0]!.n}`);
 // El `actor_id` es un uuid DERIVADO del sujeto OIDC, no el sujeto en claro (R01-015: mismo sujeto ⇒ mismo actor, sin
 // guardar el identificador del IdP en la base). Así que la invariante no es «es igual al sub», sino que sea el MISMO que
 // el derivado y que se repita entre lecturas del mismo médico: sin eso no se podría atribuir un acceso a nadie.
 const{subjectToActorId}=await import("../../packages/http-principal/src");
 const conActor=await sql`select actor_id,purpose,action,session_id from phi_access_log
  where tenant_id=${TA} and resource_type='ENCOUNTER_NOTE' and resource_id=${e1} limit 1`;
 ok(String(conActor[0]!.actor_id)===subjectToActorId(SUB),`EL_REGISTRO_ATRIBUYE_EL_ACCESO_AL_MEDICO:${conActor[0]!.actor_id}`);
 ok(String(conActor[0]!.purpose)==="TREATMENT"&&String(conActor[0]!.action)==="READ",
  `EL_REGISTRO_DICE_CON_QUE_PROPOSITO:${JSON.stringify(conActor[0])}`);
 ok(conActor[0]!.session_id!==null,"EL_REGISTRO_GUARDA_LA_SESION_DESDE_LA_QUE_SE_LEYO");
 // Una segunda lectura añade OTRO registro: el log cuenta accesos, no «si alguna vez se leyó».
 await noteR.GET(new Request("http://l/",{headers:H(phys)}),PE(e1));
 const dos=await sql`select count(*)::int as n from phi_access_log
  where tenant_id=${TA} and resource_type='ENCOUNTER_NOTE' and resource_id=${e1}`;
 ok(Number(dos[0]!.n)>=2,`CADA_LECTURA_SE_REGISTRA:${dos[0]!.n}`);

 // ── BARRERAS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 // Un encuentro inexistente es 404, no una nota vacía: «no hay nota» y «no existe la consulta» son cosas distintas.
 ok((await noteR.GET(new Request("http://l/",{headers:H(phys)}),PE(crypto.randomUUID()))).status===404,"CONSULTA_INEXISTENTE_404");
 // Sin scope de lectura de paciente, no se lee la nota de nadie.
 const sinScope=tok(["encounter:write"]);
 ok((await noteR.GET(new Request("http://l/",{headers:H(sinScope)}),PE(e1))).status===403,"SIN_SCOPE_403");
 ok((await listR.GET(new Request("http://l/",{headers:H(sinScope)}),PP(pat))).status===403,"INDICE_SIN_SCOPE_403");
 // Cross-tenant: la nota de otro consultorio no existe para este.
 const otro=signSession({sub:crypto.randomUUID(),tenantId:crypto.randomUUID(),roles:["PHYSICIAN"],
  scopes:["patient:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
 ok((await noteR.GET(new Request("http://l/",{headers:H(otro)}),PE(e1))).status===404,"CROSS_TENANT_404");
 const listaOtro=await listR.GET(new Request("http://l/",{headers:H(otro)}),PP(pat));
 const lo=await listaOtro.json() as{items:unknown[]};
 ok(listaOtro.status===200&&lo.items.length===0,"INDICE_CROSS_TENANT_VACIO");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await sql.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
