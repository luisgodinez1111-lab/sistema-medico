// FACHADA de compatibilidad (lote 11, ADR-0300). La persistencia de apps/web vive en apps/web/lib/runtime/: pool y rol RLS
// (db), secreto de sesión (secrets), ejecución de comandos (command), event store, paginación, fragmentos SQL y read models
// por dominio (runtime/read-models/*). Este módulo re-exporta los mismos símbolos que exportaba antes de la partición para
// que sus importadores, las pruebas en vivo y las citas del registro de reconciliación sigan resolviendo. Código nuevo:
// importar del módulo concreto.
export{getSql}from"./runtime/db";
export{sessionSecret}from"./runtime/secrets";
export{runClinicalCommand,lookupReplay}from"./runtime/command";
export type{ClinicalCommandResult}from"./runtime/command";
export{encodeCursor,decodeCursor,PAGE_LIMIT_DEFAULT,PAGE_LIMIT_MAX,clampLimit}from"./runtime/pagination";
export type{Page}from"./runtime/pagination";
export{readEncounterEvents,readEventPayloadById,readAggregateEvents,readAggregateStream,readEncounter}from"./runtime/event-store";
export type{EncounterView}from"./runtime/event-store";
export{listPatients,patientDemographics,requireRegisteredPatient,findPatientDuplicate,patientBirthDate}from"./runtime/read-models/patient";
export type{PatientRow,PatientListQuery,PatientGuardian,PatientDemographics,PatientDuplicate}from"./runtime/read-models/patient";
export{activeAllergies,activeAllergySubstances,activeMedicationDrugCodes,activeProblemCodes}from"./runtime/read-models/safety-inputs";
export type{ActiveAllergy}from"./runtime/read-models/safety-inputs";
export{patientEgfr}from"./runtime/read-models/renal";
export{administeredVaccines,administeredVaccineCodes,immunizationRegistry}from"./runtime/read-models/immunizations";
export type{AdministeredVaccine,ImmunizationRow}from"./runtime/read-models/immunizations";
export{latestVitalsByType,patientVitals}from"./runtime/read-models/vitals";
export type{VitalPoint}from"./runtime/read-models/vitals";
export{latestResultValueForAnalyte,latestAnalyteReading,analyteSeries,resultsRegistry}from"./runtime/read-models/results";
export type{AnalyteReading,ResultRow}from"./runtime/read-models/results";
export{agendaForDate}from"./runtime/read-models/scheduling";
export type{AgendaAppt}from"./runtime/read-models/scheduling";
export{allergyRegistry,problemRegistry,claimsRegistry,ordersRegistry,regulatoryObligations}from"./runtime/read-models/registries";
export type{AllergyRow,ProblemRow,ClaimRow,OrderRow,RegulatoryObligationRow}from"./runtime/read-models/registries";
export{patientDocuments,documentDetail}from"./runtime/read-models/documents";
export type{DocRow,DocAddendum,DocSignature,DocAttachment,DocumentDetail}from"./runtime/read-models/documents";
export{officeSettings}from"./runtime/read-models/settings";
export type{OfficeSettingsRead}from"./runtime/read-models/settings";
export{carePlanGoals,patientObligations,blockingObligations,countUnresolvedCriticalObligations,countOpenCriticalResults,countOpenCriticalVitals}from"./runtime/read-models/follow-up";
export type{CarePlanGoal,FollowUpTask,BlockingObligation}from"./runtime/read-models/follow-up";
export{encounterAnalytics,medicationsPrescribed,appointmentsByType,appointmentOutcomes}from"./runtime/read-models/reports";
export type{EncounterAnalytics,PrescribedDrugRow,AppointmentTypeRow,AppointmentOutcomes}from"./runtime/read-models/reports";
export{readPatientTimeline,readTenantOpenAggregates,readPatientRecordRows}from"./runtime/read-models/record";
export type{TimelineItem,PanelRowData,RecordRow}from"./runtime/read-models/record";
