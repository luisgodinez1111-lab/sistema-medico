import{describe,it,expect}from"vitest";
import{API_BODY_SCHEMAS}from"../../apps/web/lib/api-body-registry";
import*as S from"../../apps/web/app/workspace/shared";
// Auditoría clínica multiespecialidad (06-oct-2026) — LOS BOTONES DE LA UI ENVIABAN CUERPOS QUE EL SERVIDOR YA RECHAZABA.
//
// EL HALLAZGO, encontrado por la auditoría quirúrgica y confirmado línea por línea: al endurecer las barreras de transfusión
// (lote 15, R2B-017) y de cirugía (lote 16, R2B-018) se actualizaron las PRUEBAS EN VIVO —que mandan el cuerpo correcto— y
// NO los constructores de acciones de la pantalla, que seguían enviando `{occurredAt}` a secas. Resultado: el botón
// «Time-out OMS» y el botón «Cruzar (crossmatch)» devolvían 400 VALIDATION_ERROR. Lo mismo el «Otorgar» del consentimiento,
// que es el único de los cuatro ALCANZABLE hoy —las verticales hospitalarias están tras bandera—: enviaba
// `{signerName:"Paciente/Tutor"}` cuando el servidor exige además la huella sha256 del documento y el método.
//
// POR QUÉ NINGÚN GATE LO VIO. `route-coverage` exige que CADA ruta la ejercite una prueba en vivo, y lo hacen: la prueba
// manda el cuerpo bueno. Nadie comprobaba el cruce UI↔esquema. Es el mismo patrón que esta campaña viene documentando —el
// defecto vive entre el primitivo y su punto de integración— y aquí el «primitivo» es el esquema del servidor y el «punto de
// integración» es el botón que un médico pulsa.
//
// ESTE TEST CIERRA ESE HUECO: recorre los constructores de acciones de `shared.tsx`, toma el cuerpo que cada uno produce y lo
// valida contra el MISMO esquema zod que el handler usa, leído del registro generado. Un endurecimiento futuro del servidor
// que olvide la pantalla rompe aquí, no en la cara de un médico.

/** Marcador de campo pendiente de preguntar al usuario (`ASK`): la pantalla lo resuelve antes de enviar. */
const esAsk=(v:unknown):boolean=>typeof v==="object"&&v!==null&&"__ask" in (v as Record<string,unknown>);
/**
 * Sustituye los marcadores `ASK` por un valor plausible del tipo que el esquema espera. Lo que se valida es la FORMA del
 * cuerpo, no lo que el usuario teclea: si falta una clave entera, el esquema la rechaza igual con marcador o sin él.
 */
function resolverAsks(body:Record<string,unknown>):Record<string,unknown>{
 const out:Record<string,unknown>={};
 for(const[k,v]of Object.entries(body))out[k]=esAsk(v)?"texto que el clínico escribe":v;
 return out;
}
/** Convierte la ruta concreta en la plantilla del registro: los uuid vuelven a ser `[param]`. */
function plantilla(path:string):string{
 return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,"/[id]");
}
/** Busca el esquema del registro para un POST, tolerando el nombre del parámetro de ruta. */
function esquemaDe(path:string):{clave:string;schema:{safeParse:(x:unknown)=>{success:boolean;error?:unknown}}}|null{
 const objetivo=plantilla(path);
 for(const[clave,schema] of Object.entries(API_BODY_SCHEMAS as Record<string,unknown>)){
  if(!clave.startsWith("POST "))continue;
  const ruta=clave.slice(5);
  // El registro escribe los parámetros en estilo OpenAPI (`{medicationId}`); la UI construye rutas con uuid. Se normalizan
  // los dos lados al mismo marcador.
  if(ruta.replace(/\{[^}]+\}/g,"[id]").replace(/\[[^\]]+\]/g,"[id]")===objetivo)
   return{clave,schema:schema as{safeParse:(x:unknown)=>{success:boolean;error?:unknown}}};
 }
 return null;
}

/**
 * BOTONES ROTOS CONOCIDOS, declarados con su origen. Mismo patrón que las tablas no insertables de la prueba de RLS: la deuda
 * se NOMBRA en el código en vez de esconderse, el guardarraíl protege de regresiones nuevas desde hoy, y arreglar uno exige
 * quitarlo de aquí — así la lista no puede envejecer en silencio.
 *
 * Los seis primeros los introduje al endurecer las barreras (lotes 15, 16 y 19) sin actualizar la pantalla; los dos últimos
 * son anteriores. Cinco están tras la bandera hospitalaria (404 en el borde, no alcanzables hoy); **«Otorgar» del
 * consentimiento y «Enmendar» de signos vitales SÍ están vivos** y son los primeros que hay que arreglar.
 *
 * Arreglarlos no es rellenar el cuerpo con literales —eso sería el lote de vacuna fabricado otra vez—: cada uno necesita su
 * formulario, como el del algoritmo ESI del triage.
 */
