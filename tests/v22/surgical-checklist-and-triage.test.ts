import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{verifyTimeOut,verifySignOut,SURGICAL_CHECKLIST_LIMITS,type TimeOutItems,type SignOutItems}from"../../packages/surgical-checklist/src";
import{esiLevel,dangerZoneFor,reassessmentDueAt,DANGER_ZONE_VITALS,DANGER_ZONE_SPO2_BELOW,REASSESSMENT_MINUTES_CTAS,
 SEVERE_PAIN_AT_OR_ABOVE,ESI_ALGORITHM,EMERGENCY_TRIAGE_LIMITS,type EsiInput}from"../../packages/emergency-triage/src";
// Auditoría 2026-09-19, anexo R02b (R2B-018 y R2B-019) — DOS BARRERAS QUE SE NOMBRABAN Y NO EXISTÍAN, EN PRODUCCIÓN.
//
// R2B-018: `handleSurgeryTimeout` emitía `{kind:"TIMEOUT_COMPLETED"}` y nada más. El fold declaraba «barrera de seguridad
// obligatoria para iniciar» y el dossier lo aprobaba como «cirugía segura con time-out OMS». Cualquiera con rol PHYSICIAN
// completaba el time-out sin declarar un solo ítem, y la `laterality` capturada al agendar no se volvía a mirar.
//
// R2B-019: la clasificación era `acuity:z.number().int().min(1).max(5)` y el fold decía «ESI 1-5». La UI tenía un botón
// «Clasificar ESI-2» que enviaba el literal 2. ESI no es un número que alguien teclea: es un algoritmo de cuatro puntos.
//
// Las dos verticales están apagadas por bandera (404 en el borde), así que el riesgo no estaba vivo; lo que esto impide es
// que encenderlas exponga un quirófano sin checklist y un triage sin algoritmo.
const TIME_OUT:TimeOutItems={teamIntroduced:true,patientConfirmed:true,procedureConfirmed:"Colecistectomía laparoscópica",
 lateralityConfirmed:"NA",siteMarked:true,antibioticProphylaxis:"GIVEN_WITHIN_60_MIN",criticalEventsReviewed:true,
 imagingAvailable:true,ledBy:"Enf. Circulante Ruiz"};
const AGENDADO={procedure:"Colecistectomía laparoscópica",laterality:"NA"};
const SIGN_OUT:SignOutItems={procedurePerformed:"Colecistectomía laparoscópica",instrumentCount:"CORRECT",
 spongeCount:"CORRECT",needleCount:"CORRECT",specimensLabelled:true,equipmentIssues:"",recoveryConcernsReviewed:true};

describe("Time Out quirúrgico contra lo agendado (R2B-018)",()=>{
 it("el checklist completo y coincidente pasa",()=>{
  const v=verifyTimeOut(TIME_OUT,AGENDADO);
  expect(v.ok).toBe(true);expect(v.blockers).toEqual([]);
 });
 it("EL CASO CATASTRÓFICO: la lateralidad confirmada no coincide con la agendada",()=>{
  // Es el mecanismo exacto de la cirugía en el lado equivocado, y es lo que el time-out existe para detener.
  const v=verifyTimeOut({...TIME_OUT,lateralityConfirmed:"LEFT"},{procedure:AGENDADO.procedure,laterality:"RIGHT"});
  expect(v.ok).toBe(false);
  expect(v.blockers.join(" ")).toMatch(/LATERALIDAD_DISTINTA_A_LA_AGENDADA/);
  expect(v.blockers.join(" "),"el bloqueo tiene que decir qué se confirmó y qué se agendó").toMatch(/LEFT.*RIGHT|RIGHT.*LEFT/);
 });
 it("el procedimiento confirmado no coincide con el agendado",()=>{
  const v=verifyTimeOut({...TIME_OUT,procedureConfirmed:"Apendicectomía"},AGENDADO);
  expect(v.ok).toBe(false);
  expect(v.blockers.join(" ")).toMatch(/PROCEDIMIENTO_DISTINTO_AL_AGENDADO/);
 });
 it("la comparación del procedimiento tolera acentos, mayúsculas y espacios, no el contenido",()=>{
  // Sin esto, «COLECISTECTOMIA  LAPAROSCOPICA» bloquearía un caso correcto y el equipo aprendería a ignorar la barrera:
  // una barrera que da falsos positivos se desactiva sola.
  expect(verifyTimeOut({...TIME_OUT,procedureConfirmed:"  COLECISTECTOMIA   LAPAROSCOPICA "},AGENDADO).ok).toBe(true);
  expect(verifyTimeOut({...TIME_OUT,procedureConfirmed:"Colecistectomía abierta"},AGENDADO).ok,"pero un procedimiento DISTINTO sigue bloqueando").toBe(false);
 });
 it("cada ítem sin confirmar bloquea, y se nombra",()=>{
  const casos:readonly[Partial<TimeOutItems>,RegExp][]=[
   [{teamIntroduced:false},/EQUIPO_NO_PRESENTADO/],
   [{patientConfirmed:false},/IDENTIDAD_NO_CONFIRMADA/],
   [{siteMarked:false},/SITIO_NO_MARCADO/],
   [{criticalEventsReviewed:false},/EVENTOS_CRITICOS_NO_REVISADOS/],
   [{imagingAvailable:false},/IMAGENES_NO_DISPONIBLES/],
   [{ledBy:"   "},/TIME_OUT_SIN_COORDINADOR/],
  ];
  for(const[parche,re]of casos){
   const v=verifyTimeOut({...TIME_OUT,...parche},AGENDADO);
   expect(v.ok,JSON.stringify(parche)).toBe(false);
   expect(v.blockers.join(" "),JSON.stringify(parche)).toMatch(re);
  }
 });
 it("la profilaxis antibiótica: no administrada bloquea, no indicada no",()=>{
  expect(verifyTimeOut({...TIME_OUT,antibioticProphylaxis:"NOT_GIVEN"},AGENDADO).ok).toBe(false);
  expect(verifyTimeOut({...TIME_OUT,antibioticProphylaxis:"NOT_INDICATED"},AGENDADO).ok,"hay cirugías sin indicación de profilaxis").toBe(true);
 });
 it("todos los problemas se reportan juntos: en un quirófano, de uno en uno obliga a repetir el ciclo",()=>{
  const v=verifyTimeOut({...TIME_OUT,teamIntroduced:false,siteMarked:false,lateralityConfirmed:"LEFT"},{procedure:AGENDADO.procedure,laterality:"RIGHT"});
  expect(v.blockers.length).toBe(3);
 });
});

