// Obligaciones regulatorias del consultorio: periodicidad estructurada, cálculo del próximo vencimiento y catálogo de las
// obligaciones con nombre propio. Puro, sin PHI (es dominio administrativo del tenant, no del paciente).
//
// Auditoría 2026-09-19, anexo R02b (R2B-024) — CATEGORÍAS DE UN DESPLEGABLE, Y SOLO `CREATE`.
//
// Dos cosas. (1) Las «obligaciones» eran seis categorías genéricas —«Fiscal (SAT)», «Salud (COFEPRIS)», «Laboral»…— y no
// obligaciones nombradas: no se podía seleccionar NOM-004, NOM-024 ni el aviso de privacidad de la LFPDPPP, que SÍ existen en
// el repositorio pero en otra capa (`docs/compliance/README.md` y el registro de aplicabilidad) sin conexión con esta. (2) El
// archivo entero tenía UN handler, `handleRegulatoryObligationCreate`: una vez creada, no había forma de marcarla cumplida,
// adjuntar evidencia ni renovarla. Un registro de obligaciones en el que nada se puede cumplir no es seguimiento de
// cumplimiento: es una lista de pendientes que solo crece.
//
// SOBRE LOS PLAZOS, y esto es deliberado: aquí NO se inventa ninguna periodicidad normativa. Las periodicidades que una norma
// fija son un dato con fuente, y este paquete no la tiene para la mayoría; lo que se modela es el VOCABULARIO de periodicidad
// —para poder calcular el próximo vencimiento en vez de teclearlo— y, para cada obligación del catálogo, QUIÉN declara su
// plazo. Una obligación cuyo plazo depende del establecimiento se marca así, en lugar de atribuirle un número a una norma.
export type Periodicity="UNICA"|"MENSUAL"|"BIMESTRAL"|"TRIMESTRAL"|"SEMESTRAL"|"ANUAL"|"BIENAL"|"OTRA";
export const PERIODICITIES:readonly Periodicity[]=["UNICA","MENSUAL","BIMESTRAL","TRIMESTRAL","SEMESTRAL","ANUAL","BIENAL","OTRA"];
const MESES:Readonly<Record<Periodicity,number|null>>={
 UNICA:null,MENSUAL:1,BIMESTRAL:2,TRIMESTRAL:3,SEMESTRAL:6,ANUAL:12,BIENAL:24,OTRA:null,
};
export const PERIODICITY_LABEL:Readonly<Record<Periodicity,string>>={
 UNICA:"Única vez",MENSUAL:"Mensual",BIMESTRAL:"Bimestral",TRIMESTRAL:"Trimestral",
 SEMESTRAL:"Semestral",ANUAL:"Anual",BIENAL:"Bienal",OTRA:"Otra (plazo declarado)",
};

/**
 * Próximo vencimiento a partir del anterior y la periodicidad. Devuelve `null` cuando la periodicidad no define un intervalo
 * (`UNICA`, `OTRA`): en esos casos el plazo lo pone quien renueva, y adivinarlo sería inventarlo.
 *
 * Suma MESES de calendario, no 30 días: una obligación anual vence el mismo día del año siguiente, y un cálculo por días
 * desplaza la fecha en los años bisiestos. El desbordamiento de día (31 de enero + 1 mes) se ancla al último día del mes
 * destino en vez de saltar al mes siguiente, que es lo que hace `Date` por omisión y produciría un vencimiento equivocado.
 */
export function nextDueDate(previousDueDate:string,periodicity:Periodicity):string|null{
 const meses=MESES[periodicity];
 if(meses===null)return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(previousDueDate.trim());
 if(!m)throw new Error("REGULATORY_DUE_DATE_INVALID");
 const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
 const total=(y*12+(mo-1))+meses;
 const ny=Math.floor(total/12),nmo=(total%12)+1;
 const ultimoDia=new Date(Date.UTC(ny,nmo,0)).getUTCDate();
 const nd=Math.min(d,ultimoDia);
 return `${String(ny).padStart(4,"0")}-${String(nmo).padStart(2,"0")}-${String(nd).padStart(2,"0")}`;
}

/** Quién fija el plazo de una obligación: la norma, o el establecimiento. Es lo que evita atribuir un número a una norma. */
export type DeadlineAuthority="NORMA"|"ESTABLECIMIENTO";
export type ObligationTemplate=Readonly<{
 code:string;name:string;category:string;
 /** Periodicidad cuando la norma la fija; `null` cuando la declara el establecimiento. */
 periodicity:Periodicity|null;
 deadlineAuthority:DeadlineAuthority;
 /** De dónde sale la obligación. Nunca una guía inventada: o es una norma citable, o se dice que es criterio propio. */
 source:string;
}>;