const ROTOS_CONOCIDOS:readonly{boton:string;ruta:RegExp;falta:string;origen:string;vivo:boolean}[]=[
 {boton:"Time-out OMS",ruta:/surgeries\/\{[^}]+\}\/timeout/,falta:"los 9 ítems del Time Out de la OMS",origen:"lote 16 (R2B-018)",vivo:false},
 {boton:"Completar",ruta:/surgeries\/\{[^}]+\}\/completion/,falta:"los 6 ítems del Sign Out",origen:"lote 16 (R2B-018)",vivo:false},
 {boton:"Cruzar (crossmatch)",ruta:/transfusions\/\{[^}]+\}\/crossmatch/,falta:"grupos del receptor y la unidad, número de unidad y dos verificadores",origen:"lote 15 (R2B-017)",vivo:false},
 {boton:"Iniciar",ruta:/dialysis-sessions\/\{[^}]+\}\/start/,falta:"peso pre-diálisis",origen:"lote 19 (R2B-020)",vivo:false},
 {boton:"Completar",ruta:/dialysis-sessions\/\{[^}]+\}\/completion/,falta:"peso post y duración real",origen:"lote 19 (R2B-020)",vivo:false},
 {boton:"Interrumpir",ruta:/dialysis-sessions\/\{[^}]+\}\/interruption/,falta:"la causa estructurada",origen:"lote 19 (R2B-020)",vivo:false},
 {boton:"Otorgar",ruta:/consents\/\{[^}]+\}\/grant/,falta:"huella sha256 del documento presentado y método de otorgamiento",origen:"anterior a esta campaña",vivo:true},
 {boton:"Enmendar",ruta:/vitals\/\{[^}]+\}\/amendment/,falta:"el valor corregido y su unidad (hoy solo pregunta el motivo)",origen:"anterior a esta campaña",vivo:true},
];
const esConocido=(clave:string,boton:string):boolean=>
 ROTOS_CONOCIDOS.some(r=>r.boton===boton&&r.ruta.test(clave));