describe("Sign Out quirúrgico (R2B-018, segunda mitad)",()=>{
 it("el sign out completo con conteos correctos cierra",()=>{
  expect(verifySignOut(SIGN_OUT).ok).toBe(true);
 });
 it("UN CONTEO INCORRECTO no cierra: el cuerpo extraño retenido es un evento centinela",()=>{
  for(const campo of["instrumentCount","spongeCount","needleCount"] as const){
   const v=verifySignOut({...SIGN_OUT,[campo]:"INCORRECT"});
   expect(v.ok,campo).toBe(false);
   expect(v.blockers.join(" "),campo).toMatch(/CONTEO_(INSTRUMENTAL|GASAS|AGUJAS)_INCORRECTO/);
  }
 });
 it("«no aplicable» es una respuesta válida, no un conteo incorrecto",()=>{
  expect(verifySignOut({...SIGN_OUT,needleCount:"NOT_APPLICABLE"}).ok).toBe(true);
 });
 it("muestras sin etiquetar y recuperación sin revisar bloquean",()=>{
  expect(verifySignOut({...SIGN_OUT,specimensLabelled:false}).blockers.join(" ")).toMatch(/MUESTRAS_SIN_ETIQUETAR/);
  expect(verifySignOut({...SIGN_OUT,recoveryConcernsReviewed:false}).blockers.join(" ")).toMatch(/RECUPERACION_NO_REVISADA/);
 });
 it("el procedimiento REALIZADO se declara, y puede diferir del agendado sin bloquear",()=>{
  // La lista de la OMS pide el procedimiento realmente realizado, que legítimamente puede no ser el agendado (una
  // laparoscopía que se convierte en abierta). Lo que no puede es faltar.
  expect(verifySignOut({...SIGN_OUT,procedurePerformed:"Colecistectomía convertida a abierta"}).ok).toBe(true);
  expect(verifySignOut({...SIGN_OUT,procedurePerformed:"  "}).blockers.join(" ")).toMatch(/PROCEDIMIENTO_REALIZADO_SIN_DECLARAR/);
 });
 it("el módulo declara lo que NO cubre, incluido el Sign In de anestesia",()=>{
  expect(SURGICAL_CHECKLIST_LIMITS).toMatch(/Sign In/);
  expect(SURGICAL_CHECKLIST_LIMITS).toMatch(/anestes/i);
  expect(SURGICAL_CHECKLIST_LIMITS).toMatch(/ADR-0300/);
 });
});

const ADULTO:EsiInput={requiresLifeSavingIntervention:false,highRiskSituation:false,newConfusionLethargyDisorientation:false,
 severeDistress:false,predictedResources:2,ageMonths:480,vitals:{heartRate:80,respiratoryRate:16,spo2:98}};

