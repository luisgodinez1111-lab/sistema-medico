// GENERADO por `pnpm openapi:registry` (scripts/ops/api-body-registry.mts). NO editar a mano.
// Auditoría S-10: mapa "MÉTODO ruta" -> esquema zod que valida el handler; alimenta docs/api/openapi.json.
import type{ZodType}from"zod";
import{AdmitBody as admission__AdmitBody,CancelBody as admission__CancelBody,DischargeBody as admission__DischargeBody,TransferBody as admission__TransferBody}from"./admission-lifecycle";
import{AssistBody as ai_copilot_gateway__AssistBody}from"./ai-copilot-gateway";
import{CreateBody as allergy__CreateBody,WhenBody as allergy__WhenBody}from"./allergy-lifecycle";
import{CancelBody as appointment__CancelBody,NoShowBody as appointment__NoShowBody,ScheduleBody as appointment__ScheduleBody,WhenBody as appointment__WhenBody}from"./appointment-lifecycle";
import{CancelBody as careplan__CancelBody,ProposeBody as careplan__ProposeBody,WhenBody as careplan__WhenBody}from"./careplan-lifecycle";
import{CodeBody as claim__CodeBody,DraftBody as claim__DraftBody,ReasonBody as claim__ReasonBody,RefBody as claim__RefBody,WhenBody as claim__WhenBody}from"./claim-lifecycle";
import{DraftBody as consent__DraftBody,GrantBody as consent__GrantBody,ReasonBody as consent__ReasonBody,WhenBody as consent__WhenBody}from"./consent-lifecycle";
import{CompleteBody as dialysis__CompleteBody,InterruptBody as dialysis__InterruptBody,ReasonBody as dialysis__ReasonBody,ScheduleBody as dialysis__ScheduleBody,StartBody as dialysis__StartBody,WhenBody as dialysis__WhenBody}from"./dialysis-lifecycle";
import{AmendBody as document__AmendBody,CreateBody as document__CreateBody,SignBody as document__SignBody,WhenBody as document__WhenBody}from"./document-lifecycle";
import{AdminBody as immunization__AdminBody,AdverseBody as immunization__AdverseBody,DueBody as immunization__DueBody,ReasonBody as immunization__ReasonBody}from"./immunization-lifecycle";
import{ReasonBody as incident__ReasonBody,ReportBody as incident__ReportBody,ResolveBody as incident__ResolveBody,WhenBody as incident__WhenBody}from"./incident-lifecycle";
import{HoldBody as medication__HoldBody,ModifyBody as medication__ModifyBody,PrescribeBody as medication__PrescribeBody,ProposeBody as medication__ProposeBody,ResumeBody as medication__ResumeBody,StopBody as medication__StopBody,WhenBody as medication__WhenBody}from"./medication-lifecycle";
import{CancelBody as obligation__CancelBody,CompleteBody as obligation__CompleteBody,CreateBody as obligation__CreateBody,WhenBody as obligation__WhenBody}from"./obligation-lifecycle";
import{UpdateBody as office_settings__UpdateBody}from"./office-settings-lifecycle";
import{CancelBody as order__CancelBody,CreateBody as order__CreateBody,PlaceBody as order__PlaceBody,WhenBody as order__WhenBody}from"./order-lifecycle";
import{AmendBody as patient__AmendBody,DeceasedBody as patient__DeceasedBody,RegisterBody as patient__RegisterBody,WhenBody as patient__WhenBody}from"./patient-lifecycle";
import{CredentialsBody as physician_profile__CredentialsBody}from"./physician-profile-lifecycle";
import{CreateBody as problem__CreateBody,EpistemicBody as problem__EpistemicBody,EvidenceBody as problem__EvidenceBody,ResolveBody as problem__ResolveBody,WhenBody as problem__WhenBody}from"./problem-lifecycle";
import{CreateBody as referral__CreateBody,ReasonBody as referral__ReasonBody,WhenBody as referral__WhenBody}from"./referral-lifecycle";
import{ComplyBody as regulatory_obligation__ComplyBody,CreateBody as regulatory_obligation__CreateBody,RenewBody as regulatory_obligation__RenewBody}from"./regulatory-obligation-lifecycle";
import{ActionBody as result__ActionBody,CloseBody as result__CloseBody,CorrectionBody as result__CorrectionBody,ErrorMarkBody as result__ErrorMarkBody,ReceiveBody as result__ReceiveBody,VerifyBody as result__VerifyBody}from"./result-lifecycle";
import{CollectBody as specimen__CollectBody,RejectBody as specimen__RejectBody,WhenBody as specimen__WhenBody}from"./specimen-lifecycle";
import{CompleteBody as surgery__CompleteBody,ReasonBody as surgery__ReasonBody,ScheduleBody as surgery__ScheduleBody,TimeoutBody as surgery__TimeoutBody,WhenBody as surgery__WhenBody}from"./surgery-lifecycle";
import{CrossmatchBody as transfusion__CrossmatchBody,OrderBody as transfusion__OrderBody,ReactionBody as transfusion__ReactionBody,ReasonBody as transfusion__ReasonBody,WhenBody as transfusion__WhenBody}from"./transfusion-lifecycle";
import{ArriveBody as triage__ArriveBody,AssessBody as triage__AssessBody,ReasonBody as triage__ReasonBody,WhenBody as triage__WhenBody}from"./triage-lifecycle";
import{AmendBody as vital__AmendBody,ErrorBody as vital__ErrorBody,RecordBody as vital__RecordBody}from"./vital-lifecycle";
import{DocumentBody as wound__DocumentBody,ReasonBody as wound__ReasonBody,ReassessBody as wound__ReassessBody,WhenBody as wound__WhenBody}from"./wound-lifecycle";
export const API_BODY_SCHEMAS:Readonly<Record<string,ZodType>>={
 "POST /api/v1/admissions":admission__AdmitBody,
 "POST /api/v1/admissions/{admissionId}/cancellation":admission__CancelBody,
 "POST /api/v1/admissions/{admissionId}/discharge":admission__DischargeBody,
 "POST /api/v1/admissions/{admissionId}/transfer":admission__TransferBody,
 "POST /api/v1/ai/assist":ai_copilot_gateway__AssistBody,
 "POST /api/v1/allergies":allergy__CreateBody,
 "POST /api/v1/allergies/{allergyId}/inactivation":allergy__WhenBody,
 "POST /api/v1/allergies/{allergyId}/reactivation":allergy__WhenBody,
 "POST /api/v1/allergies/{allergyId}/refutation":allergy__WhenBody,
 "POST /api/v1/appointments":appointment__ScheduleBody,
 "POST /api/v1/appointments/{appointmentId}/cancellation":appointment__CancelBody,
 "POST /api/v1/appointments/{appointmentId}/check-in":appointment__WhenBody,
 "POST /api/v1/appointments/{appointmentId}/completion":appointment__WhenBody,
 "POST /api/v1/appointments/{appointmentId}/no-show":appointment__NoShowBody,
 "POST /api/v1/care-plans":careplan__ProposeBody,
 "POST /api/v1/care-plans/{carePlanId}/achievement":careplan__WhenBody,
 "POST /api/v1/care-plans/{carePlanId}/activation":careplan__WhenBody,
 "POST /api/v1/care-plans/{carePlanId}/cancellation":careplan__CancelBody,
 "POST /api/v1/care-plans/{carePlanId}/hold":careplan__WhenBody,
 "POST /api/v1/care-plans/{carePlanId}/resumption":careplan__WhenBody,
 "POST /api/v1/claims":claim__DraftBody,
 "POST /api/v1/claims/{claimId}/coding":claim__CodeBody,
 "POST /api/v1/claims/{claimId}/payment":claim__RefBody,
 "POST /api/v1/claims/{claimId}/rejection":claim__ReasonBody,
 "POST /api/v1/claims/{claimId}/submission":claim__WhenBody,
 "POST /api/v1/claims/{claimId}/void":claim__ReasonBody,
 "POST /api/v1/consents":consent__DraftBody,
 "POST /api/v1/consents/{consentId}/decline":consent__ReasonBody,
 "POST /api/v1/consents/{consentId}/grant":consent__GrantBody,
 "POST /api/v1/consents/{consentId}/presentation":consent__WhenBody,
 "POST /api/v1/consents/{consentId}/revocation":consent__ReasonBody,
 "POST /api/v1/dialysis-sessions":dialysis__ScheduleBody,
 "POST /api/v1/dialysis-sessions/{dialysisId}/cancellation":dialysis__ReasonBody,
 "POST /api/v1/dialysis-sessions/{dialysisId}/completion":dialysis__CompleteBody,
 "POST /api/v1/dialysis-sessions/{dialysisId}/interruption":dialysis__InterruptBody,
 "POST /api/v1/dialysis-sessions/{dialysisId}/no-show":dialysis__WhenBody,
 "POST /api/v1/dialysis-sessions/{dialysisId}/resumption":dialysis__WhenBody,
 "POST /api/v1/dialysis-sessions/{dialysisId}/start":dialysis__StartBody,
 "POST /api/v1/documents":document__CreateBody,
 "POST /api/v1/documents/{documentId}/amendment":document__AmendBody,
 "POST /api/v1/documents/{documentId}/finalization":document__WhenBody,
 "POST /api/v1/documents/{documentId}/signature":document__SignBody,
 "POST /api/v1/immunizations":immunization__DueBody,
 "POST /api/v1/immunizations/{immunizationId}/administration":immunization__AdminBody,
 "POST /api/v1/immunizations/{immunizationId}/adverse-event":immunization__AdverseBody,
 "POST /api/v1/immunizations/{immunizationId}/refusal":immunization__ReasonBody,
 "POST /api/v1/incidents":incident__ReportBody,
 "POST /api/v1/incidents/{incidentId}/escalation":incident__ReasonBody,
 "POST /api/v1/incidents/{incidentId}/resolution":incident__ResolveBody,
 "POST /api/v1/incidents/{incidentId}/review":incident__WhenBody,
 "POST /api/v1/medications":medication__ProposeBody,
 "POST /api/v1/medications/{medicationId}/activation":medication__WhenBody,
 "POST /api/v1/medications/{medicationId}/discontinuation":medication__StopBody,
 "POST /api/v1/medications/{medicationId}/hold":medication__HoldBody,
 "POST /api/v1/medications/{medicationId}/modification":medication__ModifyBody,
 "POST /api/v1/medications/{medicationId}/prescription":medication__PrescribeBody,
 "POST /api/v1/medications/{medicationId}/resumption":medication__ResumeBody,
 "POST /api/v1/obligations":obligation__CreateBody,
 "POST /api/v1/obligations/{obligationId}/cancellation":obligation__CancelBody,
 "POST /api/v1/obligations/{obligationId}/completion":obligation__CompleteBody,
 "POST /api/v1/obligations/{obligationId}/progress":obligation__WhenBody,
 "POST /api/v1/orders":order__CreateBody,
 "POST /api/v1/orders/{orderId}/cancellation":order__CancelBody,
 "POST /api/v1/orders/{orderId}/fulfillment":order__WhenBody,
 "POST /api/v1/orders/{orderId}/placement":order__PlaceBody,
 "POST /api/v1/patients":patient__RegisterBody,
 "POST /api/v1/patients/{patientId}/amendment":patient__AmendBody,
 "POST /api/v1/patients/{patientId}/deactivation":patient__WhenBody,
 "POST /api/v1/patients/{patientId}/deceased":patient__DeceasedBody,
 "POST /api/v1/patients/{patientId}/reactivation":patient__WhenBody,
 "POST /api/v1/physician-profile/credentials":physician_profile__CredentialsBody,
 "POST /api/v1/problems":problem__CreateBody,
 "POST /api/v1/problems/{problemId}/chronicity":problem__WhenBody,
 "POST /api/v1/problems/{problemId}/epistemic-status":problem__EpistemicBody,
 "POST /api/v1/problems/{problemId}/evidence":problem__EvidenceBody,
 "POST /api/v1/problems/{problemId}/reactivation":problem__WhenBody,
 "POST /api/v1/problems/{problemId}/resolution":problem__ResolveBody,
 "POST /api/v1/referrals":referral__CreateBody,
 "POST /api/v1/referrals/{referralId}/acceptance":referral__WhenBody,
 "POST /api/v1/referrals/{referralId}/cancellation":referral__ReasonBody,
 "POST /api/v1/referrals/{referralId}/completion":referral__WhenBody,
 "POST /api/v1/referrals/{referralId}/decline":referral__ReasonBody,
 "POST /api/v1/regulatory-obligations":regulatory_obligation__CreateBody,
 "POST /api/v1/regulatory-obligations/{obligationId}/compliance":regulatory_obligation__ComplyBody,
 "POST /api/v1/regulatory-obligations/{obligationId}/renewal":regulatory_obligation__RenewBody,
 "POST /api/v1/results":result__ReceiveBody,
 "POST /api/v1/results/{resultId}/action":result__ActionBody,
 "POST /api/v1/results/{resultId}/closure":result__CloseBody,
 "POST /api/v1/results/{resultId}/correction":result__CorrectionBody,
 "POST /api/v1/results/{resultId}/error-mark":result__ErrorMarkBody,
 "POST /api/v1/results/{resultId}/verification":result__VerifyBody,
 "POST /api/v1/specimens":specimen__CollectBody,
 "POST /api/v1/specimens/{specimenId}/receipt":specimen__WhenBody,
 "POST /api/v1/specimens/{specimenId}/rejection":specimen__RejectBody,
 "POST /api/v1/specimens/{specimenId}/result":specimen__WhenBody,
 "POST /api/v1/specimens/{specimenId}/transit":specimen__WhenBody,
 "POST /api/v1/surgeries":surgery__ScheduleBody,
 "POST /api/v1/surgeries/{surgeryId}/cancellation":surgery__ReasonBody,
 "POST /api/v1/surgeries/{surgeryId}/completion":surgery__CompleteBody,
 "POST /api/v1/surgeries/{surgeryId}/start":surgery__WhenBody,
 "POST /api/v1/surgeries/{surgeryId}/timeout":surgery__TimeoutBody,
 "POST /api/v1/transfusions":transfusion__OrderBody,
 "POST /api/v1/transfusions/{transfusionId}/cancellation":transfusion__ReasonBody,
 "POST /api/v1/transfusions/{transfusionId}/completion":transfusion__WhenBody,
 "POST /api/v1/transfusions/{transfusionId}/crossmatch":transfusion__CrossmatchBody,
 "POST /api/v1/transfusions/{transfusionId}/reaction":transfusion__ReactionBody,
 "POST /api/v1/transfusions/{transfusionId}/start":transfusion__WhenBody,
 "POST /api/v1/triage":triage__ArriveBody,
 "POST /api/v1/triage/{triageId}/assessment":triage__AssessBody,
 "POST /api/v1/triage/{triageId}/closure":triage__WhenBody,
 "POST /api/v1/triage/{triageId}/lwbs":triage__ReasonBody,
 "POST /api/v1/triage/{triageId}/start":triage__WhenBody,
 "POST /api/v1/vitals":vital__RecordBody,
 "POST /api/v1/vitals/{vitalId}/amendment":vital__AmendBody,
 "POST /api/v1/vitals/{vitalId}/error-mark":vital__ErrorBody,
 "POST /api/v1/wounds":wound__DocumentBody,
 "POST /api/v1/wounds/{woundId}/escalation":wound__ReasonBody,
 "POST /api/v1/wounds/{woundId}/healing":wound__WhenBody,
 "POST /api/v1/wounds/{woundId}/reassessment":wound__ReassessBody,
 "PUT /api/v1/office-settings":office_settings__UpdateBody,
};