const UUID="11111111-1111-4111-8111-111111111111";
/** Cada constructor de acciones con un estado de entrada representativo por transición. */
const CONSTRUCTORES:readonly{nombre:string;acciones:()=>readonly{label:string;path:string;body:Record<string,unknown>}[]}[]=[
 {nombre:"medNext",acciones:()=>["PROPOSED","PRESCRIBED","ACTIVE"].flatMap(st=>{const a=S.medNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"resNext",acciones:()=>["RECEIVED","VERIFIED","CRITICAL_FLAGGED"].flatMap(st=>{const a=S.resNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"docNext",acciones:()=>["DRAFT","FINAL"].flatMap(st=>{const a=S.docNext({id:UUID,state:st as never,title:"x"} as never);return a?[a]:[];})},
 {nombre:"orderNext",acciones:()=>["DRAFT","ORDERED"].flatMap(st=>{const a=S.orderNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"referralNext",acciones:()=>["REQUESTED","ACCEPTED"].flatMap(st=>{const a=S.referralNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"apptNext",acciones:()=>["SCHEDULED","CHECKED_IN"].flatMap(st=>{const a=S.apptNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"sgNext",acciones:()=>["SCHEDULED","TIMED_OUT","IN_PROGRESS"].flatMap(st=>{const a=S.sgNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"tfNext",acciones:()=>["ORDERED","CROSSMATCHED","TRANSFUSING"].flatMap(st=>{const a=S.tfNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"spNext",acciones:()=>["COLLECTED","IN_TRANSIT","RECEIVED"].flatMap(st=>{const a=S.spNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"obNext",acciones:()=>["OPEN","IN_PROGRESS"].flatMap(st=>{const a=S.obNext({id:UUID,state:st as never,label:"x"} as never);return a?[a]:[];})},
 {nombre:"alActions",acciones:()=>["ACTIVE"].flatMap(st=>S.alActions({id:UUID,state:st as never} as never))},
 {nombre:"probActions",acciones:()=>["ACTIVE","CHRONIC"].flatMap(st=>S.probActions({id:UUID,state:st as never} as never))},
 {nombre:"immActions",acciones:()=>["DUE","ADMINISTERED"].flatMap(st=>S.immActions({id:UUID,state:st as never} as never))},
 {nombre:"vitActions",acciones:()=>["RECORDED"].flatMap(st=>S.vitActions({id:UUID,state:st as never} as never))},
 {nombre:"cpActions",acciones:()=>["PROPOSED","ACTIVE"].flatMap(st=>S.cpActions({id:UUID,state:st as never} as never))},
 {nombre:"clmActions",acciones:()=>["DRAFTED","CODED","SUBMITTED"].flatMap(st=>S.clmActions({id:UUID,state:st as never} as never))},
 {nombre:"csActions",acciones:()=>["DRAFTED","PRESENTED","GRANTED"].flatMap(st=>S.csActions({id:UUID,state:st as never} as never))},
 {nombre:"admActions",acciones:()=>["ADMITTED"].flatMap(st=>S.admActions({id:UUID,state:st as never} as never))},
 {nombre:"incActions",acciones:()=>["REPORTED","UNDER_REVIEW","ESCALATED"].flatMap(st=>S.incActions({id:UUID,state:st as never} as never))},
 {nombre:"trActions",acciones:()=>["WAITING","IN_TRIAGE","TRIAGED"].flatMap(st=>S.trActions({id:UUID,state:st as never} as never))},
 {nombre:"wnActions",acciones:()=>["OPEN"].flatMap(st=>S.wnActions({id:UUID,state:st as never} as never))},
 {nombre:"dzActions",acciones:()=>["SCHEDULED","IN_SESSION","INTERRUPTED"].flatMap(st=>S.dzActions({id:UUID,state:st as never} as never))},
];

describe("la deuda de botones rotos está acotada y nombrada",()=>{
 it("son OCHO, dos de ellos alcanzables hoy, y cada uno dice qué le falta y de dónde viene",()=>{
  expect(ROTOS_CONOCIDOS.length,"si la lista crece, alguien rompió otro botón sin arreglarlo").toBe(8);
  expect(ROTOS_CONOCIDOS.filter(r=>r.vivo).length,"los vivos son el consentimiento y la enmienda de signos vitales").toBe(2);
  for(const r of ROTOS_CONOCIDOS){
   expect(r.falta.length,`${r.boton}: sin decir qué falta, la entrada no sirve`).toBeGreaterThan(15);
   expect(r.origen.length,`${r.boton}: sin origen no hay a quién preguntar`).toBeGreaterThan(5);
  }
 });
});

describe("el cuerpo que la UI envía satisface el esquema que el servidor exige",()=>{
 it("el registro de cuerpos está cargado y tiene rutas POST",()=>{
  const claves=Object.keys(API_BODY_SCHEMAS as Record<string,unknown>).filter(k=>k.startsWith("POST "));
  expect(claves.length,"sin registro no hay nada que comprobar").toBeGreaterThan(50);
 });

 // Cada constructor se comprueba por separado para que el fallo nombre al culpable, no a «la UI».
 for(const c of CONSTRUCTORES){
  it(`${c.nombre}: cada transición manda un cuerpo válido`,()=>{
   const acciones=c.acciones();
   expect(acciones.length,`${c.nombre} no produjo ninguna acción: ¿cambiaron los estados?`).toBeGreaterThan(0);
   const rotas:string[]=[];
   const sinEsquema:string[]=[];
   // Un botón declarado roto que YA funciona tiene que salir de la lista: si no, la lista se convierte en una exención que
   // nadie revisa, que es el defecto que esta campaña corrige en todas sus formas.
   const reparados=new Set<string>();
   for(const a of acciones){
    const e=esquemaDe(a.path);
    if(!e){sinEsquema.push(`${a.label} → ${plantilla(a.path)}`);continue;}
    const r=e.schema.safeParse(resolverAsks(a.body));
    if(!r.success){
     const faltan=(r.error as{issues?:{path:(string|number)[];message:string}[]}).issues?.map(i=>i.path.join(".")||"(raíz)").join(", ")??"?";
     // Un roto DECLARADO no tumba la suite, pero queda contado; uno NUEVO sí la tumba, que es para lo que existe el gate.
     if(!esConocido(e.clave,a.label))rotas.push(`«${a.label}» → ${e.clave} · falta/inválido: ${faltan}`);
     else reparados.delete(`${a.label}|${e.clave}`);
    }else if(esConocido(e.clave,a.label))reparados.add(`${a.label}|${e.clave}`);
   }
   // Una ruta sin esquema en el registro es un hueco del propio registro, y se nombra aparte para no confundirlo con un
   // cuerpo mal formado.
   expect(sinEsquema,`${c.nombre}: rutas que el registro de cuerpos no conoce`).toEqual([]);
   expect(rotas,`${c.nombre}: la pantalla manda cuerpos que el servidor RECHAZA (400) — un botón muerto en la cara del médico`).toEqual([]);
   expect([...reparados],`${c.nombre}: estos botones YA funcionan y siguen declarados como rotos — quítalos de ROTOS_CONOCIDOS`).toEqual([]);
  });
 }
});