/**
 * Catálogo de obligaciones con NOMBRE PROPIO, que es lo que el hallazgo echaba en falta frente a las seis categorías
 * genéricas. Incluye las tres normas que el propio repositorio ya declara aplicables en `docs/compliance/README.md`, para que
 * el seguimiento del consultorio y la matriz de cumplimiento dejen de vivir en capas incomunicadas.
 *
 * Ninguna entrada lleva un plazo que no pueda citar: donde la periodicidad concreta depende del establecimiento —porque la
 * norma describe una obligación permanente y no un trámite periódico— se declara `deadlineAuthority:"ESTABLECIMIENTO"` y
 * `periodicity:null`. Añadir aquí una periodicidad normativa exige la cita, no la costumbre.
 */
export const OBLIGATION_CATALOG:readonly ObligationTemplate[]=[
 {code:"NOM-004-SSA3-2012",name:"Expediente clínico conforme a NOM-004",category:"Salud (COFEPRIS)",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"NOM-004-SSA3-2012, del expediente clínico. Obligación permanente: el establecimiento fija su calendario de revisión."},
 {code:"NOM-024-SSA3-2012",name:"Interoperabilidad e intercambio de información (SIRES)",category:"Salud (COFEPRIS)",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"NOM-024-SSA3-2012. Obligación permanente: el establecimiento fija su calendario de revisión."},
 {code:"LFPDPPP-AVISO",name:"Aviso de privacidad vigente y a la vista",category:"Administrativa",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"LFPDPPP y su reglamento. El aviso debe estar vigente; la periodicidad de revisión la declara el establecimiento."},
 {code:"COFEPRIS-AVISO-FUNCIONAMIENTO",name:"Aviso de funcionamiento del establecimiento",category:"Salud (COFEPRIS)",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"Aviso de funcionamiento ante COFEPRIS. Se actualiza ante cambios; el establecimiento declara su revisión."},
 {code:"SAT-DECLARACION",name:"Declaración ante el SAT",category:"Fiscal (SAT)",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"Obligaciones fiscales del contribuyente. La periodicidad depende del régimen: la declara el establecimiento con su contador."},
 {code:"PROTECCION-CIVIL-PROGRAMA",name:"Programa interno de protección civil",category:"Protección civil",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"Normativa local de protección civil, que varía por entidad: el plazo lo declara el establecimiento."},
 {code:"OTRA",name:"Otra obligación declarada por el consultorio",category:"Otros",
  periodicity:null,deadlineAuthority:"ESTABLECIMIENTO",
  source:"Obligación propia del establecimiento, sin norma citada."},
];
export const obligationTemplate=(code:string):ObligationTemplate|undefined=>OBLIGATION_CATALOG.find(o=>o.code===code);

/** Estados de una obligación en el registro. `COMPLIED` no es terminal: una obligación periódica se renueva desde ahí. */
export type ObligationState="OPEN"|"COMPLIED"|"WAIVED";
export type ObligationEventKind="CREATED"|"COMPLIED"|"RENEWED"|"WAIVED";
const ALLOWED:Readonly<Record<ObligationState,readonly ObligationState[]>>={
 // Cumplir no cierra el ciclo: renovar devuelve la obligación a OPEN con el siguiente vencimiento.
 OPEN:["COMPLIED","WAIVED"],COMPLIED:["OPEN"],WAIVED:[],
};
export function assertObligationTransition(from:ObligationState,to:ObligationState):void{
 if(!ALLOWED[from].includes(to))throw new Error(`REGULATORY_ILLEGAL_TRANSITION:${from}->${to}`);
}

export const REGULATORY_OBLIGATIONS_LIMITS=
 "Se modelan el vocabulario de periodicidad, el cálculo del próximo vencimiento y el ciclo cumplir/renovar/exentar con "+
 "evidencia. NO se modelan los plazos normativos concretos: las obligaciones del catálogo que corresponden a normas "+
 "permanentes (NOM-004, NOM-024, aviso de privacidad) declaran explícitamente que su calendario de revisión lo fija el "+
 "establecimiento, porque atribuirle a una norma una periodicidad que no publica sería inventarla. Tampoco se verifica el "+
 "CONTENIDO del cumplimiento —que el aviso de privacidad diga lo que debe decir, que la declaración fiscal sea correcta—: "+
 "se registra que alguien declaró el cumplimiento, con quién, cuándo y con qué evidencia adjunta.";
