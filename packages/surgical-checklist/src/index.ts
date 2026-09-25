// Checklist de seguridad quirúrgica de la OMS: los ítems del Time Out y del Sign Out como datos obligatorios, no como una
// transición vacía. Puro, sin PHI (recibe confirmaciones y lateralidad, nunca identidad del paciente).
//
// Auditoría 2026-09-19, anexo R02b (R2B-018) — EL «TIME-OUT OMS» ERA UNA TRANSICIÓN DE ESTADO VACÍA, EN PRODUCCIÓN.
//
// `handleSurgeryTimeout` emitía `{kind:"TIMEOUT_COMPLETED"}` y nada más: un sello de tiempo sin un solo ítem del checklist.
// El fold declaraba en su cabecera «TIMED_OUT = time-out quirúrgico (checklist OMS) completado: barrera de seguridad
// obligatoria para iniciar», y el dossier de adjudicación lo aprobaba como «cirugía segura con time-out OMS». El código no
// sostenía ninguna de las dos afirmaciones: cualquiera con rol PHYSICIAN podía «completar» el time-out sin declarar nada, y
// ni siquiera se releía la `laterality` que sí se había capturado al agendar. La secuencia SÍ estaba bien forzada (no se
// puede iniciar sin pasar por TIMED_OUT); el problema era de CONTENIDO.
//
// FUENTE. OMS, «Surgical Safety Checklist» (1.ª edición 2008; edición revisada 2009, la vigente) y el manual de
// implementación «Implementation Manual WHO Surgical Safety Checklist 2009: Safe Surgery Saves Lives». La lista original
// tiene 19 ítems en tres fases —Sign In (antes de la inducción anestésica), Time Out (antes de la incisión) y Sign Out
// (antes de que el paciente salga del quirófano)—. Aquí se modelan las fases que el ciclo de vida puede sostener HOY con lo
// que el sistema sabe: el Time Out completo y el Sign Out completo. El Sign In pertenece a anestesia, que este sistema no
// modela (no hay registro anestésico), y por eso NO se finge: se declara en LIMITES.
//
// QUÉ ES BARRERA Y QUÉ ES REGISTRO. La OMS misma es explícita en que el checklist es una ayuda verbal en equipo, no un
// formulario: su valor está en que alguien lea en voz alta y el equipo responda. El software no puede comprobar que eso
// ocurrió. Lo que SÍ puede comprobar —y lo que aquí se comprueba— es que (a) no falte ningún ítem, (b) la lateralidad y el
// procedimiento confirmados en el quirófano COINCIDAN con los agendados, que es la barrera contra la cirugía en el sitio
// equivocado, y (c) el conteo de instrumental y gasas del Sign Out sea correcto antes de cerrar. Lo demás es registro
// fiable: queda en el event store con quién lo declaró, que es lo que una investigación posterior necesita.
export type Laterality="LEFT"|"RIGHT"|"BILATERAL"|"NA";
export type AntibioticProphylaxis="GIVEN_WITHIN_60_MIN"|"NOT_INDICATED"|"NOT_GIVEN";
export type CountStatus="CORRECT"|"INCORRECT"|"NOT_APPLICABLE";

/**
 * Ítems del TIME OUT (antes de la incisión). Cada booleano es una confirmación del equipo: «false» no es «desconocido», es
 * «no confirmado», y no confirmado bloquea. Por eso no hay opcionales: un checklist con huecos no es un checklist.
 */
export type TimeOutItems=Readonly<{
 /** Todo el equipo se presentó por nombre y función (ítem 5 de la lista de 2009). */
 teamIntroduced:boolean;
 /** Confirmación verbal EN EQUIPO de paciente, sitio y procedimiento (ítem 6). Se confirma además contra lo agendado. */
 patientConfirmed:boolean;
 procedureConfirmed:string;
 lateralityConfirmed:Laterality;
 /** Sitio quirúrgico marcado, o marcado no aplicable (ítem del Sign In que el Time Out vuelve a confirmar). */
 siteMarked:boolean;
 /** Profilaxis antibiótica en los últimos 60 minutos, o no indicada (ítem 7). */
 antibioticProphylaxis:AntibioticProphylaxis;
 /** Eventos críticos previstos: cirujano, anestesia y enfermería declararon sus preocupaciones (ítems 8-10). */
 criticalEventsReviewed:boolean;
 /** Imágenes esenciales disponibles y desplegadas, o no requeridas (ítem 11). */
 imagingAvailable:boolean;
 /** Quién dirigió el time-out: la OMS recomienda un coordinador único. Nombre o identificador, no vacío. */
 ledBy:string;
}>;

/** Ítems del SIGN OUT (antes de que el paciente salga del quirófano; ítems 12-19 de la lista de 2009). */
export type SignOutItems=Readonly<{
 /** La enfermera confirma en voz alta el nombre del procedimiento REALMENTE realizado (puede diferir del agendado). */
 procedurePerformed:string;
 /** Conteo de instrumental, gasas y agujas: correcto, incorrecto o no aplicable. Incorrecto BLOQUEA el cierre. */
 instrumentCount:CountStatus;
 spongeCount:CountStatus;
 needleCount:CountStatus;
 /** Muestras etiquetadas con nombre del paciente leído en voz alta, o sin muestras. */
 specimensLabelled:boolean;
 /** Problemas con equipo o instrumental a resolver, si hubo. Texto libre porque es una nota, no una decisión. */
 equipmentIssues:string;
 /** Preocupaciones clave para la recuperación y el manejo postoperatorio: declaradas por el equipo. */
 recoveryConcernsReviewed:boolean;
}>;