describe("ESI: el nivel es la salida de un algoritmo, no un entero (R2B-019)",()=>{
 it("punto A — intervención inmediata para salvar la vida es nivel 1, y no se sigue evaluando",()=>{
  const r=esiLevel({...ADULTO,requiresLifeSavingIntervention:true,predictedResources:0});
  expect(r.level).toBe(1);expect(r.decisionPoint).toBe("A");
  expect(r.rationale).toMatch(/Punto A/);
 });
 it("el ORDEN de los puntos importa: A gana sobre C aunque no se prevea ningún recurso",()=>{
  // Evaluar recursos antes que el punto A sería el error de diseño clásico: un paciente en paro no consume «0 recursos».
  expect(esiLevel({...ADULTO,requiresLifeSavingIntervention:true,predictedResources:0}).level).toBe(1);
 });
 it("punto B — alto riesgo, confusión nueva, dolor ≥7/10 o distrés severo son nivel 2",()=>{
  expect(esiLevel({...ADULTO,highRiskSituation:true}).level).toBe(2);
  expect(esiLevel({...ADULTO,newConfusionLethargyDisorientation:true}).level).toBe(2);
  expect(esiLevel({...ADULTO,painScore:SEVERE_PAIN_AT_OR_ABOVE}).level).toBe(2);
  expect(esiLevel({...ADULTO,severeDistress:true}).level).toBe(2);
  // Y el umbral es el del algoritmo: 6/10 no es dolor severo.
  expect(esiLevel({...ADULTO,painScore:SEVERE_PAIN_AT_OR_ABOVE-1}).level).not.toBe(2);
 });
 it("punto C — el nivel sale del número de recursos previstos: 0→5, 1→4, ≥2→3",()=>{
  expect(esiLevel({...ADULTO,predictedResources:0}).level).toBe(5);
  expect(esiLevel({...ADULTO,predictedResources:1}).level).toBe(4);
  expect(esiLevel({...ADULTO,predictedResources:2}).level).toBe(3);
  expect(esiLevel({...ADULTO,predictedResources:7}).level).toBe(3);
 });
 it("punto D — signos vitales en zona de peligro SUGIEREN subir de 3 a 2, sin subirlo en silencio",()=>{
  // En ESI el punto D es «considerar»: la decisión de subir es del clínico. Subirlo automáticamente sería inventarse una
  // regla que el algoritmo no tiene; no marcarlo sería perder la única parte puramente numérica que el software sí sabe.
  const r=esiLevel({...ADULTO,vitals:{heartRate:130,respiratoryRate:16,spo2:98}});
  expect(r.level).toBe(3);
  expect(r.decisionPoint).toBe("D");
  expect(r.upgradeConsidered).toBe(true);
  expect(r.dangerZoneVitals.join(" ")).toMatch(/FC 130/);
  expect(r.rationale).toMatch(/considerar ESI-2/);
 });
 it("la zona de peligro es POR EDAD: una FC de 130 es normal en un lactante y alarma en un adulto",()=>{
  const lactante=esiLevel({...ADULTO,ageMonths:2,vitals:{heartRate:130,respiratoryRate:40,spo2:98}});
  expect(lactante.dangerZoneVitals,"FC 130 y FR 40 están dentro de lo aceptado en <3 meses").toEqual([]);
  expect(lactante.upgradeConsidered).toBe(false);
  const adulto=esiLevel({...ADULTO,ageMonths:480,vitals:{heartRate:130,respiratoryRate:40,spo2:98}});
  expect(adulto.dangerZoneVitals.length).toBe(2);
 });
 it("los tramos de edad cubren toda la recta y no se solapan",()=>{
  // Un hueco aquí significaría un paciente sin umbrales: el punto D simplemente no se le aplicaría.
  expect(dangerZoneFor(0).label).toBe("<3 meses");
  expect(dangerZoneFor(2).label).toBe("<3 meses");
  expect(dangerZoneFor(3).label).toBe("3 meses–3 años");
  expect(dangerZoneFor(35).label).toBe("3 meses–3 años");
  expect(dangerZoneFor(36).label).toBe("3–8 años");
  expect(dangerZoneFor(95).label).toBe("3–8 años");
  expect(dangerZoneFor(96).label).toBe(">8 años");
  expect(dangerZoneFor(1200).label).toBe(">8 años");
  // Y los umbrales bajan monótonamente con la edad, como la tabla publicada.
  const hr=DANGER_ZONE_VITALS.map(t=>t.hrAbove);
  expect([...hr].sort((a,b)=>b-a)).toEqual(hr);
 });
 it("SpO₂ por debajo del umbral es zona de peligro a cualquier edad",()=>{
  for(const meses of[1,12,60,480]){
   const r=esiLevel({...ADULTO,ageMonths:meses,vitals:{heartRate:70,respiratoryRate:14,spo2:DANGER_ZONE_SPO2_BELOW-1}});
   expect(r.dangerZoneVitals.join(" "),`${meses} meses`).toMatch(/SpO₂/);
  }
  expect(esiLevel({...ADULTO,vitals:{heartRate:70,respiratoryRate:14,spo2:DANGER_ZONE_SPO2_BELOW}}).dangerZoneVitals).toEqual([]);
 });
 it("UN SIGNO VITAL QUE FALTA NO ES NORMAL: se reporta como faltante",()=>{
  // Es el mismo defecto que R2B-009 encontró en NEWS2 con el oxígeno suplementario: asumir un valor concreto para un dato
  // ausente convierte «no se midió» en «está bien», que es un falso negativo silencioso.
  const r=esiLevel({...ADULTO,vitals:{}});
  expect(r.vitalsMissing).toEqual(["heartRate","respiratoryRate","spo2"]);
  expect(r.dangerZoneVitals,"faltar no es estar en zona de peligro, pero tampoco es estar bien").toEqual([]);
  expect(r.upgradeConsidered).toBe(false);
  const parcial=esiLevel({...ADULTO,vitals:{heartRate:80}});
  expect(parcial.vitalsMissing).toEqual(["respiratoryRate","spo2"]);
 });
 it("el nivel viene con la trazabilidad de cómo se llegó a él",()=>{
  for(const caso of[{...ADULTO},{...ADULTO,highRiskSituation:true},{...ADULTO,predictedResources:0}]){
   const r=esiLevel(caso);
   expect(r.rationale.length,"un nivel sin razón es el entero tecleado con otro nombre").toBeGreaterThan(10);
   expect(r.algorithm).toBe(ESI_ALGORITHM);
  }
 });
});

