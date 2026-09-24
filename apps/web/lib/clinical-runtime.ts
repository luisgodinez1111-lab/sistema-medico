// EPIC B — Runtime clínico de la capa app: FACHADA.
//
// Auditoría 2026-09-19, anexo R01 (R01-001): este fichero era un god-module de 954 líneas y 93 exports que mezclaba la
// conexión a Postgres, la ejecución de comandos y más de sesenta read-models de todos los dominios clínicos. Ahora cada
// dominio vive en `apps/web/lib/runtime/` y aquí solo queda la superficie pública, para que los ~100 importadores no
// tengan que cambiar y para que añadir un read-model obligue a elegir su dominio.
//
//   runtime/connection.ts     conexión, rol RLS, withTenantTx, revocación de sesión y constancia de acceso
//   runtime/command.ts        ejecución de comandos clínicos y detección de reintentos
//   runtime/pagination.ts     cursores opacos (keyset)
//   runtime/patients.ts       identidad del paciente
//   runtime/patient-facts.ts  hechos clínicos de un paciente (barreras, calculadoras, seguimiento)
//   runtime/registries.ts     tableros por estado de toda la clínica
//   runtime/analytics.ts      analítica agregada
//   runtime/records.ts        expediente: eventos, timeline, documento, encuentro, obligaciones bloqueantes
export{getSql,readPatientAccessLog,recordPhiAccess,revokeCurrentSession,sessionSecret,withTenantTx}from"./runtime/connection";
export{lookupReplay,runClinicalCommand}from"./runtime/command";
export{PAGE_LIMIT_DEFAULT,PAGE_LIMIT_MAX,clampLimit,decodeCursor,encodeCursor}from"./runtime/pagination";
export{findPatientDuplicate,listPatients,patientBirthDate,patientDemographics,requireRegisteredPatient}from"./runtime/patients";
export{activeAllergies,activeAllergySubstances,activeMedicationDrugCodes,activeProblemCodes,administeredVaccineCodes,administeredVaccines,carePlanGoals,latestVitalReadings,latestVitalsByType,patientDocuments,patientEgfr,patientObligations,patientVitals}from"./runtime/patient-facts";
export{analyteSeries,latestAnalyteReading}from"./runtime/lab-facts";
export{agendaForDate,allergyRegistry,claimsRegistry,immunizationRegistry,officeSettings,ordersRegistry,problemRegistry,regulatoryObligations,resultsRegistry,overdueOrders}from"./runtime/registries";
export{appointmentOutcomes,appointmentsByType,encounterAnalytics,medicationsPrescribed}from"./runtime/analytics";
export{blockingObligations,countOpenCriticalResults,countOpenCriticalVitals,countUnresolvedCriticalObligations,documentDetail,readAggregateEvents,readEncounter,readEncounterEvents,readEventPayloadById,readPatientRecordRows,readPatientTimeline,readTenantOpenAggregates}from"./runtime/records";
export type{ClinicalCommandResult}from"./runtime/command";
export type{Page}from"./runtime/pagination";
export type{PatientDemographics,PatientDuplicate,PatientGuardian,PatientListQuery,PatientRow}from"./runtime/patients";
export type{ActiveAllergy,AdministeredVaccine,CarePlanGoal,DocRow,FollowUpTask,VitalPoint,VitalReading}from"./runtime/patient-facts";
export type{AnalyteReading}from"./runtime/lab-facts";
export type{AgendaAppt,AllergyRow,ClaimRow,ImmunizationRow,OfficeSettingsRead,OrderRow,ProblemRow,RegulatoryObligationRow,ResultRow,OverdueOrderRow}from"./runtime/registries";
export type{AppointmentOutcomes,AppointmentTypeRow,EncounterAnalytics,PrescribedDrugRow}from"./runtime/analytics";
export type{BlockingObligation,DocAddendum,DocAttachment,DocSignature,DocumentDetail,EncounterView,PanelRowData,RecordRow,TimelineItem}from"./runtime/records";