export type ChecklistVerdict=Readonly<{ok:boolean;blockers:readonly string[]}>;

/** Lo agendado, contra lo que se compara lo confirmado en quirófano. Es la barrera contra el sitio/procedimiento equivocado. */
export type ScheduledSurgery=Readonly<{procedure:string;laterality:string}>;

const normalizar=(s:string):string=>s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ");

/**
 * Verifica el TIME OUT contra lo agendado. Devuelve TODOS los bloqueos, no el primero: en un quirófano, enterarse de un
 * problema a la vez obliga a repetir el ciclo tantas veces como problemas haya.
 */
export function verifyTimeOut(items:TimeOutItems,scheduled:ScheduledSurgery):ChecklistVerdict{
 const blockers:string[]=[];
 if(!items.teamIntroduced)blockers.push("EQUIPO_NO_PRESENTADO: la lista de la OMS empieza porque cada miembro diga su nombre y función");
 if(!items.patientConfirmed)blockers.push("IDENTIDAD_NO_CONFIRMADA: el equipo debe confirmar en voz alta la identidad del paciente");
 if(!items.siteMarked)blockers.push("SITIO_NO_MARCADO: el sitio quirúrgico debe estar marcado antes de la incisión");
 if(!items.criticalEventsReviewed)blockers.push("EVENTOS_CRITICOS_NO_REVISADOS: cirujano, anestesia y enfermería deben declarar sus previsiones");
 if(!items.imagingAvailable)blockers.push("IMAGENES_NO_DISPONIBLES: las imágenes esenciales deben estar desplegadas, o declararse no requeridas");
 if(items.antibioticProphylaxis==="NOT_GIVEN")blockers.push("PROFILAXIS_ANTIBIOTICA_NO_ADMINISTRADA: administrar en los 60 min previos o declararla no indicada");
 if(items.ledBy.trim().length===0)blockers.push("TIME_OUT_SIN_COORDINADOR: alguien tiene que dirigirlo y quedar registrado");
 // LA BARRERA CENTRAL: lo confirmado en quirófano contra lo agendado. Un desacuerdo aquí es el mecanismo exacto de la
 // cirugía en el sitio o el lado equivocado, que es el error quirúrgico prevenible por excelencia.
 if(normalizar(items.procedureConfirmed)!==normalizar(scheduled.procedure))
  blockers.push(`PROCEDIMIENTO_DISTINTO_AL_AGENDADO: confirmado «${items.procedureConfirmed}», agendado «${scheduled.procedure}»`);
 if(items.lateralityConfirmed!==scheduled.laterality)
  blockers.push(`LATERALIDAD_DISTINTA_A_LA_AGENDADA: confirmada ${items.lateralityConfirmed}, agendada ${scheduled.laterality}`);
 return{ok:blockers.length===0,blockers};
}

/**
 * Verifica el SIGN OUT. Un conteo incorrecto de instrumental, gasas o agujas bloquea: el cuerpo extraño retenido es un
 * evento centinela, y la lista de la OMS existe en gran parte por él.
 */
export function verifySignOut(items:SignOutItems):ChecklistVerdict{
 const blockers:string[]=[];
 if(items.procedurePerformed.trim().length===0)blockers.push("PROCEDIMIENTO_REALIZADO_SIN_DECLARAR: la enfermera lo confirma en voz alta antes de cerrar");
 const conteos:readonly[string,CountStatus][]=[["INSTRUMENTAL",items.instrumentCount],["GASAS",items.spongeCount],["AGUJAS",items.needleCount]];
 for(const[nombre,estado]of conteos)
  if(estado==="INCORRECT")blockers.push(`CONTEO_${nombre}_INCORRECTO: no se cierra con un conteo incorrecto (riesgo de cuerpo extraño retenido)`);
 if(!items.specimensLabelled)blockers.push("MUESTRAS_SIN_ETIQUETAR: etiquetar leyendo el nombre en voz alta, o declarar que no hubo muestras");
 if(!items.recoveryConcernsReviewed)blockers.push("RECUPERACION_NO_REVISADA: el equipo declara las preocupaciones del postoperatorio");
 return{ok:blockers.length===0,blockers};
}

/**
 * Lo que este módulo NO cubre. Sin esto, «checklist OMS implementado» se leería como completo, que es justo el error que la
 * auditoría encontró.
 */
export const SURGICAL_CHECKLIST_LIMITS=
 "Se modelan el Time Out (antes de la incisión) y el Sign Out (antes de salir del quirófano) de la lista de la OMS de 2009. "+
 "NO se modela el Sign In, que pertenece a anestesia —verificación del equipo anestésico, vía aérea difícil, riesgo de "+
 "aspiración, pérdida sanguínea prevista, alergias—: este sistema no tiene registro anestésico y fingirlo sería peor que "+
 "no tenerlo. Tampoco se comprueba lo que un software no puede comprobar: que la confirmación fuera VERBAL y EN EQUIPO, "+
 "que es donde está el valor real de la lista según la propia OMS. Lo que queda registrado es quién declaró cada ítem. "+
 "La adopción del checklist como protocolo del quirófano, y su validación por el responsable quirúrgico, siguen en ADR-0300.";