describe("plazo de reevaluación: el número tiene dueño (R2B-019)",()=>{
 it("los minutos son los de CTAS y se declara la fuente, porque ESI no publica tiempos",()=>{
  // Atribuir a ESI un tiempo objetivo sería inventarle un número. Los de CTAS existen y se citan como suyos.
  expect(REASSESSMENT_MINUTES_CTAS).toEqual({1:null,2:15,3:30,4:60,5:120});
  expect(EMERGENCY_TRIAGE_LIMITS).toMatch(/CTAS/);
  expect(EMERGENCY_TRIAGE_LIMITS,"y se dice explícitamente que ESI no publica tiempos").toMatch(/ESI no publica/);
 });
 it("el nivel 1 no tiene plazo porque es vigilancia continua, no porque falte el dato",()=>{
  expect(reassessmentDueAt(1,"2026-09-25T10:00:00.000Z")).toBeNull();
 });
 it("el plazo se calcula sumando los minutos del nivel",()=>{
  expect(reassessmentDueAt(2,"2026-09-25T10:00:00.000Z")).toBe("2026-09-25T10:15:00.000Z");
  expect(reassessmentDueAt(5,"2026-09-25T10:00:00.000Z")).toBe("2026-09-25T12:00:00.000Z");
 });
 it("una fecha inválida falla en voz alta en vez de devolver una fecha inventada",()=>{
  expect(()=>reassessmentDueAt(3,"no-es-fecha")).toThrow(/TRIAGE_REASSESSMENT_INVALID_DATE/);
 });
});

describe("los dos hallazgos no pueden volver (R2B-018, R2B-019)",()=>{
 const sinComentarios=(f:string):string=>fs.readFileSync(f,"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
 it("el time-out ya no puede registrarse con el cuerpo vacío",()=>{
  const src=sinComentarios("apps/web/lib/surgery-lifecycle.ts");
  expect(src,"el payload del time-out tiene que llevar los ítems").toMatch(/kind:"TIMEOUT_COMPLETED",teamIntroduced/);
  expect(src,"y compararse contra lo agendado que da el fold").toMatch(/verifyTimeOut\(b,\{procedure:folded\.procedure,laterality:folded\.laterality\}\)/);
  expect(src,"un `{kind:\"TIMEOUT_COMPLETED\"}` a secas es el hallazgo").not.toMatch(/\{kind:"TIMEOUT_COMPLETED"\}/);
 });
 it("la clasificación de triage ya no acepta un entero de acuidad",()=>{
  const src=sinComentarios("apps/web/lib/triage-lifecycle.ts");
  expect(src,"el cuerpo ya no declara `acuity`").not.toMatch(/acuity:z\.number\(\)/);
  expect(src,"el nivel lo calcula el algoritmo").toMatch(/esiLevel\(\{/);
  expect(src,"y el evento cita el algoritmo aplicado").toMatch(/algorithm:ESI_ALGORITHM/);
 });
 it("la UI ya no tiene botones que afirmen un nivel ESI que no calculó",()=>{
  const src=sinComentarios("apps/web/app/workspace/shared.tsx");
  expect(src,"«Clasificar ESI-2» con `acuity:2` dentro era el hallazgo en la pantalla").not.toMatch(/Clasificar ESI-\d/);
  expect(src).not.toMatch(/body:\{acuity:\d/);
 });
});
