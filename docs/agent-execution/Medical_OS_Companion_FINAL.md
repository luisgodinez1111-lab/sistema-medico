# MEDICAL OS V2.1 — AGENT EXECUTION COMPANION

**Status:** Normative companion to `Medical OS V2.1 FINAL — Master Engineering & Implementation Specification`  
**Purpose:** Provide the operational, machine-readable instructions that a long-form DOCX cannot communicate effectively to Codex, Claude Code, or other software-engineering agents.  
**Authority:** The V2 Final defines **what Medical OS must be**. V2.1 defines **how it must be engineered**. This file defines **how an AI coding agent must behave while executing V2.1**.  
**Rule:** This file does not replace V2 or V2.1. When a conflict exists, stop, identify the conflict, and require an ADR/spec correction rather than silently choosing.

---

## 0. READ THIS BEFORE WRITING CODE

You are working on **safety-relevant healthcare software**.

Your objective is not to maximize lines of code, feature count, visual novelty, or implementation speed.

Your objective is to produce a system that:

1. preserves clinical truth;
2. reduces physician cognitive and administrative burden;
3. preserves longitudinal continuity;
4. prevents important results, findings, orders, referrals, and follow-up obligations from being lost;
5. makes clinically relevant uncertainty and missing information visible without pretending to diagnose autonomously;
6. maintains tenant isolation, privacy, provenance, auditability, and recoverability;
7. remains understandable and reversible under failure;
8. keeps the physician as the final clinical decision-maker.

**Medical OS must work for the physician. The physician must not work to feed Medical OS.**

---

# EXEC-0001 | ACTIVE | 1. SOURCE-OF-TRUTH HIERARCHY

Before implementing any issue, load the smallest necessary context from this hierarchy:

1. `docs/product/v2/` — Product and Clinical Specification.
2. `docs/engineering/v2.1/` — Engineering and Implementation Specification.
3. `docs/adr/` — accepted architecture decisions.
4. `docs/clinical-governance/` — approved clinical content and safety rules.
5. `docs/compliance/` — applicability register, control matrix and evidence requirements.
6. `docs/threat-models/` — domain-specific threats and mitigations.
7. the GitHub issue being implemented.
8. this file.

Do **not** infer missing product requirements from convenience.

If an issue contradicts a higher-level source, do not implement the contradiction. Report it as `SPEC-CONFLICT`.

---

# EXEC-0002 | ACTIVE | 2. AGENT OPERATING MODES

Every coding task must explicitly operate in one of these modes:

- `PLAN` — inspect, reason about dependencies, propose implementation. No production mutation.
- `IMPLEMENT` — write code only inside approved scope.
- `REVIEW` — adversarially inspect code written by another agent/person.
- `TEST` — build deterministic tests and attempt to break assumptions.
- `MIGRATE` — schema/data migration with explicit rollback/restore strategy.
- `SECURITY` — threat-oriented review; assume hostile inputs and compromised clients.
- `CLINICAL-SAFETY` — inspect potential patient-harm paths and unsafe omissions.
- `RELEASE` — validate gates; never bypass failing gates.

The same agent should not be considered sufficient evidence for both implementation and independent approval of a high-risk feature.

---

# EXEC-0003 | ACTIVE | 3. NON-NEGOTIABLE ENGINEERING LAWS

## 3.1 No orphan clinical data

Every clinically meaningful object must be attributable to:

- tenant;
- patient or explicit non-patient context;
- encounter/context when applicable;
- author/actor or source system;
- creation time;
- lifecycle state;
- provenance;
- current version or immutable snapshot semantics;
- audit trail where required.

A clinical value without origin is defective data.

## 3.2 No orphan future obligation

If something medically important must happen later, represent it explicitly.

Examples:

- repeat HbA1c;
- review pathology;
- repeat imaging;
- monitor creatinine/potassium;
- referral;
- medication monitoring;
- follow-up appointment;
- communicate a result.

Do not hide future clinical work inside free text.

## 3.3 No silent AI truth

AI may:

- summarize;
- extract;
- classify;
- organize;
- compare;
- draft;
- retrieve;
- suggest;
- identify possible omissions or inconsistencies.

AI may not silently:

- create a confirmed diagnosis;
- alter a signed note;
- prescribe;
- close a clinical obligation;
- acknowledge a critical result;
- modify medication;
- communicate a clinical conclusion as physician-approved;
- write probabilistic output into authoritative clinical state without explicit workflow and human acceptance.

## 3.4 No frontend authorization

The browser is untrusted.

Hiding a button is UX, not authorization.

All protected operations require server-side authorization with tenant context and policy evaluation.

## 3.5 No destructive signed-record edits

After clinical signature:

- preserve the signed snapshot;
- corrections use addendum/amendment;
- preserve author, timestamp, reason, relationship to original;
- never rewrite history to make the past appear different.

## 3.6 No PHI by default in telemetry

Do not put PHI, secrets, raw notes, uploaded documents, prompts containing unnecessary patient data, or access tokens into:

- logs;
- traces;
- metrics labels;
- error messages;
- analytics;
- CI artifacts.

Use identifiers/correlation IDs with controlled lookup.

## 3.7 No critical workflow without ownership and terminal state

Orders, results, referrals, tasks, clinical obligations and critical communications require:

- owner;
- state machine;
- timestamps;
- retry/escalation policy when applicable;
- explicit terminal state;
- auditability.

---

# EXEC-0004 | ACTIVE | 4. ARCHITECTURAL DIRECTION

Prefer a **modular monolith with hard domain boundaries** until evidence justifies service extraction.

Target logical structure:

```text
medical-os/
├── apps/
│   ├── web/
│   └── patient-portal/
├── packages/
│   ├── clinical-domain/
│   ├── patient-state/
│   ├── clinical-intelligence/
│   ├── clinical-content/
│   ├── medication/
│   ├── documents/
│   ├── diagnostics/
│   ├── authz/
│   ├── audit/
│   ├── db/
│   ├── design-system/
│   ├── interoperability/
│   ├── security/
│   ├── observability/
│   └── shared/
├── workers/
├── infra/
├── docs/
└── tests/
```

Default dependency direction:

```text
UI
↓
application/use-case
↓
authorization policy
↓
domain service
↓
repository / durable workflow / adapter
↓
database or external system
↓
audit / provenance / domain event
```

Forbidden shortcuts:

```text
UI → database table
UI → cross-domain SQL
AI → signed clinical record
webhook → clinical mutation without validation/idempotency
client-provided tenant_id → trusted tenant scope
React component → clinical guideline logic
cron → sole guarantee for critical clinical workflow
public URL → PHI document
```

---

# EXEC-0005 | ACTIVE | 5. REQUEST EXECUTION PIPELINE

For a protected clinical mutation, use this conceptual sequence:

```text
request
→ authenticate principal
→ resolve server-side tenant context
→ validate input
→ authorize action
→ load current aggregate/version
→ enforce domain invariants
→ execute transaction
→ persist state
→ append provenance/audit
→ enqueue outbox/domain event
→ commit
→ return minimum necessary response
```

Do not emit an external event before the state transaction is durable.

Use a transactional outbox or equivalent reliable pattern for important asynchronous side effects.

---

# EXEC-0006 | ACTIVE | 6. TENANCY AND AUTHORIZATION

Internal IDs must be non-predictable UUID/ULID-class identifiers.

Never accept tenant identity merely because the client sent it.

Authorization should be capable of combining:

- RBAC — role;
- ABAC — attributes/context;
- ReBAC — relationship to organization/facility/patient/resource;
- explicit emergency `break-glass`.

For sensitive reads and writes, authorization should be explainable and auditable.

`break-glass` requires:

- reason;
- elevated action scope;
- timestamp;
- actor;
- expiry;
- audit event;
- post-event review path.

Cross-tenant tests are mandatory.

Where PostgreSQL RLS is used, treat it as defense in depth, not as the only authorization layer.

---

# EXEC-0007 | ACTIVE | 7. CONCURRENCY AND CLINICAL VERSIONING

Clinical editing can occur from multiple tabs/devices/users.

For version-sensitive resources, use optimistic concurrency or equivalent.

Conceptual contract:

```ts
type VersionedMutation<T> = {
  id: string;
  expectedVersion: number;
  patch: T;
};
```

A stale writer must not silently overwrite a newer clinical state.

On conflict:

1. reject with explicit conflict;
2. fetch current version;
3. show meaningful differences;
4. allow controlled reconciliation;
5. preserve provenance.

Never use last-write-wins blindly for clinically meaningful data.

---

# EXEC-0008 | ACTIVE | 8. PATIENT STATE IS A COMPUTED PRODUCT, NOT A GIANT TABLE

`PatientClinicalState` is a read model assembled from authoritative domains.

It may include:

```ts
interface PatientClinicalState {
  identity: PatientIdentitySummary;
  activeProblems: ProblemSummary[];
  activeMedications: MedicationSummary[];
  allergies: AllergySummary[];
  recentVitals: VitalSummary[];
  relevantResults: ResultSummary[];
  openObligations: ObligationSummary[];
  careGaps: CareGapSummary[];
  recentChanges: ClinicalChange[];
  safetyFlags: SafetyFlag[];
  unresolvedInconsistencies: ConcordanceFinding[];
}
```

Do not make this object the sole authoritative store.

It is derived, cacheable with caution, invalidatable, reproducible, and explainable.

Every derived finding must be traceable back to source facts.

---

# EXEC-0009 | ACTIVE | 9. ENCOUNTER OS CONTRACT

The consultation is an assisted clinical workflow, not a CRUD form.

Canonical order:

```text
patient/context
→ personal/longitudinal history
→ chief complaint
→ vital signs
→ adaptive HPI
→ prior/current studies
→ physical examination
→ assessment/differential
→ plan/orders/follow-up
→ medication/prescription
→ safety-net/recommendations
→ review
→ sign
```

Prescription is near the end of the clinical decision process, not the first action.

Encounter lifecycle must distinguish at least:

```text
planned
arrived
in_progress
ready_for_review
signed
amended
closed
cancelled
```

Draft save and clinical/legal signature are different operations.

Autosave must never masquerade as signature.

---

# EXEC-0010 | ACTIVE | 10. CLINICAL INFORMATION STATES

Never collapse these into one nullable boolean:

```text
unknown
not_asked
negative
positive
not_applicable
unable_to_assess
```

Absence of documentation is not equivalent to a negative finding.

This rule applies to adaptive history, ROS, exam findings and other clinically meaningful structured data.

---

# EXEC-0011 | ACTIVE | 11. PROBLEMS AND DIAGNOSTIC HYPOTHESES

A problem is longitudinal.

A diagnostic hypothesis is not automatically a confirmed problem.

Support explicit epistemic state such as:

```text
possible
probable
rule_out
confirmed
refuted
historical
resolved
```

For reasoning assistance, preserve:

```text
evidence_for
evidence_against
missing_information
confidence/status
source
```

AI confidence must not be presented as medical certainty.

---

# EXEC-0012 | ACTIVE | 12. ALLERGIES

Allergies are a collection, never a singleton field.

Minimum conceptual information:

```text
substance
category/type
reaction(s)
severity
clinical_status
verification_status
onset/date if known
source
provenance
```

"No known allergies" is an asserted clinical state with author/time, not an empty array inferred by UI.

---

# EXEC-0013 | ACTIVE | 13. VITAL SIGNS

Vitals are longitudinal observations.

Core set:

- blood pressure;
- heart rate;
- respiratory rate;
- oxygen saturation;
- temperature;
- weight;
- height;
- BMI derived with provenance.

Optional/contextual:

- capillary glucose;
- pain;
- waist circumference;
- Glasgow;
- pediatric anthropometrics;
- specialty-specific observations.

The UI should prioritize:

- current value;
- unit;
- measurement context;
- previous value;
- meaningful change;
- patient baseline/trend;
- validation warnings.

Do not over-alert on isolated values without context.

---

# EXEC-0014 | ACTIVE | 14. MEDICATION LIFECYCLE

Medication is not equivalent to prescription PDF.

Model lifecycle:

```text
proposed
prescribed
started
active
modified
held
stopped
completed
entered_in_error
```

Track:

- indication;
- medication concept/product;
- dose;
- route;
- frequency;
- duration;
- start/stop;
- response;
- adverse effects;
- monitoring obligations;
- reason for change;
- reconciliation status;
- provenance.

Calculated dose and prescribed dose are distinct values.

If a clinician overrides a meaningful medication safety warning, capture reason where appropriate.

---

# EXEC-0015 | ACTIVE | 15. PRESCRIPTION STUDIO

The visual prescription editor is a constrained renderer over structured clinical data.

Never allow visual customization to delete mandatory/required information.

Separate:

```text
clinical prescription data
from
visual template
from
rendered artifact
```

A template node may position or style approved fields, but it must not become the clinical source of truth.

Rendered prescription should be reproducible from signed clinical data + template version.

---

# EXEC-0016 | ACTIVE | 16. ORDERS, RESULTS AND ZERO LOST FOLLOW-UP

Canonical result loop:

```text
order
→ performed/not_performed/cancelled
→ result received
→ triage/priority
→ assigned owner
→ physician review
→ interpretation/action
→ patient communication when required
→ follow-up obligation if needed
→ closure
```

`received != reviewed`.

`reviewed != acted_on`.

`acted_on != patient_informed`.

Do not collapse these states.

Critical results require explicit handling and escalation semantics.

---

# EXEC-0017 | ACTIVE | 17. CLINICAL OBLIGATION

Use a first-class object for future medically important work.

Conceptual fields:

```ts
interface ClinicalObligation {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId?: string;
  problemId?: string;
  sourceRef?: ProvenanceRef;
  type: string;
  reason: string;
  ownerId: string;
  priority: "routine" | "important" | "urgent";
  dueAt?: string;
  status: "open" | "scheduled" | "in_progress" | "completed" | "cancelled" | "overdue";
  closureCriteria?: string;
  closedAt?: string;
  closedBy?: string;
  closureEvidence?: ProvenanceRef[];
}
```

No important follow-up should survive only as prose.

---

# EXEC-0018 | ACTIVE | 18. DOCUMENT INGESTION

Treat every uploaded clinical document as untrusted input.

Pipeline:

```text
upload
→ authorization
→ quarantine
→ malware scanning
→ hash
→ private object storage
→ metadata
→ classification
→ extraction/OCR if needed
→ candidate structured data
→ validation/reconciliation
→ authoritative structured objects
→ provenance links to original
```

The original remains immutable.

Extracted data must preserve document/page/source references.

Do not automatically transform extraction into clinical truth without the required validation path.

Use short-lived signed URLs or an authorized proxy; never public PHI URLs.

---

# EXEC-0019 | ACTIVE | 19. LABORATORY / QBP

A laboratory result is more than "high/low".

Preserve where available:

- analyte;
- original name;
- canonical code;
- value;
- unit;
- reference interval;
- abnormal flag;
- specimen;
- collection time;
- result time;
- laboratory/source;
- methodology where relevant;
- report/document provenance;
- corrected/amended state.

Do not compare longitudinal values without unit normalization/compatibility.

Trend engines must handle:

- unit changes;
- reference-range changes;
- corrected results;
- duplicate imports;
- missing dates;
- censored values (`<`, `>`);
- qualitative results.

AI-generated interpretation is advisory and must remain distinguishable from source laboratory data.

---

# EXEC-0020 | ACTIVE | 20. IMAGING

Separate:

```text
imaging order
imaging study
report
images/PACS reference
actionable finding
follow-up recommendation
clinical obligation
```

Do not pretend a PDF report is equivalent to DICOM imaging data.

Actionable incidental findings may create follow-up obligations only through governed rules/workflows.

Keep radiology source report immutable.

---

# EXEC-0021 | ACTIVE | 21. CLINICAL KNOWLEDGE

Clinical knowledge must not live as scattered `if` statements in React.

Use versioned knowledge packages.

Conceptual structure:

```ts
interface ClinicalKnowledgePackage {
  id: string;
  version: string;
  specialty: string;
  effectiveDate: string;
  reviewers: ReviewerRef[];
  sources: EvidenceSource[];
  applicability: ApplicabilityRule[];
  questions: QuestionDefinition[];
  redFlags: RuleDefinition[];
  focusedExam: RuleDefinition[];
  differentialHints: RuleDefinition[];
  orderConsiderations: RuleDefinition[];
  followUpRules: RuleDefinition[];
  safetyNet: RuleDefinition[];
}
```

The system must be able to identify which package/version contributed to a suggestion.

Differentiate visually and semantically:

```text
documentation reminder
clinical consideration
guideline recommendation
safety-critical alert
```

---

# EXEC-0022 | ACTIVE | 22. CLINICAL INTELLIGENCE ENGINES

Keep distinct responsibilities:

1. Patient State Engine
2. Clinical Reasoning Support
3. Omission Detection
4. Clinical Safety
5. Longitudinal Intelligence
6. Care Gap
7. Clinical Obligation
8. Knowledge & Evidence

Do not create one opaque "AI engine" that owns all clinical behavior.

Safety-critical deterministic logic must remain separable from probabilistic model output.

---

# EXEC-0023 | ACTIVE | 23. ALERT FATIGUE RULES

Severity taxonomy:

```text
INFO
CONSIDER
IMPORTANT
CRITICAL
```

`CRITICAL` must be rare.

Every alert class should have:

- clinical purpose;
- triggering rule;
- evidence/source;
- version;
- suppression/deduplication strategy;
- override behavior;
- metrics;
- retirement/review process.

Measure:

- firing rate;
- acceptance;
- dismissal;
- override;
- repeated firing;
- time-to-action;
- false-positive reports.

A rule that is clinically correct but constantly ignored may still be unsafe product design.

---

# EXEC-0024 | ACTIVE | 24. AI GATEWAY

All model calls pass through a controlled gateway.

Conceptual request:

```ts
interface ClinicalAIRequest {
  task: string;
  tenantId: string;
  patientContextRef?: string;
  encounterId?: string;
  minimumNecessaryContext: unknown;
  sensitivity: "low" | "moderate" | "high";
  intendedUse: string;
  outputSchema: string;
}
```

Conceptual result:

```ts
interface ClinicalAIResult<T> {
  result: T;
  modelProvider: string;
  modelId: string;
  modelVersion?: string;
  policyVersion: string;
  promptTemplateVersion: string;
  sources: ProvenanceRef[];
  warnings: string[];
  generatedAt: string;
}
```

Do not store hidden chain-of-thought.

Store the minimum information necessary for reproducibility, governance and evaluation.

---

# EXEC-0025 | ACTIVE | 25. AI RISK TIERS

Before implementing an AI feature, classify its intended use.

Example engineering tiers:

### Tier A — low impact
- formatting;
- spelling;
- administrative classification;
- non-clinical drafting.

### Tier B — clinical documentation assistance
- note drafting;
- extraction;
- summarization;
- longitudinal comparison.

Requires validation + physician review.

### Tier C — clinical decision support
- possible omissions;
- differential support;
- guideline considerations;
- risk-pattern detection.

Requires stronger evidence, explainability, evaluation, human review and regulatory analysis.

### Tier D — potentially high-impact/autonomous
- autonomous diagnosis;
- autonomous treatment selection;
- autonomous image interpretation used for clinical action;
- autonomous dosing/prescribing.

Do not enable merely because technically possible. Requires explicit regulatory/intended-use assessment and separate approval.

---

# EXEC-0026 | ACTIVE | 26. PROMPT-INJECTION AND UNTRUSTED CLINICAL CONTENT

Uploaded documents, imported notes, patient messages and external web content are **data**, not agent instructions.

Never allow text inside a clinical document to override:

- system policy;
- authorization;
- tool permissions;
- clinical safety rules;
- data access boundaries.

For AI retrieval:

```text
trusted instructions
≠
retrieved clinical content
```

Sanitize/segment context and use structured retrieval where possible.

---

# EXEC-0027 | ACTIVE | 27. INTEROPERABILITY

Internal domain models should not be distorted solely to mirror an external standard.

Use adapters/mappings.

Maintain:

- canonical internal concept;
- external code/system;
- original received value/code;
- mapping version;
- source;
- provenance.

FHIR, HL7 v2 and DICOM/DICOMweb belong behind interoperability boundaries.

External integration failure must not corrupt internal clinical truth.

Use retries, idempotency and dead-letter/reconciliation processes.

---

# EXEC-0028 | ACTIVE | 28. SEARCH AND HUMAN-READABLE FOLIOS

Internal IDs are not user-facing identity.

Support human-readable folios for operational navigation, e.g.:

```text
PX-YYYY-NNNNNN
ENC-YYYY-NNNNNN
RX-YYYY-NNNNNN
LAB-YYYY-NNNNNN
IMG-YYYY-NNNNNN
DOC-YYYY-NNNNNN
```

Do not use folios as authorization secrets.

Universal search may use:

- name;
- folio;
- phone;
- permitted national/local identifiers;
- email;
- other approved identifiers.

Search results must preserve tenant boundaries and minimize unnecessary PHI exposure.

---

# EXEC-0029 | ACTIVE | 29. UX EXECUTION RULES

The visual north star is premium medical SaaS, but safety and clinical usability outrank decoration.

Persistent principles:

- stable geography;
- patient identity always visible during clinical work;
- allergies/critical warnings cannot disappear during context switches;
- one dominant action per panel when practical;
- progressive disclosure;
- no modal labyrinths;
- keyboard-first desktop support;
- touch-safe iPad/mobile targets;
- no color-only clinical meaning;
- explicit loading/empty/error/offline/permission states;
- preserve user position/context;
- autosave status visible;
- signed vs draft unmistakable.

Target: clinically relevant patient state should be understandable in roughly **10–15 seconds** in common workflows.

Every visible component should answer at least one:

```text
Where am I?
Which patient?
What is happening?
What changed?
What is missing?
What is risky?
What is pending?
What should I do next?
```

If it answers none, challenge its existence.

---

# EXEC-0030 | ACTIVE | 30. DESIGN TOKENS

Brand color is not clinical severity.

Approximate product identity:

```text
Deep Violet     #514AA6
Primary Violet  #625BB9
Secondary Blue  #617ACB
Clinical Blue   #3F80D9
AI Violet       #7559D6
Background      #F5F6FA
Surface         #FFFFFF
Primary Text    #202237
Secondary Text  #70748A
```

Semantic status colors must be separate tokens.

Never use violet to mean clinical danger merely because violet is the brand color.

---

# EXEC-0031 | ACTIVE | 31. DATABASE RULES

Prefer normalized relational structures for authoritative clinical state.

JSONB is acceptable for:

- bounded extensibility;
- immutable snapshots;
- external payload archival;
- non-query-critical metadata.

Do not put the entire medical record in a giant JSON blob.

Every migration must consider:

- backward compatibility;
- locking;
- index creation strategy;
- data backfill;
- rollback/forward-fix;
- tenant isolation;
- audit/provenance effects;
- deployment ordering.

Use expand-and-contract for destructive schema evolution.

---

# EXEC-0032 | ACTIVE | 32. TRANSACTIONAL OUTBOX

For important events:

```text
BEGIN
  mutate domain state
  insert outbox event
  insert required audit/provenance
COMMIT
```

Worker later publishes/processes event idempotently.

Consumers must tolerate duplicate delivery.

Every externally triggered mutation should have an idempotency strategy.

---

# EXEC-0033 | ACTIVE | 33. WEBHOOK RULES

Assume:

- duplicate delivery;
- delayed delivery;
- out-of-order delivery;
- forged requests;
- replay attacks;
- provider outage;
- malformed payload;
- schema evolution.

Implement:

- signature verification;
- timestamp/replay protection where supported;
- idempotency key/event ID;
- durable receipt;
- bounded retries;
- dead-letter/reconciliation;
- observability.

A webhook must not directly become trusted clinical truth.

---

# EXEC-0034 | ACTIVE | 34. CACHING

Never cache sensitive clinical responses in a way that can cross users/tenants.

For derived Patient State:

- cache only when useful;
- scope keys by tenant + patient + relevant version;
- define invalidation;
- prefer stale-safe behavior;
- never serve a previous patient's state because of an ambiguous key.

Correctness outranks cache hit rate.

---

# EXEC-0035 | ACTIVE | 35. OBJECT STORAGE

Clinical binary files live in private object storage.

Database stores metadata such as:

- object key;
- tenant;
- owner/context;
- MIME type;
- size;
- cryptographic hash;
- upload status;
- scan status;
- provenance;
- retention/lifecycle state.

Do not trust filename extensions.

Validate MIME/content where practical.

---

# EXEC-0036 | ACTIVE | 36. SECURITY BASELINE

Apply defense in depth:

- MFA/passkeys for sensitive roles;
- secure session handling;
- server-side authz;
- tenant isolation;
- least privilege;
- CSP;
- CSRF protection where relevant;
- output encoding;
- input validation;
- SSRF controls;
- upload validation;
- secrets management;
- dependency scanning;
- SAST;
- secret scanning;
- rate limiting;
- abuse detection;
- encryption in transit and at rest;
- key rotation strategy;
- security headers;
- audit;
- incident response;
- backup/restore testing.

Never claim the system is "unhackable."

---

# EXEC-0037 | ACTIVE | 37. SUPPLY-CHAIN SECURITY

Pin dependencies and lockfiles.

CI should include as appropriate:

```text
secret scan
dependency vulnerability scan
license policy
lint
format
typecheck
unit tests
migration validation
integration tests
SAST
build
preview deployment
E2E
accessibility
clinical regression
security regression
human/CODEOWNER review
```

Generate an SBOM for release candidates when required by the release/compliance process.

Do not allow an AI agent to add arbitrary dependencies without explaining why existing dependencies/platform capabilities are insufficient.

---

# EXEC-0038 | ACTIVE | 38. TEST PYRAMID FOR MEDICAL OS

## Unit
Pure domain logic.

## Integration
DB, repositories, authorization, workflows, adapters.

## Contract
External integrations and schemas.

## E2E
Critical physician/patient workflows.

## Clinical regression
Known clinical scenarios and edge cases.

## Security regression
Cross-tenant, IDOR/BOLA, privilege escalation, injection, upload, session, rate-limit and data leakage.

## Reliability
Retries, duplicate events, queue failures, timeouts, partial outage.

## Migration
Upgrade, backfill, rollback/forward-fix.

## Accessibility/usability
Keyboard, screen reader semantics where required, touch, responsive states.

A feature is not complete merely because its happy path works.

---

# EXEC-0039 | ACTIVE | 39. REQUIRED ADVERSARIAL TEST CASES

For every high-impact clinical feature, consider at least:

- wrong patient open;
- duplicate patient;
- stale browser tab;
- two physicians editing;
- network disconnect during save;
- duplicate request;
- delayed worker;
- worker crash after side effect;
- partial database failure;
- malformed imported data;
- wrong unit;
- missing unit;
- contradictory values;
- corrected lab result;
- deleted/deactivated practitioner;
- changed tenant membership;
- break-glass access;
- daylight-saving/time-zone boundary;
- mobile interruption;
- document extraction error;
- AI hallucination;
- AI unavailable;
- AI output schema invalid;
- malicious text in uploaded document;
- patient portal token forwarded to another person.

Document why a case is not applicable rather than silently ignoring it.

---

# EXEC-0040 | ACTIVE | 40. OBSERVABILITY

Measure flows, not only servers.

Important SLIs may include:

- login success/latency;
- patient search latency;
- open Patient Workspace latency;
- draft save success/latency;
- encounter sign success;
- prescription generation;
- result ingestion lag;
- unreviewed result age;
- obligation overdue rate;
- workflow queue lag;
- notification delivery;
- AI task success/latency/fallback;
- cross-tenant security-test pass rate.

Use correlation IDs.

Do not place PHI into metric dimensions.

---

# EXEC-0041 | ACTIVE | 41. FAILURE MUST BE EXPLICIT

Every UI/API/workflow needs defined behavior for:

```text
loading
empty
permission denied
validation error
conflict
dependency unavailable
timeout
retrying
offline
partial success
permanent failure
```

Never display success before a critical mutation is durably committed.

For asynchronous work, distinguish:

```text
accepted
processing
completed
failed
requires_review
```

---

# EXEC-0042 | ACTIVE | 42. TIME AND TIME ZONES

Store instants in an unambiguous representation.

Maintain facility/user timezone for presentation and scheduling semantics.

Do not store clinically important dates as localized display strings.

Test:

- DST where applicable;
- cross-timezone telemedicine;
- midnight boundaries;
- date-only clinical concepts;
- specimen collection vs result time;
- medication schedule semantics.

---

# EXEC-0043 | ACTIVE | 43. PATIENT PORTAL / SHARE LINKS

Temporary share grants are capabilities, not ordinary public URLs.

A share grant should be:

- scoped to specific resource(s);
- time-limited;
- revocable;
- auditable;
- least-privilege;
- protected by additional verification when sensitivity warrants.

Never expose the entire chart through a permanent anonymous token.

---

# EXEC-0044 | ACTIVE | 44. COMMUNICATIONS

Separate:

```text
message delivery
from
clinical communication completion
```

A WhatsApp/email provider reporting "sent" does not prove the patient understood a critical clinical result.

Do not place unnecessary sensitive information in notification previews.

Templates must be versioned when clinically significant.

---

# EXEC-0045 | ACTIVE | 45. COMPLIANCE-AS-CODE

Do not write "compliant" because a feature appears reasonable.

Maintain traceability:

```text
jurisdiction
→ regulation/requirement
→ applicability
→ product requirement
→ technical control
→ code/config
→ test
→ evidence
→ owner
→ status
→ release
```

If applicability is uncertain, mark it for regulatory review.

Do not hard-code one country's regulatory rules into the universal clinical domain.

Use Country Packs/adapters where appropriate.

---

# EXEC-0046 | ACTIVE | 46. REGULATORY FEATURE GATING

For features that may cross into regulated clinical software functionality, maintain:

```text
feature
intended user
intended purpose
inputs
outputs
autonomy
physician reviewability
potential harm
clinical impact
jurisdiction
classification assessment
approval status
feature flag
```

Technical completion does not equal regulatory authorization.

---

# EXEC-0047 | ACTIVE | 47. CLINICAL SAFETY CASE

For safety-relevant features, document:

```text
hazard
hazardous situation
possible harm
initiating causes
existing controls
residual risk
verification evidence
monitoring signal
owner
```

A test suite is evidence, not the entire safety case.

---

# EXEC-0048 | ACTIVE | 48. REQUIREMENTS TRACEABILITY

Every meaningful implementation issue should map:

```text
V2 product requirement
→ V2.1 engineering requirement
→ risk/hazard
→ regulatory requirement if applicable
→ design/ADR
→ package/module
→ tests
→ evidence
→ release
```

No major V2 requirement may disappear merely because it was inconvenient to implement.

---

# EXEC-0049 | ACTIVE | 49. ISSUE CONTRACT

Before coding, every issue should state:

```text
ID
Title
Why
User/actor
Clinical objective
Scope
Out of scope
Dependencies
V2 requirement references
V2.1 requirement references
Data model impact
API/event impact
UX states
Authorization
Audit/provenance
Clinical safety
Privacy
Regulatory impact
AI impact
Observability
Failure modes
Migration
Rollback/forward-fix
Tests
Acceptance criteria
Definition of Done
```

If an issue is too large to satisfy this coherently, split it.

---

# EXEC-0050 | ACTIVE | 50. PULL REQUEST CONTRACT

A PR description should answer:

```text
What changed?
Why?
Which requirement?
Which risk?
Which data/schema changes?
Which permissions changed?
Which audit events changed?
Which clinical behavior changed?
Which tests prove it?
How does it fail?
How is it rolled back?
Screenshots for UX changes?
Any compliance evidence produced?
```

High-risk changes require independent review.

---

# EXEC-0051 | ACTIVE | 51. DEFINITION OF DONE

A feature is done only if applicable requirements are satisfied:

- acceptance criteria pass;
- server-side authorization exists;
- tenant isolation tested;
- audit/provenance implemented;
- error/empty/loading/conflict states exist;
- unit tests pass;
- integration tests pass;
- E2E exists for critical workflow;
- clinical regression exists for clinical behavior;
- security tests pass;
- no PHI leakage in logs;
- accessibility baseline passes;
- responsive behavior verified;
- migrations tested;
- observability exists;
- documentation/ADR updated;
- compliance evidence linked;
- clinical content has source/version/reviewer;
- feature flag/rollback strategy defined where appropriate.

"No compile errors" is not Definition of Done.

---

# EXEC-0052 | ACTIVE | 52. AGENT STOP CONDITIONS

Stop and request a decision instead of improvising when:

1. V2 and V2.1 conflict.
2. Required clinical behavior is unspecified and could affect patient safety.
3. A proposed feature changes intended medical use.
4. A migration could destroy clinical history.
5. A request weakens tenant isolation.
6. A request bypasses audit/provenance.
7. A critical workflow has no owner/terminal state.
8. AI is being asked to perform an irreversible clinical action autonomously.
9. A regulatory requirement is uncertain and implementation depends on the interpretation.
10. A security control would be knowingly bypassed to "ship faster."
11. A third-party service requires broader PHI disclosure than the documented minimum necessary.
12. Test failures indicate possible patient-safety or cross-tenant defects.

Return a concise `BLOCKED:` explanation plus the decision needed.

---

# EXEC-0053 | ACTIVE | 53. AGENT CHANGE CLASSIFICATION

Classify discoveries:

```text
BUG
SPEC-GAP
SPEC-CONFLICT
ARCH-CHANGE
CLINICAL-CHANGE
SAFETY-CHANGE
SECURITY-CHANGE
REGULATORY-CHANGE
UX-CHANGE
DATA-MIGRATION
V2.2-CANDIDATE
```

A `V2.2-CANDIDATE` is a structural lesson from real implementation/validation, not an excuse to redesign before evidence exists.

---

# EXEC-0054 | ACTIVE | 54. CODE REVIEW — ADVERSARIAL QUESTIONS

Reviewer should ask:

### Domain
- Can invalid clinical state be represented?
- Can a future obligation disappear?
- Can signed history be rewritten?
- Is "missing" confused with "negative"?

### Security
- Can another tenant access this by changing an ID?
- Can a lower role invoke the endpoint directly?
- Does a log/error leak PHI?
- Is untrusted external content being trusted?

### Concurrency
- Can stale data overwrite newer data?
- Are duplicate requests safe?
- Are retries idempotent?

### Clinical safety
- Could this create false reassurance?
- Could it hide a critical finding?
- Could it over-alert until users ignore it?
- Is physician review explicit?

### AI
- What happens when the model hallucinates?
- What happens when the model is unavailable?
- Is output schema validated?
- Is provenance visible?
- Is the model doing something deterministic code should do instead?

### UX
- Is the patient identity persistent?
- Is the primary next action clear?
- Are errors recoverable?
- Can the physician finish without unnecessary navigation?

---

# EXEC-0055 | ACTIVE | 55. PERFORMANCE BUDGET PHILOSOPHY

Optimize perceived clinical latency.

Prioritize:

1. patient search;
2. Patient Workspace opening;
3. encounter draft save;
4. signing;
5. result review;
6. prescription rendering.

Do not load an entire longitudinal chart into one initial payload.

Use panel-specific queries/read models and progressive loading.

Never trade clinical correctness for a marginal latency gain.

---

# EXEC-0056 | ACTIVE | 56. DATA MINIMIZATION

For each data flow ask:

```text
Do we need this field?
Do we need it for this actor?
Do we need it in this service?
Do we need it in this model prompt?
Do we need to retain it this long?
Do we need to log it?
```

Default to minimum necessary access/context.

---

# EXEC-0057 | ACTIVE | 57. THIRD-PARTY ADAPTER RULE

External providers must be replaceable behind an interface where practical.

Examples:

- email;
- WhatsApp/SMS;
- object storage;
- AI models;
- payment processors;
- terminology services;
- lab interfaces.

Domain code must not become vendor-specific.

Provider outage must have a documented degraded mode.

---

# EXEC-0058 | ACTIVE | 58. FEATURE FLAGS

Use feature flags for controlled rollout of high-risk/new capabilities.

Every temporary flag needs:

- owner;
- purpose;
- default state;
- cohort;
- expiry/review date;
- removal plan.

Never allow permanent flag debt to become hidden architecture.

Clinical behavior changes under a flag must remain auditable.

---

# EXEC-0059 | ACTIVE | 59. DATA MIGRATION FROM LEGACY/EXTERNAL RECORDS

Imported history must preserve source fidelity.

Distinguish:

```text
native structured data
imported structured data
human-validated extraction
AI-extracted candidate data
legacy document-only data
```

Never fabricate precision that the source did not contain.

Keep original source/document where legally/operationally required.

---

# EXEC-0060 | ACTIVE | 60. SYNTHETIC CLINICAL TEST CORPUS

Development and CI should use synthetic/de-identified test cases, not real patient charts.

Corpus should include:

- healthy/common cases;
- multimorbidity;
- polypharmacy;
- pediatrics;
- geriatrics;
- pregnancy-related contexts where supported;
- renal/hepatic impairment;
- allergies;
- conflicting documentation;
- corrected results;
- missing data;
- urgent/red-flag scenarios;
- extremely long charts;
- duplicate identities;
- unusual units;
- adversarial AI inputs.

Version the corpus.

---

# EXEC-0061 | ACTIVE | 61. LARGE-CHART TESTING

Test patients with:

- years of encounters;
- hundreds/thousands of observations;
- many documents;
- long medication history;
- numerous obligations;
- repeated corrected labs;
- multiple facilities/providers.

Ensure:

- Patient Workspace remains responsive;
- timeline paginates;
- search remains useful;
- derived state remains deterministic;
- AI context builder does not send entire chart blindly.

---

# EXEC-0062 | ACTIVE | 62. DOWNTIME / DEGRADED MODE

Define what happens when:

- database unavailable;
- object storage unavailable;
- queue unavailable;
- AI unavailable;
- messaging provider unavailable;
- terminology provider unavailable;
- interoperability endpoint unavailable.

Core clinical documentation should not depend unnecessarily on AI availability.

Show degraded state explicitly.

Never silently drop queued clinical work.

---

# EXEC-0063 | ACTIVE | 63. BACKUP AND RECOVERY

Backups are not proven until restore is tested.

Define and test:

- RPO;
- RTO;
- PITR;
- object-storage recovery;
- encryption/key dependency;
- restore validation;
- audit continuity;
- post-restore reconciliation of workflows/events.

Run restore drills before real clinical production.

---

# EXEC-0064 | ACTIVE | 64. INCIDENT RESPONSE

Severity should consider:

- patient safety;
- confidentiality;
- integrity;
- availability;
- tenant scope;
- duration;
- detectability;
- regulatory impact.

Examples of potentially severe incidents:

- cross-tenant exposure;
- incorrect patient association;
- signed-record corruption;
- lost critical result;
- medication safety defect;
- unauthorized bulk export.

Preserve forensic evidence without unnecessarily spreading PHI.

---

# EXEC-0065 | ACTIVE | 65. RELEASE GATES

No clinical production release solely because CI is green.

Release candidate should require applicable sign-off from:

- engineering;
- QA;
- product/clinical workflow;
- security;
- privacy/compliance;
- clinical safety;
- specialty board when relevant;
- AI governance when relevant.

Pilot before broad rollout for high-impact changes.

---

# EXEC-0066 | ACTIVE | 66. FIRST IMPLEMENTATION ORDER

Do not start with AI.

Recommended sequence:

```text
L00 Governance / repository
L01 Platform foundation
L02 Identity / tenancy / authorization
L03 Audit / provenance
L04 Clinical data foundation
L05 Patient identity / duplicate handling
L06 Patient Workspace skeleton
L07 Encounter state machine
L08 Adaptive history
L09 Vitals / examination
L10 Assessment / problem lifecycle
L11 Notes / signature / amendment
L12 Medication lifecycle
L13 Prescription rendering/studio
L14 Orders / results / obligations
L15 Document ingestion
L16 Laboratory
L17 Imaging
L18 Clinical intelligence deterministic layer
L19 AI gateway + low/moderate-risk assistance
L20 Patient portal/share grants
L21 Operations
L22 Interoperability
L23 Certification/pilot hardening
```

Build vertical slices that force end-to-end correctness.

---

# EXEC-0067 | ACTIVE | 67. FIRST GOLDEN VERTICAL SLICE

The first serious end-to-end proof should allow:

```text
create tenant/org/facility/practitioner
→ create/search patient
→ detect obvious duplicate risk
→ open Patient Workspace
→ create encounter
→ capture history
→ capture vitals/exam
→ create assessment/problem
→ create medication/prescription
→ order laboratory
→ sign encounter
→ ingest result
→ show Result Inbox
→ assign/review/action
→ communicate if required
→ create/close obligation
→ show everything in timeline
→ reconstruct audit/provenance
```

If this slice is unsafe or incoherent, do not scale to dozens of modules.

---

# EXEC-0068 | ACTIVE | 68. AGENT RESPONSE FORMAT FOR IMPLEMENTATION TASKS

Before editing:

```text
MODE:
ISSUE:
REQUIREMENTS:
FILES TO INSPECT:
RISKS:
PLAN:
TEST PLAN:
```

After editing:

```text
IMPLEMENTED:
FILES CHANGED:
MIGRATIONS:
TESTS RUN:
SECURITY IMPACT:
CLINICAL SAFETY IMPACT:
OBSERVABILITY:
KNOWN LIMITATIONS:
SPEC GAPS:
ROLLBACK:
NEXT DEPENDENCY:
```

Do not hide failed tests.

---

# EXEC-0069 | ACTIVE | 69. COMMIT DISCIPLINE

Prefer small, reviewable commits.

Commit message convention:

```text
feat(domain): ...
fix(domain): ...
refactor(domain): ...
test(domain): ...
security(domain): ...
docs(domain): ...
chore(platform): ...
```

A migration and the code that depends on it should have an understandable deployment relationship.

Avoid giant "implement Medical OS" commits.

---

# EXEC-0070 | ACTIVE | 70. WHAT NOT TO BUILD YET

Until foundational gates exist, do not prioritize:

- autonomous diagnosis;
- autonomous treatment;
- broad chart-to-LLM dumping;
- dozens of specialty forks;
- complex ERP;
- custom auth from scratch;
- uncontrolled marketplace integrations;
- decorative dashboards without actionable clinical value;
- microservices merely for prestige;
- blockchain;
- "AI everywhere" UI.

---

# EXEC-0071 | ACTIVE | 71. QUALITY BAR

A Medical OS feature should be rejected if it:

- adds physician work without clinical/operational benefit;
- hides important uncertainty;
- creates another place to remember to check;
- duplicates existing data entry;
- creates a dead-end workflow;
- cannot explain where its clinical data came from;
- cannot recover safely from failure;
- weakens privacy or tenant isolation;
- cannot be tested;
- cannot be audited where required;
- depends on AI when deterministic logic is safer;
- looks premium but behaves like generic CRUD.

---

# EXEC-0072 | ACTIVE | 72. PRODUCT SUCCESS TEST

The long-term target is not:

> "The physician learned how to use the software."

It is:

> "The physician can think more clinically because Medical OS remembers, organizes, connects, tracks and surfaces what matters without taking control away."

Every implementation decision should move toward that outcome.

---

# EXEC-0073 | ACTIVE | 73. BOOTSTRAP COMMAND FOR CODEX / CLAUDE CODE

Use this as the opening instruction after the repository contains V2, V2.1 and this companion:

```text
You are implementing Medical OS under the V2 Product & Clinical Specification,
the V2.1 Engineering & Implementation Specification, accepted ADRs, and
AGENTS.md / this execution companion.

Do not implement from memory or assumptions.

For the assigned issue:
1. read the relevant requirement sections;
2. inspect existing code and ADRs;
3. identify domain, security, privacy, clinical-safety and migration impact;
4. produce a concise plan;
5. implement only the approved scope;
6. add/update tests;
7. run the required gates;
8. report failures and spec gaps explicitly;
9. never weaken a safety/security invariant to make tests pass;
10. stop on unresolved clinically consequential ambiguity.

The physician remains the final clinical decision-maker.
No important clinical result or follow-up may be silently lost.
No signed clinical history may be destructively rewritten.
No tenant boundary may depend on frontend behavior.
No AI output becomes authoritative clinical truth without the approved human-review workflow.
```

---

# EXEC-0074 | ACTIVE | 74. DOCUMENT-TO-CODE GAP THIS FILE SOLVES

The DOCX specifications are intentionally suited to human architecture review. This Markdown companion exists because coding agents need additional properties that long-form documents provide poorly:

- short normative rules;
- explicit stop conditions;
- machine-scannable hierarchy;
- forbidden dependency paths;
- repeated safety invariants;
- standard pre/post task output;
- exact issue/PR contracts;
- concurrency/idempotency defaults;
- operational failure semantics;
- adversarial test prompts;
- rules for untrusted AI context;
- implementation order;
- agent role separation;
- change classification;
- a reusable bootstrap prompt.

Keep this file near the repository root (preferably as `AGENTS.md`, or referenced by `AGENTS.md`) so it is encountered before implementation.

---

# EXEC-0075 | ACTIVE | 75. FINAL RULE

**Never optimize Medical OS for the convenience of the coding agent. Optimize it for clinical integrity, physician cognition, patient continuity, security, and maintainable engineering.**

When speed conflicts with an invariant, the invariant wins.

When the specification is incomplete, expose the gap.

When evidence from implementation disproves the design, document it and escalate it as a candidate architectural change.

Do not silently improvise medicine.
Do not silently improvise security.
Do not silently improvise regulation.
Do not silently rewrite clinical truth.

---

# EXEC-0076 | ACTIVE | 76. COMPUTATION AUTHORITY CONSTITUTION

Medical OS must explicitly classify every computational clinical capability before implementation.

The governing law is:

> **Deterministic First. Knowledge-Grounded Second. AI Where Necessary. Physician Authority Always.**

A second non-negotiable law is:

> **AI-degraded must remain clinically safe.**

If all generative/probabilistic AI providers are unavailable, Medical OS must continue to provide a safe core for identity, encounter documentation, signed records, medication calculations, deterministic safety checks, orders, results, obligations, critical workflows, audit, provenance and continuity.

AI may increase intelligence, usability and synthesis. It must not be the sole mechanism that keeps a critical clinical workflow safe.

## 76.1 Four computation authorities

Every feature must be assigned to one or more layers:

### A. Deterministic Algorithm Engine
Use when the same validated inputs must produce the same output.

Examples:
- formulas;
- unit conversion;
- validated scores;
- dose arithmetic;
- age calculation;
- trend mathematics;
- reference-range comparison;
- deadlines;
- state machines;
- eligibility/applicability rules that are explicitly codified;
- ownership/escalation;
- duplicate-event protection;
- deterministic safety constraints.

### B. Knowledge Engine
Use when a recommendation depends on versioned medical knowledge, guideline applicability, terminology, evidence or local policy.

Examples:
- which questions are relevant to a complaint;
- guideline-derived monitoring requirements;
- preventive-care opportunities;
- medication monitoring requirements;
- evidence-linked clinical pathways;
- follow-up intervals;
- clinical content applicability;
- source-backed decision support.

### C. Probabilistic AI
Use when the problem materially involves unstructured language, semantic ambiguity, summarization, extraction, ranking, contextual synthesis or hypothesis generation.

Examples:
- clinical dictation → structured candidate data;
- PDF/report extraction;
- longitudinal summarization;
- semantic chart search;
- contextual explanation of deterministic trends;
- possible omission discovery beyond explicit rules;
- differential suggestions;
- draft documentation;
- semantic concordance findings.

### D. Physician Authority
Required for clinical decisions that depend on professional judgment or that create authoritative clinical action.

Examples:
- final diagnosis;
- treatment decision;
- prescription authorization;
- acceptance/rejection of clinically consequential AI suggestions;
- signing a note;
- clinically meaningful override;
- acknowledgement/action on critical findings;
- closure of obligations where professional verification is required.

No implementation issue may leave its computation authority implicit.

---

# EXEC-0077 | ACTIVE | 77. COMPUTATION AUTHORITY MATRIX

Initial normative matrix:

| Capability | Algorithm | Knowledge Engine | AI | Physician |
|---|---|---|---|---|
| Age/date arithmetic | AUTHORITATIVE | — | — | oversight |
| BMI | AUTHORITATIVE | formula metadata | — | interpretation |
| eGFR/validated formula | AUTHORITATIVE | formula/version/applicability | explanation only | interpretation |
| Pediatric mg/kg arithmetic | AUTHORITATIVE | approved dose range/source | explanation only | AUTHORITATIVE prescription |
| Unit conversion | AUTHORITATIVE | terminology/unit dictionary | — | oversight |
| Validated clinical score | AUTHORITATIVE | score definition/version | explanation | interpretation |
| Reference interval comparison | AUTHORITATIVE | source/reference metadata | explanation | interpretation |
| Mathematical trend | AUTHORITATIVE | — | contextual interpretation | decision |
| Result criticality | deterministic when codified | AUTHORITATIVE content/source | contextualize | action/closure |
| Medication interaction lookup | deterministic matching | AUTHORITATIVE knowledge source | contextualize | decision |
| Allergy-medication conflict | deterministic matching | terminology/knowledge | contextualize | decision |
| Care gap | applicability/time logic | AUTHORITATIVE guideline content | prioritize/explain | decision |
| Clinical coverage | completeness algorithm | AUTHORITATIVE Clinical Pack | prioritize/contextualize | decides what to ask/do |
| Pre-visit summary | source retrieval | relevance metadata | DRAFT AUTHORITY | validates |
| PDF extraction | schema validators | terminology | CANDIDATE EXTRACTION | validates when required |
| Longitudinal synthesis | deterministic facts/trends | evidence context | ASSISTIVE | interpretation |
| Differential generation | safety constraints | evidence/knowledge | SUGGESTIVE | AUTHORITATIVE |
| Diagnosis | validation constraints | evidence | ASSISTIVE ONLY | AUTHORITATIVE |
| Treatment selection | safety constraints | guidelines | ASSISTIVE ONLY | AUTHORITATIVE |
| Prescription | calculation/validation | pharmacologic knowledge | no autonomous authority | AUTHORITATIVE |
| Note signature | workflow | — | PROHIBITED | EXCLUSIVE |
| Critical result closure | workflow | escalation policy | no autonomous closure | AUTHORITATIVE where clinical |
| Clinical obligation deadline | AUTHORITATIVE | guideline interval | explain | confirms context |
| Clinical recommendation explanation | facts | source/evidence | ASSISTIVE | interpretation |
| Autonomous irreversible clinical action | — | — | PROHIBITED BASELINE | AUTHORITATIVE |

`AUTHORITATIVE` means authoritative only inside the defined computational scope, not authority to practice medicine.

---

# EXEC-0078 | ACTIVE | 78. ALGORITHM FACTORY — PROFESSIONAL ALGORITHM GENERATION PIPELINE

The goal is not to claim that an algorithm "beats 97% of human algorithms" without a defensible benchmark. Medical OS instead establishes a measurable engineering target:

> **For each approved deterministic algorithm, target ≥97% pass rate across the complete pre-release verification suite, while requiring 100% pass on designated safety-critical invariants and reference cases before release.**

This is a quality gate, not a claim of superiority over 97% of all algorithms ever written.

A deterministic algorithm must be generated rapidly **without sacrificing traceability, correctness or review** through a reusable Algorithm Factory.

## 78.1 Algorithm specification object

Before implementation, define:

```ts
interface ClinicalAlgorithmSpecification {
  id: string;
  name: string;
  version: string;
  intendedPurpose: string;
  clinicalDomain: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  preconditions: Rule[];
  exclusions: Rule[];
  formulaOrLogic: string;
  units: UnitContract[];
  referenceSources: EvidenceSource[];
  applicability: ApplicabilityRule[];
  edgeCases: EdgeCase[];
  failureBehavior: FailureBehavior[];
  safetyCriticalInvariants: Invariant[];
  referenceCases: ReferenceCase[];
  owner: ReviewerRef;
  clinicalReviewers: ReviewerRef[];
  effectiveDate: string;
  reviewDueAt: string;
}
```

No clinical algorithm starts as an anonymous utility function.

## 78.2 Generation sequence

```text
Clinical requirement
→ intended-purpose classification
→ authoritative source collection
→ input/output contract
→ applicability/exclusion definition
→ unit semantics
→ reference implementation
→ independent implementation
→ differential testing
→ property-based testing
→ boundary/edge-case generation
→ clinical reference cases
→ mutation testing
→ performance testing
→ security/abuse testing where relevant
→ independent review
→ signed algorithm manifest
→ versioned release
→ post-release monitoring
```

## 78.3 Dual implementation for high-risk algorithms

For high-risk arithmetic/decision logic, prefer two independently created implementations during validation:

```text
Specification
├── Reference implementation A
└── Independent implementation B
        ↓
Differential test corpus
        ↓
Any mismatch = release blocker until explained
```

The production implementation may remain singular after verification; the independent implementation is a validation oracle, not necessarily duplicated production code.

## 78.4 Property-based testing

Do not test only examples.

Generate broad input spaces and assert invariants.

Examples:
- conversion A→B→A remains within defined tolerance;
- increasing weight with constant mg/kg never decreases calculated mg;
- invalid/unknown units never silently produce a number;
- dates never produce negative age because of timezone formatting;
- a closed obligation cannot become silently open without an explicit transition;
- signed record version cannot mutate in place.

## 78.5 Mutation testing

For important algorithms, intentionally modify operators/conditions in test builds.

If tests still pass after clinically meaningful mutations, the test suite is inadequate.

## 78.6 Golden/reference cases

Maintain clinician-reviewed reference cases with:

- inputs;
- expected outputs;
- calculation steps;
- source/version;
- reviewer;
- tolerance;
- known exclusions.

Safety-critical golden cases require 100% agreement.

## 78.7 Algorithm quality score

Use a multidimensional score, never a single vague "accuracy" number.

Example dimensions:

```text
Reference-case correctness
Property-test pass rate
Boundary coverage
Mutation score
Branch coverage
Unit-semantic coverage
Applicability/exclusion coverage
Differential agreement
Performance
Determinism/reproducibility
Clinical reviewer approval
Source freshness
```

An algorithm with 99.9% ordinary test success but one failed critical invariant is **not releasable**.

---

# EXEC-0079 | ACTIVE | 79. ALGORITHM REGISTRY

Every released algorithm must be discoverable in a registry.

Conceptual record:

```ts
interface AlgorithmManifest {
  algorithmId: string;
  version: string;
  codeCommit: string;
  intendedPurpose: string;
  sourceVersions: SourceVersionRef[];
  testSuiteVersion: string;
  goldenCorpusVersion: string;
  validationReportId: string;
  riskTier: string;
  status: "draft" | "validation" | "approved" | "deprecated" | "retired";
  effectiveFrom: string;
  effectiveTo?: string;
  owners: ReviewerRef[];
}
```

Every clinically displayed calculated result should be able to expose the algorithm/version that produced it.

---

# EXEC-0080 | ACTIVE | 80. KNOWLEDGE ENGINE — CORE ARCHITECTURE

The Knowledge Engine is not an LLM prompt and not a collection of copied guidelines.

It is a **versioned, machine-readable, evidence-linked clinical knowledge platform**.

WHO SMART Guidelines provide an important architectural precedent: standards-based, machine-readable, adaptive, requirements-based and testable clinical content, including workflows, core data elements, decision-support logic and functional requirements.

Medical OS should adopt the same engineering philosophy while maintaining its own jurisdiction, specialty and product governance.

## 80.1 Knowledge layers

```text
L0 — Source Registry
L1 — Evidence Statements
L2 — Normalized Clinical Concepts
L3 — Applicability Rules
L4 — Computable Knowledge Artifacts
L5 — Clinical Packs / Pathways
L6 — Patient-specific evaluation
L7 — Explanation / provenance
L8 — Outcome and override feedback
```

The LLM is not a knowledge layer of record.

---

# EXEC-0081 | ACTIVE | 81. KNOWLEDGE SOURCE REGISTRY

Every knowledge source must carry metadata.

```ts
interface KnowledgeSource {
  id: string;
  title: string;
  issuingOrganization: string;
  jurisdiction: string[];
  specialty: string[];
  publicationDate?: string;
  effectiveDate?: string;
  retrievedAt: string;
  sourceUrlOrIdentifier: string;
  documentVersion?: string;
  evidenceType: string;
  status: "active" | "superseded" | "withdrawn" | "under_review";
  licenseOrUsageNotes?: string;
  contentHash?: string;
  supersedes?: string[];
}
```

Preferred hierarchy depends on the clinical question but should generally privilege:
- current law/regulation for legal requirements;
- current official guidelines from competent authorities;
- current specialty-society guidelines;
- high-quality systematic reviews/meta-analyses;
- validated drug/terminology databases;
- peer-reviewed evidence;
- local institutional policy only within its jurisdiction/context.

Do not automatically treat publication recency as evidence quality.

---

# EXEC-0082 | ACTIVE | 82. KNOWLEDGE FRESHNESS ENGINE

"Updated data" must be engineered, not assumed.

Every knowledge artifact has:

```text
source publication date
retrieval date
effective date
review date
next review due
superseded status
jurisdiction
source hash/version
dependent algorithms/rules
```

Create automated source watchers where legally/technically possible.

A source change triggers:

```text
SOURCE_CHANGED
→ impact analysis
→ identify dependent knowledge artifacts
→ clinical review
→ update candidate
→ regression tests
→ approval
→ version release
```

Never silently replace a clinical rule because a website changed.

For fast-moving domains, define shorter review intervals.

---

# EXEC-0083 | ACTIVE | 83. EVIDENCE NORMALIZATION

Do not copy prose directly into executable logic.

Pipeline:

```text
source
→ evidence extraction
→ human verification
→ atomic recommendation statements
→ population
→ intervention/action
→ comparator/context
→ outcome/purpose
→ strength/certainty if available
→ exceptions
→ timing
→ jurisdiction
→ terminology mapping
→ computable applicability
→ test cases
```

Store the original statement and location so reviewers can reconstruct the transformation.

---

# EXEC-0084 | ACTIVE | 84. TERMINOLOGY FOUNDATION

Knowledge must use canonical concepts rather than free-text string matching whenever feasible.

Use appropriate terminology systems/adapters for domains such as:

- LOINC for observations/laboratory/clinical measurements where applicable;
- SNOMED CT where licensed/applicable for clinical concepts;
- ICD for classification/reporting contexts;
- UCUM for units;
- RxNorm or jurisdiction-appropriate medication terminology where applicable;
- local/national catalogs through Country Packs.

Always preserve the original source code/text alongside mappings.

Terminology versions must be pinned and upgrade-tested.

---

# EXEC-0085 | ACTIVE | 85. KNOWLEDGE ARTIFACT MODEL

Conceptual artifact:

```ts
interface ComputableKnowledgeArtifact {
  id: string;
  version: string;
  title: string;
  intendedPurpose: string;
  jurisdiction: string[];
  population: ApplicabilityRule[];
  triggers: TriggerDefinition[];
  requiredData: DataRequirement[];
  logic: LogicExpression;
  outputs: KnowledgeOutput[];
  exclusions: Rule[];
  contraindications?: Rule[];
  evidence: EvidenceLink[];
  terminologyVersionRefs: VersionRef[];
  authoredBy: ReviewerRef[];
  reviewedBy: ReviewerRef[];
  status: "draft" | "validated" | "approved" | "deprecated";
  effectiveFrom: string;
  reviewDueAt: string;
}
```

The execution engine should support deterministic evaluation of these artifacts where possible.

---

# EXEC-0086 | ACTIVE | 86. KNOWLEDGE ENGINE EXECUTION CONTRACT

Patient-specific knowledge evaluation:

```text
Patient Clinical State
+
Encounter context
+
Country Pack
+
Specialty/Life-stage Pack
+
versioned Knowledge Artifacts
        ↓
Applicability evaluation
        ↓
Missing-data evaluation
        ↓
Deterministic recommendations / considerations
        ↓
Conflict/deduplication
        ↓
Priority/severity
        ↓
Explanation with source/version
        ↓
Optional AI contextualization
        ↓
Physician
```

AI must not be required to determine basic applicability when the knowledge can be expressed deterministically.

---

# EXEC-0087 | ACTIVE | 87. KNOWLEDGE CONFLICT RESOLUTION

Guidelines can disagree.

Never silently select one.

Represent conflicts:

```ts
interface KnowledgeConflict {
  topic: string;
  artifactA: string;
  artifactB: string;
  conflictType: "threshold" | "timing" | "population" | "treatment" | "evidence" | "jurisdiction";
  resolutionStatus: "unresolved" | "policy_selected" | "context_dependent";
  rationale?: string;
  approvedBy?: ReviewerRef[];
}
```

Resolution hierarchy may consider:

1. jurisdiction/legal applicability;
2. patient population;
3. intended setting;
4. evidence quality;
5. recency;
6. specialty governance;
7. local policy.

If still unresolved, expose the uncertainty rather than fabricating consensus.

---

# EXEC-0088 | ACTIVE | 88. KNOWLEDGE VALIDATION

Every executable knowledge artifact requires:

- source traceability;
- terminology validation;
- applicability tests;
- positive cases;
- negative cases;
- boundary cases;
- exclusion cases;
- conflicting-data cases;
- missing-data cases;
- clinical reviewer approval;
- regression suite.

A recommendation must not fire simply because one keyword appears in a note.

---

# EXEC-0089 | ACTIVE | 89. KNOWLEDGE PACK RELEASE PIPELINE

```text
source ingestion
→ evidence curator
→ clinical author
→ terminology mapping
→ computable logic author
→ independent clinical reviewer
→ QA corpus
→ safety review
→ regulatory impact review
→ approved package
→ canary/sandbox
→ monitored production release
```

Separate content release cadence from application release cadence.

Medical OS should be able to update approved clinical knowledge without requiring a full frontend deployment, while preserving version compatibility and auditability.

---

# EXEC-0090 | ACTIVE | 90. KNOWLEDGE ENGINE UPDATE SLAs

Assign source classes.

Example:

```text
Class A — urgent regulatory/safety notice
Class B — major guideline update
Class C — terminology release
Class D — ordinary evidence review
Class E — local policy update
```

Each class has:
- detection SLA;
- triage SLA;
- review SLA;
- deployment target;
- responsible board.

Do not promise "real-time medicine" if the governance process cannot safely validate updates.

---

# EXEC-0091 | ACTIVE | 91. AI + KNOWLEDGE ENGINE CONTRACT

The AI may retrieve and explain approved Knowledge Engine artifacts.

Preferred pattern:

```text
AI receives:
- patient facts selected by minimum-necessary context builder;
- deterministic calculations;
- applicable knowledge artifacts;
- evidence/source metadata;
- unresolved uncertainty.

AI returns:
- structured synthesis;
- possible considerations;
- missing information;
- explanation;
- citations/provenance.

AI does NOT:
- invent a guideline;
- hide conflicting guidance;
- substitute a source with model memory;
- modify the Knowledge Engine;
- mark an artifact approved;
- create a physician decision.
```

For clinical answers that materially depend on current evidence, retrieval from the approved knowledge corpus should be preferred over relying on pretrained model memory.

---

# EXEC-0092 | ACTIVE | 92. RAPID PROFESSIONAL ALGORITHM GENERATION

Speed comes from **standardization and automation**, not skipping review.

Build internal generators/scaffolds that can create:

```text
algorithm manifest
TypeScript function skeleton
Zod input/output schema
unit contracts
test skeleton
property-test skeleton
golden-case fixture
benchmark harness
documentation
audit metadata
registry entry
```

from a reviewed algorithm specification.

Example CLI concept:

```text
pnpm medos algorithm:new egfr-ckd-epi
pnpm medos algorithm:test egfr-ckd-epi
pnpm medos algorithm:validate egfr-ckd-epi
pnpm medos algorithm:manifest egfr-ckd-epi
```

Generation accelerates engineering but never auto-approves clinical content.

---

# EXEC-0093 | ACTIVE | 93. ALGORITHM DSL / EXPRESSION LAYER

For frequently updated deterministic clinical logic, consider a restricted typed expression language rather than arbitrary executable code.

Requirements:

- typed inputs;
- explicit units;
- no network access;
- no arbitrary filesystem access;
- deterministic execution;
- bounded runtime;
- versioned functions;
- explainable evaluation trace;
- testable expressions;
- safe sandbox.

Do not build a complex DSL until repeated use cases justify it. Start with typed code + schemas and extract a DSL only when evidence supports it.

---

# EXEC-0094 | ACTIVE | 94. EXPLAINABILITY TRACE

Every deterministic or knowledge-derived clinical suggestion should be reconstructable.

Example:

```text
Suggestion:
"Consider renal monitoring"

Because:
- active medication: X
- patient condition: Y
- last relevant test: date Z
- elapsed interval: N days
- applicable artifact: KA-RENAL-004 v3.2
- source: guideline/source version
- rule path: R4 → R7 → OUTPUT-2
```

This is more useful than a generic "AI thinks..." explanation.

---

# EXEC-0095 | ACTIVE | 95. DATA QUALITY GATE BEFORE INTELLIGENCE

Algorithms and Knowledge Engine must distinguish:

```text
verified
patient_reported
imported
AI_extracted_unverified
calculated
derived
unknown
conflicting
entered_in_error
```

Do not run high-impact logic as if low-confidence extracted data were verified clinical truth.

The Patient State Engine must propagate provenance and confidence/verification state.

---

# EXEC-0096 | ACTIVE | 96. CLINICAL RULE PERFORMANCE MONITORING

After release, monitor more than uptime.

For rules/algorithms:

```text
firing rate
eligible population
suppression rate
override rate
acceptance/action rate
false-positive reports
false-negative reports
time-to-action
clinical incident linkage
data-quality failure rate
version distribution
```

Monitoring data informs review; it must not automatically rewrite clinical logic.

---

# EXEC-0097 | ACTIVE | 97. 97% TARGET — PRECISE INTERPRETATION

The project ambition is extremely high, but quality claims must remain scientifically defensible.

Therefore:

**Forbidden claim:**
> "This algorithm is better than 97% of algorithms written by humans or AI."

unless a predefined representative benchmark and independent comparison actually demonstrate that statement.

**Required engineering target:**
- ≥97% overall pass across the defined comprehensive verification corpus before candidate approval;
- 100% pass for safety-critical invariants;
- 100% pass for approved golden/reference cases unless an explicitly documented tolerance applies;
- zero unexplained disagreement against the independent reference implementation for high-risk algorithms;
- no unresolved Severity-1/Severity-2 safety defects;
- required clinical reviewer approval;
- reproducible validation report.

The target should become stricter as risk increases.

---

# EXEC-0098 | ACTIVE | 98. KNOWLEDGE FRESHNESS TARGET

Knowledge Engine quality is evaluated on:

```text
source authority
source freshness
evidence traceability
terminology freshness
jurisdiction applicability
computability
test coverage
clinical review
conflict transparency
update latency
version reproducibility
```

"Newest" is not automatically "best."

The system should know both **how current** and **how authoritative** a knowledge artifact is.

---

# EXEC-0099 | ACTIVE | 99. COMPUTATION DECISION CHECKLIST FOR EVERY NEW FEATURE

Before implementation ask:

1. Can this be calculated exactly?
   - yes → Algorithm Engine first.
2. Does it depend on external/versioned clinical knowledge?
   - yes → Knowledge Engine.
3. Does it require semantic understanding or ambiguous unstructured context?
   - yes → consider AI.
4. Can deterministic logic safely constrain the AI?
   - if yes, implement constraint.
5. Does the output create or materially influence a clinical decision?
   - physician review required.
6. What happens if AI is unavailable?
   - define safe degraded mode.
7. What source/version supports the logic?
8. How will this be tested?
9. How will a future update be detected?
10. How will the physician understand why it fired?

No feature passes architecture review without these answers.

---

# EXEC-0100 | ACTIVE | 100. FINAL COMPUTATION LAW

Medical OS must never confuse intelligence with unpredictability.

The strongest implementation is usually:

```text
high-quality structured data
        ↓
deterministic computation
        ↓
versioned medical knowledge
        ↓
probabilistic AI synthesis where useful
        ↓
explicit safety validation
        ↓
physician judgment
        ↓
auditable clinical action
```

The system must use the **least probabilistic mechanism capable of solving the problem correctly**.

AI is used where it creates genuine semantic or cognitive leverage.

Algorithms are used where correctness can be specified.

Knowledge is used where medicine must remain evidence-linked and updateable.

The physician remains responsible for clinical judgment.

---

# EXEC-0101 | ACTIVE | 101. CLINICAL COMPUTATION PLATFORM — INFRASTRUCTURE FREEZE CANDIDATE

Sections 76–100 define computation authority and governance. Sections 101 onward define the production infrastructure required to execute that computation safely at scale.

This layer is called the **Clinical Computation Platform (CCP)**.

It is not a folder of formulas. It is a governed execution platform for deterministic clinical computation, versioned medical knowledge, provenance, validation, lifecycle management and safe failure.

Core law:

> **No clinically consequential computation exists only as application code. It exists as a versioned, owned, testable, reproducible and observable computational asset.**

The platform must remain correct under:
- large patient populations;
- long patient histories;
- concurrent users;
- duplicate/replayed events;
- delayed/out-of-order events;
- partial outages;
- source updates;
- terminology updates;
- algorithm upgrades;
- country differences;
- specialty differences;
- unit differences;
- missing/conflicting data;
- future model/provider changes;
- future regulatory classification changes.

“Infinite possibilities” are handled through explicit contracts, bounded state spaces, invariants, composability, property testing, scenario generation and safe unknown states—not by pretending every future case can be enumerated.

---

# EXEC-0102 | ACTIVE | 102. CCP COMPONENT MODEL

```text
Clinical application
      ↓
Computation Request API
      ↓
Context + Authorization
      ↓
Input Normalizer
      ↓
Terminology / Unit Resolver
      ↓
Applicability Engine
      ↓
Algorithm / Knowledge Resolver
      ↓
Approved Artifact Registry
      ↓
Execution Runtime
      ↓
Output Validator
      ↓
Safety Policy Engine
      ↓
Explanation + Provenance
      ↓
Result / Recommendation
      ↓
Audit + Metrics + Event
```

Supporting planes:

```text
AUTHORING PLANE
VALIDATION PLANE
CONTROL PLANE
RUNTIME PLANE
OBSERVABILITY PLANE
GOVERNANCE PLANE
```

Production runtime cannot author or approve its own clinical artifacts.

---

# EXEC-0103 | ACTIVE | 103. AUTHORING / VALIDATION / RUNTIME SEPARATION

## Authoring
Permits draft creation and modification.

Never used as clinical production authority.

## Validation
Runs:
- reference corpus;
- golden cases;
- property tests;
- metamorphic tests;
- fuzz tests;
- differential tests;
- mutation tests;
- load tests;
- clinical safety scenarios;
- terminology compatibility;
- backwards compatibility;
- regulatory impact checks.

## Runtime
Executes only immutable approved artifacts.

Production must reject:
- draft;
- unsigned/unapproved;
- unknown version;
- incompatible dependency;
- expired/withdrawn artifact where policy prohibits use.

Promotion:

```text
DRAFT
→ REVIEW
→ VALIDATION
→ APPROVED
→ STAGED
→ SHADOW
→ CANARY
→ ACTIVE
→ DEPRECATED
→ RETIRED
```

Emergency states:

```text
SUSPENDED
REVOKED
```

---

# EXEC-0104 | ACTIVE | 104. COMPUTATION REQUEST CONTRACT

Every execution is explicit.

```ts
interface ComputationRequest<I> {
  requestId: string;
  tenantId: string;
  patientId?: string;
  encounterId?: string;
  algorithmId: string;
  requestedVersion?: string;
  inputs: I;
  inputProvenance: InputProvenance[];
  jurisdiction?: string;
  facilityId?: string;
  occurredAt: string;
  requestedBy: PrincipalRef;
  purposeOfUse: string;
}
```

Never infer tenant authorization from `patientId`.

Never accept a client-provided algorithm version without server-side policy resolution.

---

# EXEC-0105 | ACTIVE | 105. COMPUTATION RESULT CONTRACT

```ts
type ComputationStatus =
  | "computed"
  | "not_applicable"
  | "not_computable"
  | "insufficient_data"
  | "conflicting_data"
  | "invalid_input"
  | "unsupported_unit"
  | "artifact_unavailable"
  | "dependency_unavailable"
  | "safety_blocked"
  | "runtime_error";

interface ComputationResult<O> {
  requestId: string;
  status: ComputationStatus;
  output?: O;
  algorithm: {
    id: string;
    version: string;
    artifactHash: string;
  };
  normalizedInputs?: unknown;
  warnings: StructuredWarning[];
  explanationTrace?: ExplanationNode[];
  provenance: ProvenanceRef[];
  computedAt: string;
}
```

Never convert `not_computable` into `0`, `normal`, `false` or an empty string.

Unknown is a first-class state.

---

# EXEC-0106 | ACTIVE | 106. NUMERIC PRECISION POLICY

Clinical computation must define numeric semantics deliberately.

Rules:
- never rely on JavaScript binary floating-point behavior for clinically sensitive decimal semantics without explicit analysis;
- use decimal/fixed precision where domain semantics require it;
- preserve source precision separately from display rounding;
- calculate before display rounding;
- define rounding mode per algorithm;
- define tolerance per reference test;
- never infer significant figures from UI formatting;
- store unit with value;
- never silently truncate.

Example conceptual value:

```ts
interface Quantity {
  value: string;        // exact decimal representation
  unit: string;         // canonical unit
  sourceValue?: string;
  sourceUnit?: string;
}
```

Each algorithm manifest declares:
- calculation precision;
- intermediate precision;
- output precision;
- rounding mode;
- display recommendation.

---

# EXEC-0107 | ACTIVE | 107. UNIT AND DIMENSION ENGINE

Units are not strings.

The Unit Engine must support:
- canonical units;
- dimensions;
- compatible conversion;
- original units;
- conversion provenance;
- explicit invalid dimensional operations.

Use UCUM semantics where appropriate.

Examples:
- mg and g are convertible;
- mg/dL and mmol/L require analyte-specific conversion where applicable;
- cm and kg are not compatible;
- `120` without a unit is not automatically `mg/dL`.

A unit mismatch in a safety-relevant calculation is a hard failure, not a warning followed by guessing.

---

# EXEC-0108 | ACTIVE | 108. APPLICABILITY ENGINE

Applicability is separate from computation.

```text
Can this algorithm apply?
        ↓ yes
Are required data valid/current enough?
        ↓ yes
Normalize inputs
        ↓
Compute
```

Applicability may include:
- age;
- biological/clinical context where relevant;
- pregnancy context;
- renal/hepatic context;
- population;
- indication;
- jurisdiction;
- setting;
- required measurements;
- timing;
- excluded conditions;
- algorithm/source-specific restrictions.

Do not calculate merely because the fields exist.

---

# EXEC-0109 | ACTIVE | 109. TEMPORAL SEMANTICS

Every clinical datum has temporal meaning.

Distinguish:
- observedAt;
- collectedAt;
- resultedAt;
- recordedAt;
- effectiveFrom/effectiveTo;
- importedAt;
- computedAt.

The platform must define freshness requirements per computation.

Example:
a weight from 18 months ago must not silently become the weight used for a current pediatric dose.

Algorithms can declare:

```ts
interface FreshnessRequirement {
  input: string;
  maxAge?: string;
  allowHistorical?: boolean;
  onStale: "reject" | "warn" | "require_confirmation";
}
```

---

# EXEC-0110 | ACTIVE | 110. DATA QUALITY AND TRUST POLICY

Inputs have trust metadata.

```text
clinician_verified
system_generated
device_imported_verified
external_structured
patient_reported
legacy_imported
AI_extracted_verified
AI_extracted_unverified
unknown_source
conflicting
entered_in_error
```

High-risk algorithms define minimum accepted trust levels.

AI-extracted-unverified data must never silently cross into high-impact deterministic computation.

---

# EXEC-0111 | ACTIVE | 111. ALGORITHM DEPENDENCY GRAPH

Algorithms, terminology, knowledge artifacts, country packs and reference datasets form a directed dependency graph.

Node types:

```text
Algorithm
KnowledgeArtifact
TerminologyRelease
ReferenceDataset
CountryPack
ClinicalPack
FormulaDefinition
RegulatoryPolicy
```

Edges:

```text
DEPENDS_ON
SUPERSEDES
IMPLEMENTS
USES_TERMINOLOGY
APPLIES_IN
DERIVES_FROM
VALIDATED_AGAINST
```

A source/version update must support impact analysis before deployment.

---

# EXEC-0112 | ACTIVE | 112. IMPACT ANALYSIS ENGINE

On any artifact update:

```text
artifact changed
→ identify direct dependents
→ traverse transitive dependents
→ identify affected algorithms
→ identify affected Clinical Packs
→ identify affected countries/specialties
→ identify required regression suites
→ classify clinical risk
→ generate change review
```

No high-impact dependency update is silently inherited.

---

# EXEC-0113 | ACTIVE | 113. HISTORICAL REPRODUCIBILITY

Medical OS must be able to explain a historical calculation using the exact historical computational environment.

Persist or reconstruct:
- algorithm ID/version/hash;
- knowledge artifact versions;
- terminology versions;
- input values;
- input provenance;
- normalization/conversions;
- rounding policy;
- execution timestamp;
- relevant Country Pack;
- result;
- explanation trace.

A future upgrade must not rewrite the historical meaning of an already recorded clinical calculation.

Recalculation under a newer version is a **new derived result**, linked to—not replacing—the historical result.

---

# EXEC-0114 | ACTIVE | 114. IMMUTABLE ARTIFACT REGISTRY

Approved computational artifacts are content-addressed/hashed and immutable.

Changing logic creates a new version.

Never overwrite:
`algorithm-x@2.1.0`

with different behavior.

Registry metadata includes:
- semantic version;
- artifact hash;
- source commit;
- dependency lock;
- build provenance;
- reviewers;
- approval;
- risk tier;
- validation report;
- effective dates;
- status.

---

# EXEC-0115 | ACTIVE | 115. SEMANTIC VERSIONING FOR CLINICAL COMPUTATION

Version changes are classified by behavioral impact, not only code shape.

Example:
- PATCH: defect correction with no intended clinical policy change;
- MINOR: backwards-compatible capability or supported population expansion;
- MAJOR: changed clinical interpretation, formula, thresholds, applicability or incompatible contract.

Any changed output for existing valid input requires explicit behavioral-diff review.

---

# EXEC-0116 | ACTIVE | 116. BEHAVIORAL DIFF ENGINE

Before activating a new algorithm/knowledge version, run old and candidate versions against a representative corpus.

Generate:

```text
unchanged outputs
changed outputs
newly applicable
no longer applicable
new warnings
removed warnings
severity changes
boundary changes
```

For each changed clinically consequential output, require classification:
- expected improvement;
- evidence-driven change;
- bug fix;
- regression;
- unexplained.

Unexplained high-risk differences block release.

---

# EXEC-0117 | ACTIVE | 117. SHADOW EXECUTION

Candidate versions may execute invisibly beside the active version.

```text
same production-like input
├── ACTIVE → physician-visible result
└── SHADOW → comparison only
```

Shadow output:
- never drives care;
- never creates clinical obligations;
- never sends patient communications;
- never alters signed records.

Use it to discover real-world divergence before activation while respecting privacy and governance.

---

# EXEC-0118 | ACTIVE | 118. CANARY ACTIVATION

After validation/shadow approval, candidate artifacts may be enabled to a controlled eligible cohort.

Canary selection must be deterministic and auditable.

Monitor:
- error rate;
- disagreement;
- override;
- safety signals;
- latency;
- data-quality failures.

Automatic rollback may occur for technical thresholds.

Clinical behavior rollback follows preapproved safety policy.

---

# EXEC-0119 | ACTIVE | 119. KILL SWITCH

Every high-impact computational artifact or AI capability must have a server-side kill switch.

Kill switch properties:
- audited;
- role restricted;
- fast;
- does not require redeploy;
- produces safe degraded behavior;
- communicates status to affected workflows.

Disabling an algorithm must not produce silent absence.

The UI/workflow must know the computation is unavailable.

---

# EXEC-0120 | ACTIVE | 120. SAFE DEGRADATION

For every computation define failure behavior.

Possible responses:
- block action;
- permit manual workflow;
- show unavailable;
- require clinician confirmation;
- use previously approved fallback version only when explicitly permitted;
- escalate operationally.

Never silently fall back from deterministic validated computation to generative AI.

Never silently fall back from an approved medical source to model memory.

---

# EXEC-0121 | ACTIVE | 121. EXECUTION ISOLATION

Algorithm execution should be pure or near-pure where feasible.

A clinical calculation should not:
- make arbitrary network calls;
- write directly to unrelated tables;
- send notifications;
- mutate signed records;
- access filesystem arbitrarily;
- invoke an LLM implicitly.

Side effects occur through explicit application/workflow services after validated output.

---

# EXEC-0122 | ACTIVE | 122. RESOURCE BUDGETS

Each algorithm declares operational limits where relevant:
- maximum input size;
- expected latency;
- timeout;
- memory ceiling;
- recursion/iteration bound;
- dependency budget.

A malformed input must not create unbounded computation.

---

# EXEC-0123 | ACTIVE | 123. IDEMPOTENCY AND REPLAY

Same logical request/event must not accidentally create duplicated downstream clinical effects.

Separate:
- deterministic recomputation;
- persistence;
- downstream action.

Use idempotency keys for event-driven workflows.

Replaying a result event must not create duplicate obligations, duplicate alerts or duplicate patient messages.

---

# EXEC-0124 | ACTIVE | 124. CONCURRENCY CONTROL

For computations that influence mutable clinical state:
- load expected aggregate/version;
- calculate against explicit snapshot;
- verify version at commit;
- reject/reconcile stale decisions.

Do not calculate from one patient-state version and silently commit against another materially changed version.

---

# EXEC-0125 | ACTIVE | 125. EVENT ORDERING

Assume events can arrive:
- late;
- duplicated;
- out of order;
- after correction;
- after encounter closure.

Algorithms that depend on chronology must use clinical timestamps and provenance, not queue arrival order alone.

---

# EXEC-0126 | ACTIVE | 126. CORRECTIONS AND ENTERED-IN-ERROR

When source clinical data is corrected:
- preserve old source record according to audit policy;
- mark correction relationship;
- identify derived computations;
- determine whether recomputation is required;
- never silently mutate signed historical output.

Derived state can update; historical provenance remains reconstructable.

---

# EXEC-0127 | ACTIVE | 127. COMPUTATION CACHE POLICY

Cache only when correctness permits.

Cache key must include all behavior-affecting dimensions:
- algorithm version;
- normalized input hash;
- dependency versions;
- jurisdiction/context where relevant.

Never return cached output generated by a different clinical artifact version.

High-risk cache invalidation must be testable.

---

# EXEC-0128 | ACTIVE | 128. EXPLANATION GRAPH

Explanations are structured graphs, not generated prose alone.

Nodes can represent:
- input;
- normalization;
- conversion;
- applicability rule;
- formula step;
- knowledge rule;
- source;
- warning;
- output.

AI may convert this graph into clinician-friendly language, but the underlying explanation remains deterministic and inspectable.

---

# EXEC-0129 | ACTIVE | 129. CLINICAL COMPUTATION PROVENANCE EVENT

Conceptual event:

```ts
interface ClinicalComputationEvent {
  eventId: string;
  tenantId: string;
  patientId?: string;
  encounterId?: string;
  algorithmId: string;
  algorithmVersion: string;
  artifactHash: string;
  inputHash: string;
  dependencyVersions: VersionRef[];
  status: ComputationStatus;
  outputHash?: string;
  principal: PrincipalRef;
  occurredAt: string;
  correlationId: string;
}
```

Do not put unnecessary PHI into telemetry.

Detailed clinical provenance belongs in protected clinical/audit storage with appropriate authorization.

---

# EXEC-0130 | ACTIVE | 130. RISK CLASSIFICATION

Every computational asset has a risk tier.

```text
C0 — non-clinical utility
C1 — low-impact clinical calculation
C2 — clinical interpretation support
C3 — medication/diagnostic decision support
C4 — safety-critical clinical computation
C5 — potentially regulated/high-impact software function
```

Risk tier determines:
- required reviewers;
- test depth;
- independent implementation requirement;
- clinical safety case;
- shadow/canary requirement;
- monitoring;
- release authority;
- rollback plan;
- regulatory review.

Risk tier is not self-declared by the coding agent.

---

# EXEC-0131 | ACTIVE | 131. TEST MATRIX BY RISK

Minimum expectations increase monotonically with risk.

C4/C5 should normally require:
- unit tests;
- integration tests;
- reference/golden cases;
- property tests;
- boundary tests;
- fuzz tests;
- metamorphic tests;
- differential implementation;
- mutation testing;
- behavioral diff;
- performance test;
- data-quality tests;
- concurrency/replay tests where applicable;
- clinical safety scenarios;
- independent clinical review;
- security review where applicable.

No coverage percentage substitutes for the above.

---

# EXEC-0132 | ACTIVE | 132. METAMORPHIC TESTING

When exact expected output is difficult to enumerate, test relationships that must remain true.

Examples:
- converting equivalent units must not change clinical meaning;
- ordering of unrelated input fields must not change result;
- adding irrelevant historical data must not alter a pure current calculation;
- identical normalized inputs must produce identical deterministic outputs;
- time-zone rendering must not change chronological clinical order.

---

# EXEC-0133 | ACTIVE | 133. FUZZING

Fuzz:
- numeric extremes;
- Unicode;
- malformed units;
- null/undefined;
- NaN/Infinity boundaries at adapters;
- dates;
- impossible physiology;
- huge histories;
- duplicated identifiers;
- adversarial imported data.

The objective is not merely “no crash”; it is safe explicit failure.

---

# EXEC-0134 | ACTIVE | 134. ADVERSARIAL CLINICAL CASE GENERATION

Create synthetic adversarial cases such as:
- adult value entered for pediatric patient;
- kg/lb confusion;
- mg/mcg confusion;
- stale weight;
- pregnancy-context conflict;
- duplicated lab with corrected result;
- result unit changed between laboratories;
- reference range changed;
- patient merge;
- late-arriving correction;
- missing sex/context needed by a formula;
- conflicting DOB;
- timezone boundary;
- implausible value;
- AI-extracted unverified value.

Expected behavior must be defined.

---

# EXEC-0135 | ACTIVE | 135. ALGORITHM VALIDATION REPORT

Every C3+ candidate produces a machine-readable and human-readable validation report.

Includes:
- intended use;
- excluded use;
- version;
- source evidence;
- dependency versions;
- test inventory;
- pass/fail;
- golden corpus;
- behavioral diff;
- known limitations;
- unresolved risks;
- reviewers;
- approval decision.

---

# EXEC-0136 | ACTIVE | 136. SAFETY CASE LINKAGE

C4/C5 algorithms link to a Clinical Safety Case.

Safety case includes:
- hazard;
- hazardous situation;
- potential harm;
- causes;
- controls;
- verification;
- residual risk;
- monitoring;
- rollback/kill strategy.

An algorithm is not “safe” because tests pass; safety is an evidence-backed argument.

---

# EXEC-0137 | ACTIVE | 137. OBSERVABILITY BY ALGORITHM VERSION

Metrics should permit questions such as:

```text
How often did A-004@3.2 run?
How often was it not computable?
Which unit errors occurred?
What is p95 latency?
How often did clinicians override its recommendation?
Did override rate change after 3.2?
Are failures concentrated in one lab/provider/country?
```

No raw PHI in metric labels.

---

# EXEC-0138 | ACTIVE | 138. POST-DEPLOY SAFETY SIGNALS

Create governed mechanisms for:
- clinician feedback;
- suspected false positive;
- suspected false negative;
- calculation discrepancy;
- terminology mismatch;
- inappropriate applicability;
- patient-safety incident.

Signals create review cases; they do not autonomously retrain/rewrite the algorithm.

---

# EXEC-0139 | ACTIVE | 139. ALGORITHM INCIDENT RESPONSE

Algorithm incident procedure:

```text
detect
→ classify severity
→ identify versions/populations affected
→ suspend/kill if necessary
→ preserve evidence
→ communicate operationally
→ determine patient-impact review need
→ remediate
→ independent validation
→ controlled reactivation
→ postmortem
```

Never erase the affected version from history.

---

# EXEC-0140 | ACTIVE | 140. KNOWLEDGE ENGINE — PRODUCTION PLATFORM

The Knowledge Engine is composed of:

```text
Source Registry
Evidence Ingestion
Evidence Graph
Terminology Service
Knowledge Authoring
Knowledge Compiler
Artifact Registry
Applicability Runtime
Conflict Resolver
Knowledge API
Explanation/Provenance
Freshness Monitor
Impact Analysis
Validation Corpus
Governance Workflow
```

RAG is an access technique, not the Knowledge Engine itself.

---

# EXEC-0141 | ACTIVE | 141. EVIDENCE GRAPH

Represent relationships between:
- source;
- recommendation;
- population;
- condition;
- intervention;
- monitoring;
- contraindication;
- outcome;
- evidence certainty;
- jurisdiction;
- artifact;
- algorithm.

This enables:
- source-to-rule traceability;
- rule-to-source traceability;
- impact analysis;
- conflict discovery;
- targeted updates.

Do not require graph-database adoption initially; logical graph semantics can exist over relational storage.

---

# EXEC-0142 | ACTIVE | 142. KNOWLEDGE COMPILER

Clinical prose does not execute directly.

```text
verified evidence statement
→ normalized clinical proposition
→ terminology mapping
→ applicability model
→ computable expression
→ static validation
→ test generation
→ compiled artifact
→ immutable registry
```

Compiler must reject:
- unresolved required terminology;
- missing source;
- missing version;
- ambiguous unit;
- invalid dependency;
- unbounded expression;
- prohibited side effect.

---

# EXEC-0143 | ACTIVE | 143. KNOWLEDGE ARTIFACT INTERMEDIATE REPRESENTATION

Define a typed intermediate representation (IR) so authoring UI, files and runtime do not depend on one prose format.

IR should support:
- boolean logic;
- comparisons;
- temporal constraints;
- set membership;
- terminology membership;
- numeric quantities with units;
- missing-data semantics;
- explicit uncertainty;
- recommendation outputs;
- evidence links.

Avoid Turing-complete clinical content unless a strong use case justifies it.

---

# EXEC-0144 | ACTIVE | 144. KNOWLEDGE RUNTIME SANDBOX

Knowledge expressions execute in a restricted environment:
- no arbitrary network;
- no arbitrary SQL;
- no filesystem;
- no dynamic code eval;
- bounded execution;
- deterministic functions only;
- approved terminology/data access functions.

This limits both bugs and malicious content.

---

# EXEC-0145 | ACTIVE | 145. SOURCE INGESTION TRUST BOUNDARY

External medical documents/web content are untrusted input.

Pipeline:

```text
retrieve
→ malware/content safety boundary
→ identify source
→ hash/version
→ extract candidate statements
→ human/approved verification
→ terminology normalization
→ author artifact
→ validate
```

Never allow retrieved prose or an LLM extraction to become executable clinical policy automatically.

---

# EXEC-0146 | ACTIVE | 146. SOURCE AUTHORITY SCORING

Do not use one simplistic “trust score” as clinical truth.

Track dimensions independently:
- issuing authority;
- evidence methodology;
- recency;
- jurisdiction;
- population fit;
- specialty relevance;
- legal/regulatory status;
- peer review;
- supersession state.

Policy can use these dimensions, but the raw dimensions remain visible.

---

# EXEC-0147 | ACTIVE | 147. KNOWLEDGE CONFLICT GRAPH

Conflicts are first-class.

Detect:
- threshold disagreement;
- interval disagreement;
- population disagreement;
- treatment disagreement;
- evidence-strength disagreement;
- jurisdictional disagreement.

A conflict can be:
- resolved by policy;
- context-dependent;
- unresolved.

AI may summarize the conflict; it cannot silently resolve governance.

---

# EXEC-0148 | ACTIVE | 148. KNOWLEDGE FRESHNESS MONITOR

Freshness monitor tracks:
- reviewDueAt;
- superseded sources;
- withdrawn guidance;
- terminology release changes;
- regulatory updates;
- failed source checks.

It creates governance work items.

It does not autonomously change active medical logic.

---

# EXEC-0149 | ACTIVE | 149. KNOWLEDGE UPDATE IMPACT

When source S changes:

```text
S
↓
Evidence statements
↓
Knowledge artifacts
↓
Clinical Packs
↓
Algorithms
↓
Screens/alerts/obligations
↓
Test suites
↓
Countries/specialties
```

Impact report is mandatory before activation for clinically consequential changes.

---

# EXEC-0150 | ACTIVE | 150. COUNTRY AND SPECIALTY OVERLAYS

Core knowledge must distinguish:
- globally applicable clinical concepts;
- jurisdiction-specific law/policy;
- local terminology/catalogs;
- specialty-specific content;
- facility policy.

Overlay precedence must be explicit.

A local policy cannot silently overwrite a legal requirement.

A Country Pack cannot fork the entire clinical domain.

---

# EXEC-0151 | ACTIVE | 151. KNOWLEDGE RETRIEVAL FOR AI

AI retrieval corpus should prioritize:
1. approved patient facts;
2. approved active knowledge artifacts;
3. approved evidence/source excerpts;
4. relevant historical chart evidence.

Model pretrained memory is not treated as authoritative clinical evidence.

Retrieval results carry:
- source ID;
- version;
- date;
- jurisdiction;
- artifact relationship;
- provenance.

---

# EXEC-0152 | ACTIVE | 152. AI OUTPUT VALIDATION AGAINST KNOWLEDGE

When AI makes a source-dependent clinical statement:
- require structured claim;
- link supporting artifact/source when available;
- validate referenced IDs;
- detect unsupported claims;
- label uncertainty;
- prevent invented citations.

High-risk unsupported clinical claims should be suppressed or presented as unverified, according to policy.

---

# EXEC-0153 | ACTIVE | 153. KNOWLEDGE ENGINE EVALUATION

Evaluate:
- correct applicability;
- incorrect firing;
- missed firing;
- source fidelity;
- terminology correctness;
- conflict handling;
- missing-data handling;
- explanation accuracy;
- update reproducibility.

Use clinician-reviewed synthetic/retrospective deidentified datasets only where lawful/approved.

---

# EXEC-0154 | ACTIVE | 154. SCALE ARCHITECTURE

Do not prematurely microservice the Clinical Computation Platform.

Begin as modular monolith packages with strict interfaces.

Extract services only when demonstrated by:
- independent scaling;
- security boundary;
- failure isolation;
- deployment cadence;
- specialized runtime;
- organizational ownership.

Correctness boundaries matter more than service count.

---

# EXEC-0155 | ACTIVE | 155. HIGH-AVAILABILITY PRINCIPLE

Critical charting and continuity cannot depend on every intelligence subsystem being online.

Failure hierarchy:

```text
AI unavailable
→ deterministic + knowledge core continues

Knowledge contextualization unavailable
→ approved deterministic core + manual clinical workflow

noncritical analytics unavailable
→ clinical workflow continues

critical deterministic computation unavailable
→ explicit block/manual verified fallback according to policy
```

No “green UI” when the safety subsystem is actually unavailable.

---

# EXEC-0156 | ACTIVE | 156. DISASTER RECOVERY FOR COMPUTATIONAL ASSETS

Back up and restore:
- artifact registry;
- manifests;
- source registry;
- knowledge artifacts;
- dependency graph;
- approval records;
- validation reports;
- terminology versions/config;
- provenance links.

A database restore without the corresponding algorithm/knowledge versions is not a complete clinical restore.

---

# EXEC-0157 | ACTIVE | 157. SUPPLY-CHAIN INTEGRITY

For computational artifacts:
- reproducible builds where feasible;
- dependency lockfiles;
- SBOM;
- signed CI provenance where supported;
- artifact hashes;
- protected release workflow;
- least-privilege CI;
- secret isolation;
- dependency vulnerability triage.

A compromised build pipeline can become a clinical safety problem.

---

# EXEC-0158 | ACTIVE | 158. CHANGE AUTHORITY

Coding agents may:
- implement approved specifications;
- generate tests;
- identify gaps;
- propose improvements.

Coding agents may not independently:
- change medical thresholds;
- change dose ranges;
- change criticality rules;
- approve knowledge;
- change regulatory interpretation;
- expand intended use;
- downgrade risk tier.

Those changes require the relevant governance path.

---

# EXEC-0159 | ACTIVE | 159. COMPUTATION ADR REQUIREMENTS

Create ADRs for at least:
- numeric/decimal strategy;
- unit engine;
- algorithm registry;
- artifact format;
- knowledge IR/compiler;
- execution sandbox;
- dependency graph;
- provenance model;
- versioning policy;
- shadow/canary;
- kill switch;
- safe degradation;
- terminology strategy;
- source ingestion;
- AI/Knowledge boundary.

Do not bury these decisions in implementation commits.

---

# EXEC-0160 | ACTIVE | 160. REFERENCE IMPLEMENTATION RULE

For high-risk algorithms, the reference implementation should be intentionally simple and independently reviewable.

Do not optimize it for performance.

Its purpose is to make correctness inspectable.

Production implementation can be optimized only after differential equivalence is established.

---

# EXEC-0161 | ACTIVE | 161. PERFORMANCE WITHOUT CORRECTNESS LOSS

Optimization order:

```text
correctness
→ safety
→ reproducibility
→ observability
→ latency
→ throughput
→ cost
```

Never remove validation/provenance to save milliseconds without explicit risk review.

Benchmark:
- cold execution;
- warm execution;
- batch;
- large chart;
- concurrent requests;
- degraded dependency.

---

# EXEC-0162 | ACTIVE | 162. BATCH COMPUTATION

Population-level recomputation must:
- be resumable;
- be idempotent;
- checkpoint;
- rate-limit;
- isolate tenant;
- record version;
- avoid overwhelming interactive clinical traffic;
- produce reconciliation report.

Never run an unbounded migration/recalculation synchronously in a web request.

---

# EXEC-0163 | ACTIVE | 163. LARGE PATIENT HISTORY STRATEGY

Algorithms receive bounded purpose-built views, not the entire chart.

Use:
- Patient State read models;
- time-windowed observations;
- problem-specific projections;
- indexed longitudinal series;
- explicit retrieval contracts.

This reduces latency, privacy exposure and accidental context contamination.

---

# EXEC-0164 | ACTIVE | 164. MULTI-TENANT SAFETY

Algorithm/knowledge execution must preserve tenant boundaries even if artifacts are globally shared.

Global artifact ≠ global patient data.

Cache, logs, queues, shadow execution and evaluation datasets must preserve isolation.

Cross-tenant tests are release gates.

---

# EXEC-0165 | ACTIVE | 165. PRIVACY MINIMIZATION

Computation request should include only required inputs.

Do not send:
- name;
- address;
- unrelated diagnoses;
- full note;
- complete chart

when the algorithm requires only age, sex/context, creatinine and timestamp.

Purpose-built context is mandatory.

---

# EXEC-0166 | ACTIVE | 166. REGULATORY CLASSIFICATION HOOK

Each computational asset includes:
- intended purpose;
- user;
- clinical action influenced;
- autonomy;
- explainability;
- risk;
- jurisdiction.

This permits future classification without rewriting the platform.

If classification changes, artifact can be gated by jurisdiction/feature flag while preserving the rest of Medical OS.

---

# EXEC-0167 | ACTIVE | 167. VALIDATION DATA GOVERNANCE

Validation datasets have:
- lawful provenance;
- allowed purpose;
- deidentification/synthetic status;
- version;
- inclusion criteria;
- bias/coverage description;
- retention policy;
- access controls.

Never copy production PHI into an agent benchmark for convenience.

---

# EXEC-0168 | ACTIVE | 168. COVERAGE DIMENSIONS

A “97%” aggregate must never hide weak populations.

Report stratified performance where applicable by:
- age group;
- relevant sex/clinical context;
- units;
- laboratory/provider;
- country;
- specialty;
- edge-case class;
- missing-data class;
- risk tier.

Release gates can require minimum subgroup performance.

---

# EXEC-0169 | ACTIVE | 169. UNKNOWN-UNKNOWN ENGINEERING

Unknown future cases are addressed through:
- explicit unknown states;
- strict validation;
- anomaly detection;
- safe failure;
- clinician override;
- incident feedback;
- versioned updates;
- adversarial testing;
- monitoring.

The platform must prefer:

```text
"I cannot safely compute this"
```

over a plausible but unsupported answer.

---

# EXEC-0170 | ACTIVE | 170. FORMAL METHODS ESCALATION

For selected C4/C5 state machines or invariants, consider stronger verification:
- model checking;
- state-transition exhaustiveness;
- property proofs;
- constraint solving;
- database invariant verification.

Examples:
- signed note immutability;
- critical result cannot close without required states;
- obligation lifecycle;
- authorization invariants;
- no impossible terminal-state transition.

Formal methods are applied where risk justifies cost, not as decoration.

---

# EXEC-0171 | ACTIVE | 171. STATE-MACHINE EXHAUSTIVENESS

Critical workflows define:
- states;
- allowed transitions;
- forbidden transitions;
- actor permissions;
- guards;
- side effects;
- idempotency behavior;
- timeout/escalation;
- terminal states.

Tests must attempt every forbidden transition.

---

# EXEC-0172 | ACTIVE | 172. CHAOS / FAILURE INJECTION

In nonproduction validation environments inject:
- DB latency;
- queue duplication;
- worker restart;
- terminology service failure;
- knowledge registry failure;
- AI outage;
- timeout;
- stale cache;
- network partition;
- delayed result.

Verify that the system fails visibly and safely.

Never perform uncontrolled chaos experiments on clinical production.

---

# EXEC-0173 | ACTIVE | 173. CLOCK AND TIME FAILURE TESTING

Test:
- DST;
- timezone changes;
- leap day;
- year boundaries;
- future timestamps;
- clock skew;
- delayed ingestion;
- retrospective entries.

Clinical timing logic must use explicit time semantics.

---

# EXEC-0174 | ACTIVE | 174. SECURITY ABUSE CASES

Test:
- algorithm ID enumeration;
- requesting forbidden version;
- cross-tenant patient reference;
- forged provenance;
- manipulated unit;
- oversized payload;
- replay;
- poisoned knowledge artifact;
- compromised source text;
- prompt injection through evidence;
- unauthorized kill switch.

---

# EXEC-0175 | ACTIVE | 175. CLINICIAN OVERRIDE CONTRACT

Override is not a generic “ignore” button.

Record where appropriate:
- what was overridden;
- version;
- actor;
- reason;
- timestamp;
- context;
- resulting action.

Do not force justification for trivial low-risk suggestions if it creates alert fatigue.

Risk tier controls override friction.

---

# EXEC-0176 | ACTIVE | 176. HUMAN FACTORS FOR COMPUTATION

Never expose raw infrastructure complexity to the physician.

Physician-facing output should answer:
- what was found/calculated;
- why it matters;
- what data were used;
- whether anything is missing;
- source/version when relevant;
- what action is available.

Deep provenance remains one interaction away.

---

# EXEC-0177 | ACTIVE | 177. CLINICAL CALCULATION UX

For high-impact calculations, permit inspection of:
- formula;
- inputs;
- units;
- input date;
- source;
- calculated value;
- prescribed/selected value if different;
- warnings.

Avoid false precision.

---

# EXEC-0178 | ACTIVE | 178. NO MAGIC NUMBERS

Clinically meaningful thresholds do not live as unexplained literals scattered through source code.

They belong in:
- approved algorithm specification;
- knowledge artifact;
- versioned configuration with governance,

depending on semantics.

Every threshold has provenance.

---

# EXEC-0179 | ACTIVE | 179. NO STRINGLY-TYPED MEDICINE

Avoid clinical logic such as:

```ts
if (diagnosis === "diabetes") ...
```

Use canonical typed concepts/identifiers and terminology mappings.

Free text can support search/display; it is not the primary authority for deterministic safety logic.

---

# EXEC-0180 | ACTIVE | 180. NO SILENT DEFAULTS

Dangerous examples prohibited:
- missing unit → assume mg;
- missing weight → use previous forever;
- unknown pregnancy context → assume no;
- missing allergy status → assume none;
- absent result → assume normal;
- unknown timezone → silently reinterpret clinical timestamp.

Defaults must be explicitly classified as safe and context-appropriate or not used.

---

# EXEC-0181 | ACTIVE | 181. COMPUTATION SECURITY BOUNDARY

Treat algorithm/knowledge definitions as code-equivalent assets.

Require:
- protected branches;
- CODEOWNERS;
- review;
- CI;
- signing/hashing;
- audit;
- least privilege.

A knowledge rule can cause clinical harm just as application code can.

---

# EXEC-0182 | ACTIVE | 182. AGENT-GENERATED ALGORITHM POLICY

Codex/Claude/other agents may accelerate creation through:
- specification scaffolding;
- implementation;
- independent implementation;
- test generation;
- edge-case generation;
- documentation;
- static analysis.

But for clinical algorithms:

```text
agent generation ≠ validation
test pass ≠ clinical approval
clinical approval ≠ regulatory clearance
deployment ≠ proof of safety
```

For high-risk algorithms, use different agent/context or human implementation for independent comparison where practical to reduce correlated errors.

---

# EXEC-0183 | ACTIVE | 183. CORRELATED-ERROR DEFENSE

Two implementations produced from the same prompt/source/model can share the same mistake.

Independent validation should vary:
- implementer;
- model/vendor when AI-assisted;
- prompt/context;
- implementation approach;
- test author;
- clinical reviewer.

Independence is a property of the process, not merely two files.

---

# EXEC-0184 | ACTIVE | 184. KNOWLEDGE SOURCE REDUNDANCY

For consequential recommendations, where appropriate, compare:
- primary guideline;
- relevant specialty guidance;
- regulatory/label information;
- high-quality evidence.

Do not manufacture consensus.

If only one authoritative source exists, record that fact.

---

# EXEC-0185 | ACTIVE | 185. EVIDENCE SNAPSHOTS

Preserve sufficient source/version metadata to reconstruct why an artifact was approved.

Where licensing permits, preserve controlled evidence snapshots/excerpts.

Where it does not, preserve identifiers, hashes, retrieval metadata and legally permitted metadata.

---

# EXEC-0186 | ACTIVE | 186. TERMINOLOGY UPGRADE REHEARSAL

Before terminology version activation:
- diff concepts;
- detect retired/replaced codes;
- validate mappings;
- identify affected patient data;
- identify affected knowledge rules;
- run regression corpus;
- verify search behavior.

Never bulk-rewrite historical source codes destructively.

---

# EXEC-0187 | ACTIVE | 187. KNOWLEDGE AUTHORING UX

Clinical reviewers need a dedicated authoring/review interface eventually.

It should show:
- source;
- extracted statement;
- normalized proposition;
- applicability;
- terminology;
- logic;
- test cases;
- conflicts;
- behavioral diff;
- approval history.

Do not require clinicians to review raw TypeScript to approve medical content.

---

# EXEC-0188 | ACTIVE | 188. GOVERNANCE QUORUM

C3+ clinical computation changes require defined approvals.

Conceptual:
- engineering owner;
- clinical domain reviewer;
- clinical safety reviewer;
- knowledge/terminology reviewer where relevant;
- security/privacy when relevant;
- regulatory reviewer for C5/regulated boundary.

Emergency suspension may require fewer actors than reactivation.

---

# EXEC-0189 | ACTIVE | 189. SEPARATION OF DUTIES

No single actor should be able to:
1. author high-risk clinical logic;
2. approve it;
3. deploy it to production;
4. erase its audit evidence.

Enforce separation through repository/release permissions as organization scale permits.

---

# EXEC-0190 | ACTIVE | 190. RELEASE EVIDENCE BUNDLE

Every clinically consequential release produces a bundle:

```text
artifact manifest
source/evidence manifest
dependency lock
validation report
behavioral diff
clinical approvals
safety case references
security results
known limitations
rollback plan
deployment record
```

This bundle is part of the product's evidence system.

---

# EXEC-0191 | ACTIVE | 191. COMPUTATION PLATFORM SLOs

Define SLOs separately for:
- low-risk calculation;
- high-risk calculation;
- knowledge lookup;
- explanation;
- provenance persistence.

Availability alone is insufficient.

Track correctness-related operational indicators such as not-computable spikes and dependency-version failures.

---

# EXEC-0192 | ACTIVE | 192. LATENCY BUDGETS

The physician should not wait for AI when deterministic computation can finish immediately.

Preferred ordering:

```text
render known patient context
→ run local/server deterministic checks
→ render knowledge-derived findings
→ stream AI synthesis asynchronously
```

AI latency must not block core encounter documentation unless explicitly required.

---

# EXEC-0193 | ACTIVE | 193. COST CONTAINMENT

Deterministic algorithms and knowledge rules should not incur LLM cost.

AI routing should use:
- smallest sufficient model;
- bounded context;
- caching only where safe;
- task-specific model;
- no repeated full-chart prompts.

Cost optimization must never remove required safety context.

---

# EXEC-0194 | ACTIVE | 194. FUTURE HARDWARE / MODEL INDEPENDENCE

Clinical Computation Platform contracts must not depend on:
- one cloud;
- one LLM vendor;
- one GPU;
- one vector database;
- one terminology vendor.

Adapters isolate providers.

Clinical truth remains in Medical OS-controlled structured artifacts and provenance.

---

# EXEC-0195 | ACTIVE | 195. COMPUTATION MIGRATION POLICY

When replacing an algorithm:
- preserve old version;
- activate new version prospectively;
- define whether historical recomputation is clinically useful;
- never rewrite signed records;
- link recalculated values as new derived evidence;
- communicate changed interpretation when clinically necessary.

---

# EXEC-0196 | ACTIVE | 196. PATIENT MERGE / SPLIT EFFECTS

Patient identity operations can invalidate derived state.

Merge/split workflow must:
- identify derived computations;
- recompute current state where appropriate;
- preserve original provenance;
- prevent cross-patient contamination;
- audit every reassignment.

---

# EXEC-0197 | ACTIVE | 197. DEVICE / LAB SOURCE VARIABILITY

Clinical computations must not assume every source has identical:
- units;
- reference ranges;
- assay methods;
- flags;
- precision;
- timestamps.

Preserve source-specific metadata.

Knowledge/algorithm applicability may depend on method.

---

# EXEC-0198 | ACTIVE | 198. REFERENCE RANGE MODEL

Reference intervals are structured objects with:
- analyte;
- unit;
- lower/upper bounds;
- inclusivity;
- population/context;
- age range;
- method/lab;
- effective dates;
- source.

Do not hardcode one “normal range” globally when medicine/source context differs.

---

# EXEC-0199 | ACTIVE | 199. CRITICAL VALUE MODEL

Critical values require governance separate from ordinary reference ranges.

Model:
- analyte;
- threshold;
- direction;
- population;
- facility/lab policy;
- jurisdiction where relevant;
- effective dates;
- escalation workflow.

A critical value rule is versioned and auditable.

---

# EXEC-0200 | ACTIVE | 200. MEDICATION COMPUTATION BOUNDARY

Medication calculation separates:
1. drug knowledge;
2. indication/context;
3. patient parameters;
4. dose-range knowledge;
5. arithmetic;
6. formulation/concentration;
7. rounding/measurement constraints;
8. final physician prescription.

Never collapse all eight into an LLM response.

---

# EXEC-0201 | ACTIVE | 201. DOSING SAFETY PIPELINE

```text
Medication concept
→ indication/context
→ patient applicability
→ current weight/body metric validity
→ renal/hepatic considerations where defined
→ source-backed dose range
→ deterministic arithmetic
→ formulation conversion
→ max/min constraints
→ measurement feasibility
→ warnings
→ physician-selected final dose
```

Store calculated and prescribed values separately.

---

# EXEC-0202 | ACTIVE | 202. PEDIATRIC HARDENING

Pediatric computations require extra checks:
- exact age;
- gestational/corrected age where relevant;
- weight timestamp;
- plausible weight;
- kg normalization;
- dose per kg or surface area as defined;
- max dose;
- concentration;
- measurement precision;
- formulation;
- source/version.

A stale or implausible weight can block high-risk calculation.

---

# EXEC-0203 | ACTIVE | 203. LAB TREND ENGINE

Trend computation should be deterministic.

Components:
- canonical analyte mapping;
- unit harmonization;
- method awareness;
- timestamp ordering;
- corrected-result handling;
- baseline selection;
- delta;
- percent delta;
- slope;
- persistence;
- variability;
- configurable clinically meaningful thresholds.

AI interprets trends; it does not invent the underlying series.

---

# EXEC-0204 | ACTIVE | 204. LONGITUDINAL BASELINE ENGINE

Baseline is not always “first value”.

Support explicit baseline strategies:
- earliest valid;
- most recent stable period;
- pre-treatment;
- clinician-selected;
- rolling baseline;
- guideline-defined.

The selected strategy is recorded and explainable.

---

# EXEC-0205 | ACTIVE | 205. ANOMALY DETECTION BOUNDARY

Statistical/ML anomaly detection can identify unusual patterns but does not become clinical truth.

Output:
- anomaly score;
- reason/features where available;
- comparison baseline;
- confidence/uncertainty;
- provenance.

Clinical safety actions require deterministic/knowledge policy or physician review.

---

# EXEC-0206 | ACTIVE | 206. COMPUTATION COMPOSITION

Complex clinical intelligence should compose smaller validated primitives.

Example:

```text
normalized lab series
→ trend primitive
→ persistence primitive
→ knowledge applicability
→ care-gap/monitoring rule
→ physician-facing consideration
```

Avoid one giant opaque “medical intelligence” function.

---

# EXEC-0207 | ACTIVE | 207. CYCLE AND RECURSION CONTROL

Dependency graph must reject unintended cycles.

If legitimate iterative algorithms are introduced:
- bounded iterations;
- convergence criteria;
- timeout;
- deterministic seed where relevant;
- explicit validation.

---

# EXEC-0208 | ACTIVE | 208. FEATURE OWNERSHIP

Every algorithm/knowledge artifact has:
- engineering owner;
- clinical owner;
- safety owner;
- review due date.

Orphaned high-risk artifacts cannot remain indefinitely active.

---

# EXEC-0209 | ACTIVE | 209. DEPRECATION POLICY

Deprecation includes:
- reason;
- replacement;
- affected use cases;
- effective date;
- migration guidance;
- historical availability;
- monitoring.

Retired artifact remains reconstructable for historical provenance.

---

# EXEC-0210 | ACTIVE | 210. END-TO-END COMPUTATION ACCEPTANCE SCENARIO

A release candidate must demonstrate:

```text
patient data entered/imported
→ provenance recorded
→ unit normalized
→ applicability evaluated
→ approved algorithm resolved
→ computation executed
→ knowledge artifact evaluated
→ explanation produced
→ physician sees result
→ physician accepts/overrides where relevant
→ action/obligation created if chosen
→ audit persisted
→ historical reconstruction succeeds
→ new algorithm version can run in shadow
→ rollback/kill switch succeeds
```

---

# EXEC-0211 | ACTIVE | 211. PROHIBITED AMATEUR PATTERNS

The following block release:

- clinical formulas embedded in UI components;
- magic numbers;
- unversioned thresholds;
- units represented only as labels;
- floating-point assumptions without precision policy;
- `null` interpreted as normal;
- stale data silently reused;
- one giant `clinicalRules.ts`;
- guideline prose pasted into prompts as production policy;
- internet RAG directly driving critical decisions;
- AI deciding whether its own output is safe;
- algorithm updates without behavioral diff;
- deleting old algorithm versions;
- cache without versioned key;
- cross-tenant evaluation corpus;
- production PHI used casually for testing;
- silent fallback to AI;
- silent fallback to old medical knowledge;
- no kill switch;
- no safe-degraded state;
- no owner;
- no validation report;
- no clinical reviewer;
- “tests passed” used as the entire safety argument.

---

# EXEC-0212 | ACTIVE | 212. PRINCIPAL-ENGINEER REVIEW QUESTIONS

Before approving infrastructure ask:

1. Can every historical result be reproduced?
2. Can every threshold be traced?
3. Can every unit conversion be reconstructed?
4. Can a new version be compared against the old?
5. Can it run in shadow?
6. Can it be killed without redeploy?
7. Does failure become visible?
8. Can the physician continue safely without AI?
9. Can stale/unverified data be prevented from entering high-risk computation?
10. Can a source update identify every downstream dependency?
11. Can an agent modify medical policy without approval? It must not.
12. Can a tenant ever influence another tenant's computation? It must not.
13. Can duplicated/out-of-order events cause duplicate clinical actions? They must not.
14. Can an algorithm silently change behavior without a new immutable version? It must not.
15. Can a clinician understand why a clinically important result appeared?
16. Can safety reviewers prove the critical state-machine invariants?
17. Can rollback preserve audit/provenance?
18. Can the platform survive AI/knowledge/provider outages?
19. Can we demonstrate validation evidence rather than assert quality?
20. Is the simplest safe mechanism being used?

Any “no” requires a documented blocker or risk acceptance by the proper authority.

---

# EXEC-0213 | ACTIVE | 213. CLINICAL COMPUTATION PLATFORM FREEZE GATE

This architecture becomes frozen only after the implementation team creates and approves the corresponding ADRs and proves a vertical slice containing at minimum:

- one low-risk formula;
- one high-risk medication calculation;
- one longitudinal trend;
- one knowledge artifact;
- one applicability rule;
- one unit conversion;
- one not-computable case;
- one stale-data case;
- one corrected-result case;
- one shadow version;
- one behavioral diff;
- one kill-switch exercise;
- one historical reproduction;
- one knowledge source update impact analysis;
- one cross-tenant isolation test;
- one failure-injection test.

Until that evidence exists, this section is a **freeze candidate**, not a claim of production perfection.

---

# EXEC-0214 | ACTIVE | 214. FINAL INFRASTRUCTURE LAW

Medical OS must be designed for enormous combinatorial clinical complexity without pretending that every clinical possibility can be predicted.

The platform handles complexity by enforcing:

```text
typed data
+ explicit units
+ explicit time
+ explicit provenance
+ deterministic primitives
+ versioned knowledge
+ bounded composition
+ explicit uncertainty
+ independent validation
+ immutable artifacts
+ dependency analysis
+ controlled release
+ observable runtime
+ safe failure
+ physician authority
```

The objective is not an algorithm that appears intelligent.

The objective is a **Clinical Computation Platform whose correctness can be inspected, challenged, reproduced, upgraded, disabled and defended with evidence.**

When uncertainty cannot be safely resolved:

> **Medical OS must fail explicitly rather than fabricate certainty.**

---

# EXEC-0215 | ACTIVE | 215. ULTRA-HARDENING REVIEW — SYSTEMIC FAILURE ANALYSIS

This section records a further principal/staff-level review of the Clinical Computation Platform.

The objective is not ornamental complexity. Every added mechanism must eliminate a concrete failure class, create evidence, improve recoverability, or reduce ambiguity.

The following failure classes require explicit architecture:
- specification ambiguity;
- correlated implementation error;
- semantic drift;
- unit/terminology drift;
- temporal inconsistency;
- provenance loss;
- dependency drift;
- unsafe partial failure;
- stale derived state;
- incorrect recomputation;
- non-deterministic builds;
- hidden configuration drift;
- validation-data leakage;
- benchmark overfitting;
- feedback loops;
- alert/rule interaction explosions;
- combinatorial rule conflicts;
- authorization-context loss in asynchronous work;
- unsafe rollback;
- irreversible migration;
- silent evidence supersession;
- false confidence from aggregate metrics.

---

# EXEC-0216 | ACTIVE | 216. SPECIFICATION AS EXECUTABLE CONTRACT

For C3+ algorithms, prose specification alone is insufficient.

Maintain a machine-checkable contract containing:
- input schema;
- unit schema;
- temporal constraints;
- applicability;
- exclusions;
- invariants;
- output schema;
- failure semantics;
- dependency versions;
- reference cases.

The contract and implementation must be tested against each other.

A change to the contract triggers behavioral review even if implementation code is unchanged.

---

# EXEC-0217 | ACTIVE | 217. REQUIREMENT-TO-RUNTIME TRACEABILITY

Every clinically consequential runtime output must trace backward:

```text
runtime output
→ algorithm/knowledge artifact
→ implementation version
→ validation report
→ specification
→ product requirement
→ evidence/source
→ approving authority
```

And forward:

```text
source/requirement
→ affected artifacts
→ affected tests
→ affected screens/workflows
→ affected releases
```

Traceability must be queryable, not maintained only in prose.

---

# EXEC-0218 | ACTIVE | 218. CONFIGURATION IS CODE-EQUIVALENT

Clinically meaningful configuration is governed like code.

Examples:
- thresholds;
- escalation intervals;
- critical-value policies;
- feature applicability;
- country overrides;
- dose rounding policy.

Requirements:
- versioned;
- reviewed;
- validated;
- auditable;
- environment promotion;
- rollback;
- no direct production editing for high-risk settings.

---

# EXEC-0219 | ACTIVE | 219. ENVIRONMENT PARITY AND DRIFT DETECTION

Clinical behavior must not differ accidentally between validation and production.

Track:
- artifact versions;
- terminology versions;
- environment variables affecting behavior;
- database extensions;
- runtime versions;
- feature flags;
- country packs;
- external adapter versions.

Generate an environment fingerprint.

Unexpected drift in clinically relevant dependencies blocks promotion.

---

# EXEC-0220 | ACTIVE | 220. DETERMINISTIC BUILD AND EXECUTION FINGERPRINT

For every high-risk computation, produce a fingerprint from:
- source commit;
- build artifact hash;
- dependency lock;
- algorithm manifest;
- terminology manifest;
- knowledge manifest;
- runtime major version;
- relevant configuration hash.

This allows forensic reconstruction of behavior.

---

# EXEC-0221 | ACTIVE | 221. FEATURE-FLAG SAFETY MODEL

Feature flags influencing clinical behavior require:
- owner;
- intended population;
- default state;
- expiration/review date;
- audit;
- compatibility tests;
- rollback behavior.

Never allow an expired experimental clinical flag to remain indefinitely.

Flag combinations with clinical consequences require pairwise/combinatorial testing proportional to risk.

---

# EXEC-0222 | ACTIVE | 222. COMBINATORIAL INTERACTION TESTING

Many defects emerge from interactions rather than isolated algorithms.

Use pairwise/t-wise testing for combinations such as:
- country pack;
- specialty pack;
- age group;
- unit system;
- feature flags;
- algorithm version;
- terminology version;
- missing-data state;
- patient-state status.

For high-risk combinations, define explicit scenario suites.

Do not attempt exhaustive Cartesian-product testing when impossible; use risk-based combinatorial design plus invariants.

---

# EXEC-0223 | ACTIVE | 223. RULE INTERACTION GRAPH

Rules can conflict even when individually correct.

Build a graph of:
- triggers;
- outputs;
- suppressions;
- dependencies;
- mutual exclusions;
- priorities.

Detect:
- contradictory recommendations;
- circular triggering;
- duplicate alerts;
- impossible obligations;
- escalation storms.

Run static interaction analysis before knowledge-pack activation.

---

# EXEC-0224 | ACTIVE | 224. CONFLICT ARBITRATION POLICY

When two approved deterministic/knowledge rules conflict, runtime must not improvise.

Resolution can be:
- jurisdiction precedence;
- specialty governance;
- more-specific population;
- explicit suppression;
- clinician-visible conflict;
- governance-selected policy.

Every arbitration is versioned.

Unresolved high-risk conflict blocks automated recommendation.

---

# EXEC-0225 | ACTIVE | 225. DERIVED-DATA INVALIDATION GRAPH

Every derived datum should know what source facts produced it.

When a source changes:
- mark affected derived data stale;
- recompute if policy permits;
- preserve historical version;
- prevent stale output from masquerading as current.

Examples:
- BMI depends on weight + height;
- trend depends on observation series;
- care gap depends on last qualifying event;
- patient state depends on multiple facts.

---

# EXEC-0226 | ACTIVE | 226. MATERIALIZED VIEW CONSISTENCY

Patient State and other read models are projections, not truth.

Define:
- source-of-truth entities;
- projection version;
- projector version;
- rebuild procedure;
- lag SLO;
- consistency checks.

A projection must be rebuildable from authoritative events/data.

---

# EXEC-0227 | ACTIVE | 227. RECONCILIATION JOBS

Create periodic reconciliation for critical derived state:
- obligations;
- result closure;
- patient-state projections;
- algorithm registry status;
- dependency graph;
- notifications.

Reconciliation compares expected state with materialized state and produces repair work—not silent destructive repair for clinically consequential discrepancies.

---

# EXEC-0228 | ACTIVE | 228. DATA INVARIANT ENFORCEMENT LAYERS

Important invariants should be enforced at the strongest appropriate layer:

```text
type system
→ schema validation
→ domain invariant
→ transaction
→ database constraint
→ workflow/state machine
→ reconciliation
```

Do not rely on UI validation for clinical integrity.

---

# EXEC-0229 | ACTIVE | 229. DATABASE CONSTRAINT STRATEGY

Where semantics permit, use:
- NOT NULL;
- CHECK;
- UNIQUE;
- FK;
- exclusion constraints;
- partial unique indexes;
- transaction isolation;
- RLS defense-in-depth.

Do not encode medical knowledge directly into brittle database constraints when it requires frequent clinical governance/versioning.

Separate data-integrity constraints from evolving clinical-policy rules.

---

# EXEC-0230 | ACTIVE | 230. TRANSACTIONAL CONSISTENCY BOUNDARY

Define which actions must commit atomically.

Example:

```text
clinical state mutation
+ provenance
+ audit
+ outbox event
```

should commonly share a transaction.

External notifications, AI calls and third-party integrations occur after commit.

Never hold a database transaction open while waiting for an LLM or remote lab API.

---

# EXEC-0231 | ACTIVE | 231. SAGA / WORKFLOW COMPENSATION

Multi-system workflows require explicit compensation.

For each step define:
- success;
- retry;
- timeout;
- permanent failure;
- compensation;
- manual recovery.

Compensation must not erase clinical history.

---

# EXEC-0232 | ACTIVE | 232. ASYNC AUTHORIZATION CONTEXT

Background workers must not inherit vague “system” authority.

Persist a constrained execution context:
- originating tenant;
- initiating actor/service;
- purpose;
- permitted operation;
- correlation ID.

Workers revalidate current policy where required.

Never trust serialized frontend permissions.

---

# EXEC-0233 | ACTIVE | 233. SERVICE IDENTITY

Every worker/service has a distinct identity and least-privilege permissions.

No shared omnipotent application credential for all subsystems.

High-risk operations should be attributable to service identity + originating human/context.

---

# EXEC-0234 | ACTIVE | 234. BREAK-GLASS COMPUTATION ACCESS

Emergency access to computation or protected data:
- explicit;
- time-limited;
- reason required;
- heavily audited;
- reviewed.

Break-glass cannot bypass immutable signed-record semantics or alter algorithm governance.

---

# EXEC-0235 | ACTIVE | 235. CRYPTOGRAPHIC INTEGRITY OPTIONS

For high-value manifests/evidence bundles, support cryptographic integrity verification:
- artifact hash;
- signed release attestations where infrastructure permits;
- append-only audit controls;
- verification tooling.

Do not market cryptographic integrity as nonrepudiation unless the complete legal/technical system supports that claim.

---

# EXEC-0236 | ACTIVE | 236. AUDIT TAMPER EVIDENCE

Audit design should make unauthorized alteration detectable.

Possible controls:
- append-only storage semantics;
- hash chaining/batching;
- restricted write path;
- immutable backups;
- independent retention.

Select implementation through ADR and threat model.

---

# EXEC-0237 | ACTIVE | 237. PROVENANCE GRANULARITY POLICY

Avoid both extremes:
- too little provenance to reconstruct;
- so much provenance that privacy/cost becomes unmanageable.

Define provenance tiers by risk.

C4/C5 require enough detail for calculation reconstruction and safety investigation.

---

# EXEC-0238 | ACTIVE | 238. PRIVACY-PRESERVING OBSERVABILITY

Observability should use:
- opaque IDs;
- bounded metadata;
- hashes where useful;
- allowlisted attributes;
- separate protected clinical audit.

Never solve debugging by dumping clinical payloads into logs.

---

# EXEC-0239 | ACTIVE | 239. VALIDATION CORPUS SEPARATION

Maintain separate datasets:
- development;
- visible validation;
- hidden holdout;
- adversarial;
- regression;
- post-release incident cases.

Agents/developers must not optimize directly against every hidden holdout case.

This reduces benchmark overfitting.

---

# EXEC-0240 | ACTIVE | 240. BENCHMARK CONTAMINATION CONTROL

Track whether benchmark cases may have appeared in:
- training data;
- public repositories;
- prompts;
- previous agent context.

Where independence matters, create private synthetic/clinician-authored cases.

A high score on leaked examples is not evidence of generalization.

---

# EXEC-0241 | ACTIVE | 241. VALIDATION STATISTICS

When reporting performance, include:
- numerator/denominator;
- confidence intervals where meaningful;
- subgroup counts;
- exclusions;
- missing-data handling;
- failure classes.

Do not report “99% accurate” without defining the task and denominator.

---

# EXEC-0242 | ACTIVE | 242. SAFETY-CRITICAL ERROR BUDGET

Operational error budgets do not permit known unsafe clinical outputs.

Separate:
- availability error budget;
- latency error budget;
- safety defect tolerance.

For designated catastrophic invariants, tolerance is zero known unresolved defects.

---

# EXEC-0243 | ACTIVE | 243. SEVERITY MODEL FOR COMPUTATION DEFECTS

Example:

```text
S0 — catastrophic potential / immediate suspension
S1 — serious patient-safety risk
S2 — clinically consequential incorrect behavior
S3 — limited clinical/operational impact
S4 — cosmetic/nonclinical
```

Define response SLA, kill-switch policy and review authority per severity.

---

# EXEC-0244 | ACTIVE | 244. NEAR-MISS CAPTURE

Capture near misses:
- physician caught wrong applicability;
- unit mismatch prevented;
- duplicate alert suppressed;
- stale value blocked;
- incorrect AI extraction rejected.

Near misses are valuable safety evidence and should feed governance review.

---

# EXEC-0245 | ACTIVE | 245. FEEDBACK-LOOP FIREWALL

Do not automatically learn clinical policy from clinician clicks/overrides.

Feedback may be biased by:
- workflow pressure;
- alert fatigue;
- local habits;
- incomplete information.

Feedback creates hypotheses for review, not automatic medical truth.

---

# EXEC-0246 | ACTIVE | 246. MODEL/ALGORITHM FEEDBACK SEPARATION

Keep separate:
- deterministic algorithm performance;
- knowledge-rule performance;
- AI model performance;
- UI acceptance behavior.

Otherwise a bad UI can be misdiagnosed as a bad clinical rule.

---

# EXEC-0247 | ACTIVE | 247. AI CONFIDENCE IS NOT CLINICAL CONFIDENCE

Model probability/self-reported confidence cannot be directly interpreted as probability that a clinical statement is correct.

Clinical confidence presentation must be based on:
- evidence;
- data completeness;
- source agreement;
- validation;
- task-specific calibration where demonstrated.

---

# EXEC-0248 | ACTIVE | 248. CALIBRATION FRAMEWORK

For probabilistic models used in bounded clinical-support tasks:
- evaluate calibration;
- reliability curves;
- threshold sensitivity;
- abstention behavior;
- subgroup performance.

Use calibrated thresholds only for the validated task/population.

---

# EXEC-0249 | ACTIVE | 249. ABSTENTION AS A FEATURE

AI/ML systems must support:
- insufficient evidence;
- unsupported task;
- out-of-distribution;
- low confidence;
- conflicting sources.

A safe abstention can be superior to a fluent answer.

---

# EXEC-0250 | ACTIVE | 250. OUT-OF-DISTRIBUTION DETECTION

Where feasible, detect inputs materially outside validation scope.

Examples:
- unsupported age;
- unsupported language;
- unknown document type;
- unseen unit;
- incompatible modality.

OOD detection triggers abstention/manual review, not confident extrapolation.

---

# EXEC-0251 | ACTIVE | 251. CLINICAL LANGUAGE NORMALIZATION BOUNDARY

NLP normalization from free text creates candidate structured facts.

Require:
- source span;
- extraction confidence;
- negation;
- temporality;
- experiencer;
- uncertainty;
- verification state.

“Mother had diabetes” must not become patient diabetes.

---

# EXEC-0252 | ACTIVE | 252. NEGATION / EXPERIENCER / TEMPORALITY TEST SUITE

Mandatory NLP adversarial cases:
- denies chest pain;
- history of chest pain, resolved;
- father had MI;
- rule out pneumonia;
- possible allergy;
- no known allergies;
- allergy status unknown;
- medication discontinued.

Structured extraction must preserve semantic distinctions.

---

# EXEC-0253 | ACTIVE | 253. DOCUMENT VERSION SEMANTICS

When an external report is amended/corrected:
- preserve all versions;
- identify latest authoritative version;
- mark superseded extraction;
- recompute derived state if appropriate;
- preserve what the physician saw at historical decision time.

---

# EXEC-0254 | ACTIVE | 254. SOURCE-OF-TRUTH PRIORITY

When data disagree, do not globally define one simplistic priority.

Conflict resolution may depend on domain:
- direct device feed vs transcribed value;
- corrected lab vs original;
- physician-verified allergy vs imported list;
- patient report vs external record.

Represent conflict and domain-specific resolution policy.

---

# EXEC-0255 | ACTIVE | 255. DUPLICATE CLINICAL FACT DETECTION

Duplicate facts can inflate evidence.

Implement deduplication/reconciliation using:
- identifiers;
- source;
- timestamp;
- code;
- value;
- document provenance.

Do not count the same imported lab twice merely because it arrived through two interfaces.

---

# EXEC-0256 | ACTIVE | 256. CAUSAL CLAIM BOUNDARY

Trend/correlation engines must not present correlation as causation.

AI explanations must use language consistent with evidence.

Causal inference requires separately validated methodology and intended use.

---

# EXEC-0257 | ACTIVE | 257. COUNTERFACTUAL BOUNDARY

Do not generate patient-specific counterfactual treatment claims as factual outcomes unless supported by a validated model and approved intended use.

“What would happen if…” remains decision support with uncertainty, not prediction certainty.

---

# EXEC-0258 | ACTIVE | 258. POPULATION-BIAS REVIEW

Knowledge and model validation must ask:
- who was represented?
- who was excluded?
- which settings?
- which countries?
- which assays/devices?
- which languages?

Do not silently universalize evidence beyond validated applicability.

---

# EXEC-0259 | ACTIVE | 259. LOCALIZATION VS CLINICAL SEMANTICS

Translation must not alter clinical meaning.

Separate:
- canonical clinical concept;
- locale display string;
- legal wording;
- patient-facing readability.

Clinical logic runs on canonical concepts, not translated labels.

---

# EXEC-0260 | ACTIVE | 260. INTERNATIONAL UNIT DISPLAY

Country/user display preferences may differ, but computation uses canonical normalized units.

UI must make converted/original values distinguishable where clinically relevant.

---

# EXEC-0261 | ACTIVE | 261. EXTERNAL DEPENDENCY CONTRACT TESTING

For labs, terminology, medication databases, identity providers and other services:
- schema contract tests;
- version compatibility;
- timeout behavior;
- malformed response tests;
- duplicate/replay tests;
- degraded-mode tests.

External success responses are still validated.

---

# EXEC-0262 | ACTIVE | 262. THIRD-PARTY DATA LICENSING GATE

Before embedding medical knowledge/terminology/drug data:
- verify license;
- permitted storage;
- redistribution;
- derivative works;
- update rights;
- jurisdiction.

Technical availability does not imply legal permission.

---

# EXEC-0263 | ACTIVE | 263. DATA RESIDENCY / JURISDICTION HOOKS

Architecture should permit future residency constraints without changing clinical domain semantics.

Country/enterprise policy can control:
- storage region;
- processing region;
- AI provider eligibility;
- export;
- retention.

Do not promise residency configurations until infrastructure actually supports them.

---

# EXEC-0264 | ACTIVE | 264. RETENTION DEPENDENCY AWARENESS

Deletion/retention must consider derived artifacts and legal requirements.

Deleting a source record may affect:
- derived state;
- provenance;
- audit;
- validation evidence;
- legal hold.

No cascade delete of clinical history without explicit policy.

---

# EXEC-0265 | ACTIVE | 265. RIGHT-TO-CORRECTION VS IMMUTABILITY

Support correction without destructive history rewrite.

Pattern:
- supersede;
- amend;
- entered-in-error;
- corrected version;
- provenance relationship.

Immutability does not mean clinically incorrect data remains presented as current truth.

---

# EXEC-0266 | ACTIVE | 266. SCHEMA EVOLUTION

Clinical schemas evolve via expand-and-contract.

Requirements:
- backwards-compatible reads during migration;
- migration validation;
- historical reconstruction;
- no silent semantic reinterpretation;
- versioned serializers where needed.

---

# EXEC-0267 | ACTIVE | 267. EVENT SCHEMA VERSIONING

Domain/outbox events include schema version.

Consumers must:
- support defined compatibility window;
- reject unknown incompatible versions safely;
- not reinterpret old payload semantics using new assumptions.

---

# EXEC-0268 | ACTIVE | 268. REPLAY LAB

Maintain a nonproduction replay environment capable of:
- replaying synthetic event histories;
- switching algorithm versions;
- switching knowledge versions;
- injecting failures;
- comparing final Patient State.

This is essential for regression investigation.

---

# EXEC-0269 | ACTIVE | 269. DIGITAL TWIN / SYNTHETIC PATIENT SCENARIOS

Build synthetic longitudinal patient scenarios, not only isolated test rows.

Scenarios include:
- years of labs;
- medication changes;
- missed follow-up;
- corrections;
- referrals;
- duplicated imports;
- changing diagnoses;
- aging/life-stage transitions.

Use them to validate system-level behavior.

---

# EXEC-0270 | ACTIVE | 270. STATE-SPACE EXPLORATION

For bounded critical state machines, automatically explore reachable states/transitions.

Detect:
- unreachable intended state;
- reachable forbidden state;
- deadlock;
- livelock;
- missing terminal state;
- unhandled timeout.

---

# EXEC-0271 | ACTIVE | 271. MONOTONIC SAFETY PROPERTIES

Identify properties that must never regress.

Examples:
- a signed note never becomes unsigned by ordinary edit;
- a reviewed critical result never becomes “unseen” without explicit correction workflow;
- tenant authorization never broadens from data import;
- provenance never disappears during recomputation.

Encode these as permanent regression properties.

---

# EXEC-0272 | ACTIVE | 272. NEGATIVE CAPABILITY TESTING

Test what Medical OS must refuse to do.

Examples:
- compute with incompatible units;
- prescribe autonomously;
- close critical result via AI;
- modify signed note;
- use unapproved knowledge artifact;
- access another tenant;
- silently accept stale weight.

Refusal behavior is part of correctness.

---

# EXEC-0273 | ACTIVE | 273. RED-TEAM COMPUTATION PROGRAM

Periodically conduct adversarial reviews targeting:
- unsafe assumptions;
- hidden defaults;
- clinical-policy bypass;
- provenance forgery;
- unit manipulation;
- knowledge poisoning;
- cross-tenant leakage;
- AI prompt injection;
- race conditions;
- rollback failures.

Red-team findings enter tracked remediation.

---

# EXEC-0274 | ACTIVE | 274. KNOWLEDGE POISONING DEFENSE

Threat model intentional or accidental poisoned source content.

Controls:
- source allowlists/identity;
- hashes;
- human verification;
- multiple-source comparison where appropriate;
- no autoactivation;
- artifact signing;
- anomaly review for large rule changes.

---

# EXEC-0275 | ACTIVE | 275. MASS-CHANGE SAFETY

A terminology/guideline update can alter thousands of downstream outputs.

Before mass activation:
- count affected artifacts;
- estimate patient/workflow impact;
- run behavioral diff;
- sample clinical review;
- stage rollout;
- define rollback.

Large blast radius increases review rigor.

---

# EXEC-0276 | ACTIVE | 276. BLAST-RADIUS MODEL

Every change estimates:
- tenants;
- patients;
- specialties;
- countries;
- workflows;
- historical data;
- regulatory scope.

Risk = severity × probability × blast radius × detectability/recoverability considerations.

Use this to select release strategy.

---

# EXEC-0277 | ACTIVE | 277. CHANGE BUDGET

Avoid simultaneously changing:
- algorithm;
- terminology;
- UI;
- workflow;
- AI model

for the same high-risk feature unless necessary.

Smaller controlled changes improve attribution and rollback.

---

# EXEC-0278 | ACTIVE | 278. ROLLBACK SEMANTICS

Rollback means:
- stop new use of candidate;
- restore approved prospective behavior;
- preserve outputs already shown/acted upon;
- identify affected cases;
- decide whether retrospective review is needed.

Rollback never erases clinical evidence.

---

# EXEC-0279 | ACTIVE | 279. PATIENT-IMPACT ANALYSIS

For serious defects, support identifying potentially affected patient records without exposing unnecessary PHI.

Query by:
- artifact version;
- execution time;
- input characteristics;
- output class.

This enables targeted clinical review.

---

# EXEC-0280 | ACTIVE | 280. SAFETY COMMUNICATION PATH

Define internal communication for:
- suspended algorithm;
- incorrect knowledge artifact;
- degraded service;
- required patient-impact review.

Clinical users must receive actionable information, not infrastructure jargon.

---

# EXEC-0281 | ACTIVE | 281. OPERATIONAL RUNBOOK PER C4/C5 ASSET

Each high-risk asset has:
- owner contacts/roles;
- kill procedure;
- rollback;
- validation location;
- known failure modes;
- monitoring;
- patient-impact query;
- reactivation criteria.

---

# EXEC-0282 | ACTIVE | 282. KNOWLEDGE REVIEW EXPIRATION

High-impact knowledge artifacts cannot remain active indefinitely without review.

On review expiry:
- notify owner;
- enter grace policy if approved;
- mark stale;
- potentially block new use depending on risk.

Do not silently auto-retire a critical rule if retirement itself could create harm; use governed policy.

---

# EXEC-0283 | ACTIVE | 283. OWNER BUS-FACTOR CONTROL

Critical artifacts need backup ownership.

No C4/C5 asset depends on one person's undocumented knowledge.

Documentation + validation evidence + runbook must permit another qualified reviewer to assume ownership.

---

# EXEC-0284 | ACTIVE | 284. EXPLANATION CONSISTENCY TEST

Verify clinician-facing explanation matches actual computation.

A correct calculation with an incorrect explanation is a defect.

AI-generated explanation must not contradict deterministic trace.

---

# EXEC-0285 | ACTIVE | 285. UI/ENGINE CONTRACT TESTS

Test that UI:
- sends correct units;
- displays correct version/status;
- does not round before calculation;
- does not hide `not_computable`;
- distinguishes warning vs critical;
- preserves source timestamps.

Clinical engine correctness can be defeated by a bad presentation layer.

---

# EXEC-0286 | ACTIVE | 286. COPY/PASTE SAFETY

Copied clinical data can become stale or wrong-patient.

Where relevant:
- show source/date;
- prevent hidden identifiers;
- avoid copying machine-only tokens into narrative;
- preserve provenance when structured data are reused.

---

# EXEC-0287 | ACTIVE | 287. WRONG-PATIENT COMPUTATION DEFENSE

Before high-impact action:
- persistent patient identity context;
- server-side patient/encounter binding;
- stale-tab detection where feasible;
- explicit confirmation for selected high-risk actions.

Never trust a client-visible patient label as binding.

---

# EXEC-0288 | ACTIVE | 288. MULTI-TAB / MULTI-DEVICE CONCURRENCY

Test physician editing same patient from:
- two tabs;
- desktop + tablet;
- two clinicians.

Use optimistic concurrency/versioning and visible conflict resolution.

Do not silently last-write-wins clinically consequential data.

---

# EXEC-0289 | ACTIVE | 289. OFFLINE / DEGRADED CLIENT POLICY

If offline support is introduced:
- clearly identify stale local data;
- constrain high-risk actions;
- queue writes safely;
- reconcile conflicts;
- preserve timestamps/provenance.

Do not imply current clinical state when client is stale.

---

# EXEC-0290 | ACTIVE | 290. CLOCK SOURCE POLICY

Use server-authoritative timestamps for audit/system events.

Preserve device/source timestamps separately when clinically meaningful.

Do not allow client clock manipulation to rewrite audit chronology.

---

# EXEC-0291 | ACTIVE | 291. IDENTIFIER COLLISION DEFENSE

Human-readable folios are not primary keys.

Use globally unique internal identifiers.

Test:
- import collisions;
- tenant-local folio collisions;
- external identifier reuse;
- merge/split.

---

# EXEC-0292 | ACTIVE | 292. HASHING / CANONICALIZATION POLICY

When hashing inputs/artifacts:
- canonical serialization;
- stable field ordering;
- normalized numeric representation;
- versioned canonicalization algorithm.

Otherwise identical logical inputs can produce different hashes.

---

# EXEC-0293 | ACTIVE | 293. REPRODUCIBLE SERIALIZATION

Historical reconstruction requires stable encoding semantics.

Do not depend on incidental JavaScript object serialization for long-term clinical evidence.

---

# EXEC-0294 | ACTIVE | 294. DEPENDENCY PINNING FOR CLINICAL LOGIC

Pin behavior-affecting dependencies.

Upgrading a decimal library, date library, terminology package or parser can alter outputs.

Treat such upgrades as behavioral changes requiring regression.

---

# EXEC-0295 | ACTIVE | 295. COMPILER / RUNTIME COMPATIBILITY MATRIX

Knowledge artifact compiler version and runtime version require compatibility metadata.

Runtime rejects unsupported compiled artifact versions.

---

# EXEC-0296 | ACTIVE | 296. ARTIFACT SIGNATURE VERIFICATION PATH

If signed artifacts are adopted:
- verify at promotion/load;
- define key rotation;
- revoke compromised keys;
- audit verification failure.

Never silently execute an artifact with failed integrity verification.

---

# EXEC-0297 | ACTIVE | 297. KEY MANAGEMENT BOUNDARY

Signing/encryption keys:
- never stored in repo;
- environment-specific;
- least privilege;
- rotation procedure;
- access audit.

Do not let coding agents access production signing keys.

---

# EXEC-0298 | ACTIVE | 298. BUILD REPRODUCIBILITY TEST

Periodically rebuild approved artifacts from source/lockfiles and compare hashes where deterministic builds are expected.

Unexpected divergence triggers supply-chain investigation.

---

# EXEC-0299 | ACTIVE | 299. CLINICAL CONTENT SBOM

Maintain a “Clinical Bill of Materials” for a release:
- algorithms;
- knowledge artifacts;
- terminology versions;
- country packs;
- clinical packs;
- drug/reference datasets.

This complements the software SBOM.

---

# EXEC-0300 | ACTIVE | 300. RELEASE MANIFEST

Every release identifies both:
- software version;
- Clinical BOM version.

Two deployments with same frontend commit but different clinical content are not clinically identical releases.

---

# EXEC-0301 | ACTIVE | 301. EVIDENCE-TO-CODE DRIFT CHECK

Detect when implementation remains active after its source is:
- superseded;
- withdrawn;
- expired;
- jurisdictionally changed.

This creates review, not automatic policy mutation.

---

# EXEC-0302 | ACTIVE | 302. STATIC ANALYSIS FOR CLINICAL CODE

Create lint/static-analysis rules where feasible:
- forbid clinical package imports in UI bypass paths;
- forbid raw numeric thresholds in designated modules;
- forbid direct LLM SDK in clinical-domain;
- require unit type for quantity functions;
- require algorithm manifest linkage.

---

# EXEC-0303 | ACTIVE | 303. TYPE-LEVEL UNIT SAFETY

Where practical, use branded/opaque types:

```ts
type Kilograms = Brand<Decimal, "kg">;
type Milligrams = Brand<Decimal, "mg">;
```

Runtime validation remains mandatory because external data are untyped.

Type safety reduces internal misuse but does not replace unit validation.

---

# EXEC-0304 | ACTIVE | 304. EXPLICIT NULLABILITY

Differentiate:
- absent;
- unknown;
- not asked;
- not applicable;
- unable to assess;
- withheld;
- entered in error.

Do not collapse clinically distinct states into nullable booleans.

---

# EXEC-0305 | ACTIVE | 305. TRI-STATE AND MULTI-STATE LOGIC

Clinical logic often requires more than true/false.

Knowledge IR must support explicit unknown semantics.

Avoid JavaScript truthiness for clinical decisions.

---

# EXEC-0306 | ACTIVE | 306. DECISION TABLES

For complex deterministic policy, prefer reviewable decision tables when clearer than nested conditionals.

Decision tables require:
- completeness analysis;
- overlap detection;
- unreachable rule detection;
- tests generated from rows/boundaries.

---

# EXEC-0307 | ACTIVE | 307. DECISION TABLE COMPILATION

Compile approved decision tables into typed runtime artifacts.

Never execute arbitrary spreadsheet formulas directly in production.

---

# EXEC-0308 | ACTIVE | 308. FORMULA SOURCE RENDERING

Clinicians/reviewers should be able to see a human-readable representation of formula/logic corresponding to the active version.

The rendered representation is generated from the authoritative specification to avoid documentation drift.

---

# EXEC-0309 | ACTIVE | 309. MACHINE-GENERATED TESTS WITH HUMAN ORACLE

Agents can generate large test spaces, but expected clinical behavior for high-risk cases requires trusted oracle sources/review.

Do not let the same model both invent the medical rule and certify its correctness.

---

# EXEC-0310 | ACTIVE | 310. ORACLE HIERARCHY

Possible test oracles:
1. mathematically proven invariant;
2. official/reference implementation;
3. validated published reference cases;
4. independently implemented comparator;
5. clinician-reviewed expected outcome.

Record oracle type per test.

---

# EXEC-0311 | ACTIVE | 311. ORACLE DISAGREEMENT

If trusted oracles disagree:
- stop;
- classify discrepancy;
- investigate source/version/population;
- do not majority-vote blindly.

Disagreement may reveal a real clinical/standard ambiguity.

---

# EXEC-0312 | ACTIVE | 312. PROPERTY REGISTRY

Maintain reusable properties across algorithms:
- unit invariance;
- deterministic repeatability;
- no output on invalid dimensions;
- historical immutability;
- tenant isolation;
- no silent default.

Property registry improves consistency across newly generated algorithms.

---

# EXEC-0313 | ACTIVE | 313. ALGORITHM TEMPLATE LIBRARY

Create validated templates for recurring patterns:
- scalar formula;
- score;
- threshold classification;
- age-banded rule;
- dose calculation;
- temporal interval;
- trend;
- reference-range evaluation;
- decision table.

Templates accelerate development while inheriting established safety scaffolding.

---

# EXEC-0314 | ACTIVE | 314. TEMPLATE VERSIONING

Algorithm templates are versioned.

Generated algorithms record template version.

Template defects trigger impact analysis over generated dependents.

---

# EXEC-0315 | ACTIVE | 315. AUTOMATED SCAFFOLD QUALITY GATES

`algorithm:new` must generate:
- manifest;
- schemas;
- tests;
- provenance hooks;
- metrics hooks;
- docs;
- risk placeholder;
- ownership placeholder.

Build fails until required placeholders are resolved.

---

# EXEC-0316 | ACTIVE | 316. NO DEFAULT RISK TIER

New clinical algorithms start as `UNCLASSIFIED`.

Unclassified assets cannot enter production.

This prevents accidental low-risk defaults.

---

# EXEC-0317 | ACTIVE | 317. NO DEFAULT JURISDICTION

Clinical knowledge artifacts must explicitly state applicability.

Unknown jurisdiction cannot silently inherit Mexico/global behavior for clinically consequential policy.

---

# EXEC-0318 | ACTIVE | 318. NO DEFAULT POPULATION

If evidence applies only to a population, applicability must encode it.

Missing population metadata blocks activation where necessary.

---

# EXEC-0319 | ACTIVE | 319. KNOWLEDGE GRANULARITY

Prefer atomic knowledge propositions over giant monolithic pathways.

Atomic artifacts improve:
- reuse;
- conflict detection;
- update impact;
- testing;
- provenance.

Clinical Packs compose atomic artifacts into workflow experiences.

---

# EXEC-0320 | ACTIVE | 320. KNOWLEDGE COMPOSITION SAFETY

Composition can introduce contradictions.

Compiler/runtime validates:
- duplicate outputs;
- incompatible priorities;
- circular dependencies;
- mutually exclusive recommendations;
- inconsistent units/terminology.

---

# EXEC-0321 | ACTIVE | 321. EVIDENCE STRENGTH REPRESENTATION

Where source provides evidence strength/certainty, preserve it structurally.

Do not invent certainty grades when source does not provide them.

AI explanation must not upgrade weak evidence into definitive language.

---

# EXEC-0322 | ACTIVE | 322. RECOMMENDATION STRENGTH VS EVIDENCE CERTAINTY

Keep separate when the source distinguishes them.

A strong recommendation can coexist with lower certainty under some guideline frameworks.

Do not collapse both into one “confidence” field.

---

# EXEC-0323 | ACTIVE | 323. KNOWLEDGE EFFECTIVE-DATE SEMANTICS

A newly published guideline may not be immediately effective in every policy context.

Track:
- publication;
- effective date;
- local adoption date;
- supersession.

Runtime uses approved effective policy, not publication date alone.

---

# EXEC-0324 | ACTIVE | 324. RETROSPECTIVE KNOWLEDGE VIEW

For audit, permit viewing what knowledge version was active at historical encounter time.

Do not display today's guideline as if it were the source of a past decision.

---

# EXEC-0325 | ACTIVE | 325. CURRENT-KNOWLEDGE REASSESSMENT

Separately, Medical OS may identify that a historical patient state merits reassessment under newer knowledge.

This creates a new prospective consideration, never rewrites past rationale.

---

# EXEC-0326 | ACTIVE | 326. KNOWLEDGE CHANGE NOTIFICATION

Clinicians should not be flooded by every guideline update.

Notify only when:
- change materially affects their active patients/workflow;
- policy requires awareness;
- action may be needed.

Use impact targeting.

---

# EXEC-0327 | ACTIVE | 327. CLINICAL DEBT REGISTER

Track known limitations such as:
- unsupported population;
- incomplete terminology mapping;
- missing country rule;
- temporary manual workflow;
- pending evidence review.

Clinical debt has owner, risk and due date.

Do not hide known gaps in ordinary technical debt.

---

# EXEC-0328 | ACTIVE | 328. SAFETY TECHNICAL DEBT BLOCKER

Debt affecting:
- tenant isolation;
- signed-record integrity;
- critical-result closure;
- high-risk dose correctness;
- provenance;
- algorithm version integrity

can block release regardless of roadmap pressure.

---

# EXEC-0329 | ACTIVE | 329. ASSUMPTION REGISTER

Every high-risk algorithm records assumptions.

Example:
- creatinine assay compatibility;
- weight represents current measured weight;
- input unit canonicalization succeeded.

Assumptions become testable review items.

---

# EXEC-0330 | ACTIVE | 330. ASSUMPTION VIOLATION DETECTION

Where possible, runtime detects violated assumptions and abstains/warns.

Undetectable assumptions must be documented as limitations.

---

# EXEC-0331 | ACTIVE | 331. LIMITATION PRESENTATION

Known clinically relevant limitations should be available to users/reviewers without cluttering routine workflow.

Do not bury material limitations only in developer docs.

---

# EXEC-0332 | ACTIVE | 332. DOCUMENTATION DRIFT TEST

Generate portions of algorithm documentation from manifests/specifications.

CI can compare:
- documented version;
- formula hash;
- source IDs;
- risk tier.

This reduces stale docs.

---

# EXEC-0333 | ACTIVE | 333. CODEOWNERS BY RISK DOMAIN

Clinical computation paths should require reviewers appropriate to domain.

Examples:
- medication;
- laboratory;
- pediatrics;
- knowledge compiler;
- security.

CODEOWNERS supports process; it does not itself prove qualified review.

---

# EXEC-0334 | ACTIVE | 334. PR RISK DECLARATION

Every PR touching clinical computation declares:
- affected artifacts;
- risk tier;
- intended behavioral change;
- source/evidence change;
- migration;
- patient-impact possibility;
- required reviewers.

“No behavioral change” should be testable via behavioral diff when feasible.

---

# EXEC-0335 | ACTIVE | 335. CHANGESET GENERATION

Automate a clinical changeset:

```text
software diff
clinical artifact diff
knowledge diff
terminology diff
behavioral diff
test diff
risk diff
```

Reviewers should not reconstruct this manually from hundreds of files.

---

# EXEC-0336 | ACTIVE | 336. REVIEWER COGNITIVE LOAD CONTROL

Large diffs cause missed errors.

High-risk clinical changes should be decomposed into reviewable units.

If a change is necessarily large, provide generated summaries, dependency impact and targeted review views.

---

# EXEC-0337 | ACTIVE | 337. TWO-PERSON RULE FOR C4/C5

At minimum, C4/C5 activation requires independent approval from qualified roles defined by governance.

Emergency suspension can be unilateral by authorized safety role.

Reactivation requires normal approval.

---

# EXEC-0338 | ACTIVE | 338. RELEASE WINDOW POLICY

High-risk changes should avoid uncontrolled deployment at times when qualified monitoring/recovery staff are unavailable.

Automated deployment convenience does not override safety operations.

---

# EXEC-0339 | ACTIVE | 339. POST-RELEASE OBSERVATION WINDOW

After C4/C5 activation:
- heightened monitoring;
- predefined metrics;
- owner availability;
- rollback readiness;
- sampled case review where appropriate.

Exit criteria are predefined.

---

# EXEC-0340 | ACTIVE | 340. LONG-TAIL FAILURE REVIEW

Periodically inspect rare:
- not-computable;
- unsupported-unit;
- conflicting-data;
- manual override;
- runtime-error cases.

The long tail often reveals assumptions not covered by common-path testing.

---

# EXEC-0341 | ACTIVE | 341. SILENT FAILURE DETECTION

Monitor expected activity baselines.

A sudden drop to zero rule firings can be as dangerous as an error spike.

Detect:
- no events;
- missing source feed;
- stopped projector;
- disabled rule;
- failed scheduler.

---

# EXEC-0342 | ACTIVE | 342. HEARTBEAT / SYNTHETIC CLINICAL CHECKS

Run synthetic non-PHI scenarios through critical computation paths.

Verify:
- artifact resolution;
- units;
- computation;
- knowledge lookup;
- provenance;
- result state.

Synthetic checks must never create real patient actions.

---

# EXEC-0343 | ACTIVE | 343. WATCHDOG FOR CRITICAL WORKFLOWS

Independent watchdog/reconciliation can detect:
- critical result without owner;
- obligation stuck;
- workflow timer not firing;
- artifact unexpectedly inactive.

Avoid one component being both primary executor and only monitor of its own failure.

---

# EXEC-0344 | ACTIVE | 344. INDEPENDENT SAFETY MONITORING PRINCIPLE

For selected high-risk paths, safety monitoring should be logically independent from the component being monitored.

This reduces common-mode failure.

---

# EXEC-0345 | ACTIVE | 345. COMMON-MODE FAILURE ANALYSIS

Ask whether one dependency can break multiple controls simultaneously.

Examples:
- same DB table powers workflow + watchdog;
- same AI model generates + validates;
- same terminology mapping used by both reference and production implementation.

Introduce independence proportional to risk.

---

# EXEC-0346 | ACTIVE | 346. FAULT TREE ANALYSIS

For C4/C5 hazards, consider fault trees:

```text
unsafe dose shown
├── wrong weight
├── wrong unit conversion
├── wrong range
├── wrong arithmetic
├── stale knowledge
├── wrong patient
└── presentation mismatch
```

Map controls/tests to branches.

---

# EXEC-0347 | ACTIVE | 347. FMEA / HAZARD ANALYSIS

Use structured failure-mode analysis for critical workflows:
- failure mode;
- cause;
- effect;
- detectability;
- control;
- residual risk.

Do not rely exclusively on generic security threat modeling for clinical safety.

---

# EXEC-0348 | ACTIVE | 348. STPA CONSIDERATION

For complex socio-technical safety interactions, consider Systems-Theoretic Process Analysis (STPA) where appropriate.

Useful when harm can emerge from individually functioning components interacting incorrectly.

Use only where complexity/risk justifies it.

---

# EXEC-0349 | ACTIVE | 349. SAFETY REQUIREMENTS AS FIRST-CLASS IDS

Safety controls receive stable IDs.

Example:

```text
SAFE-MED-001
SAFE-RESULT-004
SAFE-TENANT-002
```

Tests, hazards, requirements and implementation link to these IDs.

---

# EXEC-0350 | ACTIVE | 350. SECURITY REQUIREMENTS AS FIRST-CLASS IDS

Likewise:
```text
SEC-AUTHZ-001
SEC-PHI-004
SEC-SUPPLY-002
```

This supports evidence-based release gates.

---

# EXEC-0351 | ACTIVE | 351. PERFORMANCE REQUIREMENTS AS FIRST-CLASS IDS

Performance is traceable too:
```text
PERF-PATIENT-OPEN-001
PERF-CALC-001
```

Avoid vague “must be fast”.

---

# EXEC-0352 | ACTIVE | 352. SLO ERROR ATTRIBUTION

When SLO fails, identify whether cause is:
- application;
- DB;
- queue;
- artifact registry;
- terminology;
- external provider;
- AI.

This prevents masking clinical-engine failures inside aggregate uptime.

---

# EXEC-0353 | ACTIVE | 353. RESOURCE EXHAUSTION SAFETY

Protect critical workflows from:
- AI traffic spikes;
- bulk recomputation;
- report generation;
- analytics.

Use workload isolation, priorities and backpressure.

Clinical interactive traffic receives protected capacity.

---

# EXEC-0354 | ACTIVE | 354. BACKPRESSURE

When downstream services are saturated:
- queue bounded work;
- reject/defer noncritical work;
- preserve critical tasks;
- expose degraded state.

Never create infinite queues with unknown clinical delay.

---

# EXEC-0355 | ACTIVE | 355. QUEUE AGE SLO

For clinically relevant asynchronous work, monitor queue age, not only queue length.

A small queue can still contain dangerously old tasks.

---

# EXEC-0356 | ACTIVE | 356. DEAD-LETTER GOVERNANCE

Dead-lettered clinical events require:
- classification;
- owner;
- replay procedure;
- expiry/escalation;
- patient-impact assessment where relevant.

Dead-letter queue is not a graveyard.

---

# EXEC-0357 | ACTIVE | 357. RETRY CLASSIFICATION

Differentiate:
- transient;
- permanent;
- invalid input;
- authorization failure;
- dependency version mismatch.

Do not retry permanent clinical validation failures endlessly.

---

# EXEC-0358 | ACTIVE | 358. EXACTLY-ONCE ILLUSION

Do not assume exactly-once delivery.

Design idempotent effects over at-least-once event delivery.

Use durable identifiers and state transitions.

---

# EXEC-0359 | ACTIVE | 359. EXTERNAL MESSAGE DEDUPLICATION

Lab/integration messages need deduplication keys and source identifiers.

Duplicate external messages must not duplicate clinical facts/actions.

---

# EXEC-0360 | ACTIVE | 360. REORDERING BUFFER POLICY

If external feeds can arrive out of order, define whether to:
- process immediately with correction;
- buffer for bounded period;
- mark provisional.

Do not indefinitely delay critical results waiting for perfect ordering.

---

# EXEC-0361 | ACTIVE | 361. PROVISIONAL RESULT SEMANTICS

Support provisional/preliminary/final/corrected result states where source domain requires.

Knowledge/alerts must know whether result is final.

---

# EXEC-0362 | ACTIVE | 362. CORRECTED CRITICAL RESULT WORKFLOW

A corrected critical result must:
- preserve original;
- link correction;
- reassess active obligations/actions;
- notify appropriate clinician if clinically necessary;
- never silently replace the previous value.

---

# EXEC-0363 | ACTIVE | 363. CLINICAL ACTION IDEMPOTENCY

Creating an obligation/alert from a computation requires stable causation key.

Same source event + same rule version should not create duplicate action unless policy explicitly allows recurrence.

---

# EXEC-0364 | ACTIVE | 364. ALERT IDENTITY

Alerts have identity/lifecycle:
- trigger;
- patient;
- rule version;
- state;
- owner;
- suppression;
- acknowledgement;
- resolution.

Avoid stateless banners for high-risk clinical alerts.

---

# EXEC-0365 | ACTIVE | 365. ALERT SUPPRESSION SAFETY

Suppression is:
- scoped;
- reasoned;
- time-bounded where appropriate;
- auditable.

A suppression created for one version/context must not blindly suppress future materially different alerts.

---

# EXEC-0366 | ACTIVE | 366. ALERT FLOOD CONTROL

If one upstream failure creates thousands of alerts:
- aggregate operationally;
- preserve patient-level safety;
- avoid clinician notification storm;
- escalate system incident.

---

# EXEC-0367 | ACTIVE | 367. CLINICAL OBLIGATION DEDUPLICATION

Obligations can overlap.

Deduplicate only when clinical semantics match:
- same purpose;
- same target;
- compatible due interval;
- same owner/context.

Do not merge distinct obligations merely because labels are similar.

---

# EXEC-0368 | ACTIVE | 368. OBLIGATION SUPERSESSION

A new plan can supersede an old obligation.

Record:
- supersededBy;
- reason;
- physician/context;
- date.

Do not delete old obligation.

---

# EXEC-0369 | ACTIVE | 369. PATIENT STATE CONSISTENCY CHECKS

Periodically assert:
- active meds correspond to lifecycle state;
- resolved problems not displayed as active unless intentionally;
- latest result selection follows correction rules;
- obligations align with terminal states;
- allergies preserve verification status.

---

# EXEC-0370 | ACTIVE | 370. CROSS-DOMAIN INVARIANT TESTS

Some safety properties span bounded contexts.

Examples:
- medication order references correct patient/encounter;
- result obligation references source order/result;
- signed note snapshot references medication/order versions used.

Create integration invariants, not cross-domain SQL shortcuts.

---

# EXEC-0371 | ACTIVE | 371. CLINICAL SNAPSHOT SEMANTICS

At decision/signature time, record relevant versions/snapshots needed to reconstruct context.

Do not assume current mutable Patient State equals historical decision context.

---

# EXEC-0372 | ACTIVE | 372. DECISION CONTEXT SNAPSHOT

For high-impact decisions, consider a compact decision-context manifest:
- patient facts used;
- algorithm versions;
- knowledge versions;
- warnings;
- physician action.

This supports audit without copying the entire chart.

---

# EXEC-0373 | ACTIVE | 373. PROVENANCE CHAIN VALIDATION

Periodically verify provenance references resolve.

Broken provenance links in high-risk records are defects.

---

# EXEC-0374 | ACTIVE | 374. ARCHIVAL ARTIFACT AVAILABILITY

Retired algorithm/knowledge versions needed for legal/audit reconstruction must remain accessible to authorized reconstruction tooling even if not executable for new care.

---

# EXEC-0375 | ACTIVE | 375. SAFE HISTORICAL EXECUTION

If historical artifact execution is needed, run in isolated reconstruction mode:
- no side effects;
- no new obligations;
- no patient notifications;
- exact historical dependencies.

---

# EXEC-0376 | ACTIVE | 376. RECONSTRUCTION VS CURRENT RECOMPUTATION

Expose distinction:

```text
RECONSTRUCT: what the system produced then
RECOMPUTE: what current approved logic produces now
```

Never conflate them.

---

# EXEC-0377 | ACTIVE | 377. DUAL-CONTROL FOR MASS RECOMPUTATION

High-impact population recomputation requires:
- scope preview;
- dry run;
- impact count;
- approval;
- resumability;
- audit;
- rollback strategy for derived state.

---

# EXEC-0378 | ACTIVE | 378. DRY-RUN MODE

All migration/recomputation tooling should support dry-run where feasible.

Dry-run produces diff/impact without mutation.

---

# EXEC-0379 | ACTIVE | 379. MIGRATION INVARIANTS

Clinical migrations assert:
- record count expectations;
- identifier preservation;
- provenance preservation;
- signed-record hash/snapshot preservation;
- tenant isolation;
- no orphan references.

---

# EXEC-0380 | ACTIVE | 380. DATA MIGRATION QUARANTINE

Imported legacy data can enter quarantine/staging until:
- tenant/patient identity resolved;
- schema validated;
- terminology mapped;
- provenance assigned.

Do not let malformed legacy data directly contaminate Patient State.

---

# EXEC-0381 | ACTIVE | 381. MIGRATION CONFIDENCE

Mappings can be:
- exact;
- high-confidence;
- ambiguous;
- unmapped.

Ambiguous clinical mappings require review rather than forced conversion.

---

# EXEC-0382 | ACTIVE | 382. TERMINOLOGY MAPPING PROVENANCE

Store:
- original code/text;
- mapped concept;
- mapping method;
- terminology version;
- reviewer/algorithm;
- confidence/status.

---

# EXEC-0383 | ACTIVE | 383. TERMINOLOGY COLLISION TESTS

Test homonyms, abbreviations and local codes.

Never assume textual similarity means semantic equivalence.

---

# EXEC-0384 | ACTIVE | 384. LANGUAGE MODEL TERMINOLOGY BOUNDARY

LLM can propose mappings but cannot make unreviewed high-risk terminology mapping authoritative.

---

# EXEC-0385 | ACTIVE | 385. KNOWLEDGE COMPILER STATIC TYPE SYSTEM

Knowledge IR should type:
- quantities;
- dates/durations;
- concepts;
- sets;
- booleans/multi-state;
- references.

Compiler rejects invalid comparisons such as mass vs time.

---

# EXEC-0386 | ACTIVE | 386. KNOWLEDGE COMPILER TOTALITY CHECK

For decision tables/finite rules, identify inputs for which no branch exists.

Uncovered state must resolve explicitly to:
- no recommendation;
- insufficient data;
- unsupported.

Never fall through accidentally.

---

# EXEC-0387 | ACTIVE | 387. KNOWLEDGE COMPILER OVERLAP CHECK

Detect multiple simultaneously true rules that produce incompatible outputs.

Require explicit priority/arbitration.

---

# EXEC-0388 | ACTIVE | 388. KNOWLEDGE COMPILER EXPLAINABILITY OUTPUT

Compiler should generate explanation metadata from rule structure, reducing divergence between logic and explanation.

---

# EXEC-0389 | ACTIVE | 389. KNOWLEDGE TEST GENERATION

Generate tests from:
- applicability boundaries;
- decision-table rows;
- exclusions;
- temporal thresholds;
- terminology sets.

Human-reviewed special cases supplement generated tests.

---

# EXEC-0390 | ACTIVE | 390. KNOWLEDGE PACKAGE DEPENDENCY LOCK

Clinical Pack release pins exact knowledge artifact versions unless explicitly configured for compatible ranges with validated semantics.

Avoid invisible behavior changes from floating “latest”.

---

# EXEC-0391 | ACTIVE | 391. CONTROLLED AUTO-UPDATE POLICY

Default for high-risk clinical knowledge: no automatic activation.

Automated detection/download is allowed.

Activation requires governed validation.

---

# EXEC-0392 | ACTIVE | 392. EMERGENCY KNOWLEDGE UPDATE

For urgent safety/regulatory changes:
- expedited review path;
- source verification;
- focused regression;
- limited approvals defined by policy;
- heightened post-release monitoring.

Expedited ≠ unreviewed.

---

# EXEC-0393 | ACTIVE | 393. SOURCE AVAILABILITY FAILURE

If external source becomes unavailable:
- active approved artifact remains usable according to policy;
- freshness monitor reports inability to verify;
- do not delete active knowledge.

---

# EXEC-0394 | ACTIVE | 394. SOURCE WITHDRAWAL

If authoritative source is withdrawn:
- identify dependent artifacts;
- assess immediate risk;
- suspend where necessary;
- communicate;
- preserve historical provenance.

---

# EXEC-0395 | ACTIVE | 395. EVIDENCE CONFLICT ESCALATION

High-impact unresolved evidence conflict can require:
- specialty board;
- local policy decision;
- patient-specific physician judgment.

System must represent disagreement honestly.

---

# EXEC-0396 | ACTIVE | 396. GUIDELINE VS PATIENT PREFERENCE

Knowledge Engine recommendations do not erase shared decision-making.

Where relevant, Patient State can record goals/preferences affecting plan.

Physician remains authority for individualized decision.

---

# EXEC-0397 | ACTIVE | 397. GUIDELINE VS CONTRAINDICATION

Patient-specific contraindication/safety rule can suppress or modify a general recommendation.

Suppression must be explainable.

---

# EXEC-0398 | ACTIVE | 398. PRIORITY ARBITRATION

When multiple recommendations compete, priority can consider:
- immediate safety;
- severity;
- urgency;
- evidence;
- patient context;
- due date;
- workflow burden.

Do not let AI alone define priority for safety-critical items.

---

# EXEC-0399 | ACTIVE | 399. CLINICAL ATTENTION BUDGET

The physician's attention is a scarce safety resource.

Every alert/recommendation should justify interruption cost.

Measure:
- alerts per encounter;
- actionable fraction;
- overrides;
- time cost.

---

# EXEC-0400 | ACTIVE | 400. UI DENSITY ADAPTATION

High-risk information receives prominence.

Low-risk suggestions use progressive disclosure.

Do not make all intelligence visually equal.

---

# EXEC-0401 | ACTIVE | 401. NO DARK PATTERNS IN CLINICAL DECISIONS

Do not bias physician toward system recommendation through deceptive defaults, color or button placement.

Accept/decline/inspect interactions should preserve professional agency.

---

# EXEC-0402 | ACTIVE | 402. DEFAULT-ACTION SAFETY

Default selections in medication/orders can cause errors.

High-risk defaults require evidence and human-factors validation.

“No selection” can be safer than a convenient default.

---

# EXEC-0403 | ACTIVE | 403. CONFIRMATION FATIGUE

Do not add confirmation dialogs indiscriminately.

Use confirmations only where risk justifies interruption.

Measure cancellation/override behavior.

---

# EXEC-0404 | ACTIVE | 404. KEYBOARD SHORTCUT SAFETY

Shortcuts for destructive/high-impact actions require safeguards.

No single accidental keystroke should sign, prescribe or close a critical workflow without appropriate confirmation/context.

---

# EXEC-0405 | ACTIVE | 405. MOBILE SAFETY CONSTRAINTS

Small-screen UI may restrict complex/high-risk actions if safe presentation cannot be guaranteed.

Responsive design does not mean every action must be equally available on every device.

---

# EXEC-0406 | ACTIVE | 406. ACCESSIBILITY AS SAFETY

Clinical risk cannot depend only on color, hover or tiny visual differences.

Support keyboard, screen readers and sufficient semantic labeling.

---

# EXEC-0407 | ACTIVE | 407. LOCALIZATION QA

Clinical translations require domain review for high-risk terminology.

Do not rely solely on machine translation for medication/safety wording.

---

# EXEC-0408 | ACTIVE | 408. PATIENT-FACING EXPLANATION SEPARATION

Patient-facing AI/explanations are a distinct product surface from clinician-facing decision support.

Different:
- language;
- risk;
- permissions;
- evidence presentation;
- escalation.

Never expose internal differential reasoning automatically to patient portal.

---

# EXEC-0409 | ACTIVE | 409. PATIENT MESSAGE SAFETY

Automated patient messages must not communicate unreviewed critical interpretations unless specifically validated/governed.

---

# EXEC-0410 | ACTIVE | 410. CRITICAL RESULT COMMUNICATION REDUNDANCY

Critical-result workflow may require multiple communication channels/escalations depending on policy.

Delivery receipt is not equivalent to clinical acknowledgement.

---

# EXEC-0411 | ACTIVE | 411. EXTERNAL COMMUNICATION PROVENANCE

Record:
- message template/version;
- destination;
- channel;
- send time;
- delivery status;
- triggering clinical object.

Avoid storing unnecessary message content in general telemetry.

---

# EXEC-0412 | ACTIVE | 412. TEMPLATE GOVERNANCE

Clinical communication/prescription templates are versioned.

Template changes cannot remove required safety/legal fields without validation.

---

# EXEC-0413 | ACTIVE | 413. PRESCRIPTION RENDERING VALIDATION

Rendered prescription artifact must be tested for:
- missing fields;
- clipping;
- wrong patient;
- wrong medication;
- pagination;
- QR/folio integrity;
- locale;
- print/PDF consistency.

Structured prescription remains source of truth; rendering is a derived artifact.

---

# EXEC-0414 | ACTIVE | 414. PDF GENERATION DETERMINISM

Where legal/audit needs require, preserve generated artifact hash and template/version.

A later template update must not change the historical prescription PDF.

---

# EXEC-0415 | ACTIVE | 415. DOCUMENT EXTRACTION LINEAGE

Every extracted field links to:
- document ID/version;
- page;
- region/span where possible;
- extraction model/version;
- verification status.

---

# EXEC-0416 | ACTIVE | 416. OCR ERROR BOUNDARY

OCR output is untrusted candidate text.

High-risk numeric extraction requires validation and/or human confirmation depending on context.

Common confusion classes (decimal, unit, digit) need adversarial tests.

---

# EXEC-0417 | ACTIVE | 417. TABLE EXTRACTION VALIDATION

Laboratory PDFs often contain tables.

Validate row/column association, units, reference ranges and patient/document identity before structured activation.

---

# EXEC-0418 | ACTIVE | 418. MULTIMODAL MODEL BOUNDARY

Image/document AI may assist extraction/classification.

It does not autonomously interpret diagnostic imaging as authoritative unless separately intended, validated and regulated.

---

# EXEC-0419 | ACTIVE | 419. IMAGING METADATA INTEGRITY

Preserve study/accession/modality/date/body-part identifiers.

Do not rely only on report text to associate imaging.

---

# EXEC-0420 | ACTIVE | 420. IMAGING FOLLOW-UP DEDUPLICATION

A single finding may appear in report, addendum and referral.

Follow-up registry must avoid duplicate obligations while preserving source relationships.

---

# EXEC-0421 | ACTIVE | 421. LAB CORRECTION PROPAGATION

Corrected lab result triggers:
- trend invalidation/rebuild;
- rule reevaluation;
- obligation impact analysis;
- historical provenance preservation.

---

# EXEC-0422 | ACTIVE | 422. ANALYTE IDENTITY

Trend engine must not merge tests solely by similar display name.

Use canonical analyte + method/context where required.

---

# EXEC-0423 | ACTIVE | 423. REFERENCE INTERVAL CHANGE VISUALIZATION

When historical reference intervals differ, display appropriately.

Do not retrospectively mark an old result abnormal using today's interval without clear distinction.

---

# EXEC-0424 | ACTIVE | 424. FORMULA APPLICABILITY VERSIONING

If a formula's recommended population changes, applicability version changes even if mathematical formula remains identical.

---

# EXEC-0425 | ACTIVE | 425. COMPUTATION RESULT STATUS UX

UI must visibly distinguish:
- computed;
- estimated;
- insufficient data;
- stale input;
- unsupported;
- conflicting.

Do not show all as ordinary numbers.

---

# EXEC-0426 | ACTIVE | 426. ESTIMATE VS MEASUREMENT

Derived estimates must not masquerade as measured observations.

Store/display provenance type.

---

# EXEC-0427 | ACTIVE | 427. PHYSIOLOGIC PLAUSIBILITY

Plausibility checks can catch data-entry errors.

But extreme valid values exist.

Policy can:
- warn;
- require confirmation;
- block only when mathematically/physically impossible or governed.

Do not automatically discard extreme clinical values.

---

# EXEC-0428 | ACTIVE | 428. OUTLIER PRESERVATION

Never delete an outlier merely because statistical model dislikes it.

Outlier status is metadata until verified/corrected.

---

# EXEC-0429 | ACTIVE | 429. MANUAL OVERRIDE OF INPUT

If physician confirms an unusual value, record confirmation and allow governed computation where appropriate.

---

# EXEC-0430 | ACTIVE | 430. COMPUTATION CHAIN DEPTH

Limit/inspect deep chains of derived-on-derived values.

High-risk calculations should prefer primary verified inputs where possible.

Provenance graph exposes chain depth.

---

# EXEC-0431 | ACTIVE | 431. DERIVATION CYCLE PREVENTION

Derived value must not indirectly become its own input.

Dependency graph rejects cycles unless explicitly modeled iterative method.

---

# EXEC-0432 | ACTIVE | 432. CLINICAL GRAPH CONSISTENCY

Clinical Graph relationships are evidence-linked.

Do not infer a definitive disease relation solely because two concepts co-occur.

---

# EXEC-0433 | ACTIVE | 433. GRAPH EDGE PROVENANCE

Every clinically meaningful graph edge records origin:
- explicit clinician assertion;
- imported structured relationship;
- deterministic derivation;
- AI suggestion;
- knowledge relationship.

---

# EXEC-0434 | ACTIVE | 434. AI-SUGGESTED GRAPH EDGES

AI-created relationships remain candidate edges until validation policy permits promotion.

---

# EXEC-0435 | ACTIVE | 435. SEARCH SAFETY

Universal search ranks relevance but must not:
- cross tenant;
- hide exact identifiers behind fuzzy results;
- silently merge patients.

Exact patient identity signals outrank semantic convenience.

---

# EXEC-0436 | ACTIVE | 436. FUZZY PATIENT SEARCH BOUNDARY

Fuzzy matching assists discovery, not identity proof.

Selecting patient requires explicit record context.

---

# EXEC-0437 | ACTIVE | 437. DUPLICATE-PATIENT MODEL EVALUATION

If ML assists duplicate detection:
- optimize for safe review workflow;
- evaluate false merge risk separately from missed duplicate risk.

Automatic merge is prohibited baseline.

---

# EXEC-0438 | ACTIVE | 438. MERGE REVERSIBILITY

Patient merge should be reversible through controlled audited process where technically/legally feasible.

Never lose source ownership/provenance.

---

# EXEC-0439 | ACTIVE | 439. AUTHORIZATION TEST GENERATION

Generate negative authorization tests across:
- roles;
- tenants;
- facilities;
- patient relationships;
- break-glass;
- background jobs.

Security correctness is combinatorial too.

---

# EXEC-0440 | ACTIVE | 440. POLICY ENGINE VERSIONING

Authorization policies influencing access are versioned and testable.

A policy change receives behavioral diff over representative principals/resources.

---

# EXEC-0441 | ACTIVE | 441. RLS POLICY TESTING

If Postgres RLS is used:
- positive/negative tenant tests;
- privileged-role tests;
- migration tests;
- background-worker tests.

RLS bypass roles are tightly controlled.

---

# EXEC-0442 | ACTIVE | 442. SECURITY/CLINICAL INTERACTION TESTS

Test scenarios where security failure can become clinical harm:
- blocked access during emergency;
- stale session on wrong patient;
- revoked clinician still receiving result;
- notification sent after permission change.

---

# EXEC-0443 | ACTIVE | 443. CONSENT POLICY VERSIONING

Consent-dependent sharing/access rules require versioned policy and effective dates.

Historical access audit records which consent/policy was evaluated.

---

# EXEC-0444 | ACTIVE | 444. CONSENT REVOCATION PROPAGATION

Revocation affects future access/sharing according to policy without rewriting historical lawful events.

---

# EXEC-0445 | ACTIVE | 445. PURPOSE-OF-USE ENFORCEMENT

Sensitive operations can require purpose-of-use context.

Do not collect purpose merely as decorative metadata if policy depends on it.

---

# EXEC-0446 | ACTIVE | 446. MINIMUM-NECESSARY CONTEXT BUILDER

AI/integration context is assembled by purpose-specific selectors.

Selectors are versioned/tested.

Avoid ad hoc `JSON.stringify(patient)` patterns.

---

# EXEC-0447 | ACTIVE | 447. CONTEXT LEAKAGE TESTS

Test that AI task context excludes:
- unrelated patient;
- unrelated encounter;
- hidden administrative secrets;
- unnecessary identifiers.

---

# EXEC-0448 | ACTIVE | 448. PROMPT TEMPLATE VERSIONING

Prompts influencing clinical outputs are versioned artifacts with:
- task;
- model compatibility;
- schema;
- safety policy;
- evaluation report.

Prompt edits can change behavior and require evaluation.

---

# EXEC-0449 | ACTIVE | 449. MODEL ROUTING VERSIONING

AI Gateway routing policy is versioned.

A change in model selection is a behavior change even if application code is unchanged.

---

# EXEC-0450 | ACTIVE | 450. MODEL FALLBACK POLICY

Fallback models require task-specific validation.

Never fall back from a validated model to an arbitrary cheaper/general model for high-risk task.

---

# EXEC-0451 | ACTIVE | 451. AI PROVIDER OUTAGE

Safe response:
- deterministic/knowledge system continues;
- AI task marked unavailable;
- draft/documentation fallback where possible;
- no hidden model substitution outside approved routing.

---

# EXEC-0452 | ACTIVE | 452. AI RATE-LIMIT DEGRADATION

Prioritize:
- safety-relevant bounded tasks;
- encounter-critical documentation assistance;
over:
- low-priority analytics;
- bulk summaries.

Core clinical safety never depends on rate-limited LLM.

---

# EXEC-0453 | ACTIVE | 453. AI OUTPUT SCHEMA STRICTNESS

Reject malformed structured outputs.

Do not “best effort” parse clinically consequential malformed JSON into authoritative data.

---

# EXEC-0454 | ACTIVE | 454. AI CITATION VALIDATION

AI may only cite source IDs actually present in retrieval context.

Validate:
- source exists;
- span/artifact exists;
- claim relation where possible.

Invented citation is a model defect.

---

# EXEC-0455 | ACTIVE | 455. AI TEMPORAL GROUNDING

Prompt/context must distinguish historical vs current facts.

A past medication must not be summarized as active because it appears frequently.

---

# EXEC-0456 | ACTIVE | 456. AI CONTRADICTION DETECTION

If retrieved chart facts conflict, AI should surface conflict rather than choose silently.

---

# EXEC-0457 | ACTIVE | 457. AI OUTPUT PERSISTENCE POLICY

Store:
- task;
- model/version;
- policy/prompt version;
- input context references/hash;
- structured output;
- acceptance/rejection when needed.

Do not store hidden chain-of-thought.

---

# EXEC-0458 | ACTIVE | 458. AI REGENERATION SEMANTICS

Regenerating an AI summary creates a new candidate version.

Do not overwrite previously accepted clinical text without explicit workflow.

---

# EXEC-0459 | ACTIVE | 459. AI ACCEPTANCE GRANULARITY

Where useful, physician can accept/reject individual structured suggestions rather than all-or-nothing block.

This reduces accidental acceptance.

---

# EXEC-0460 | ACTIVE | 460. AI AUTOCOMPLETE SAFETY

Autocomplete must not silently insert clinically consequential assertions.

Clearly distinguish suggestion from committed chart data.

---

# EXEC-0461 | ACTIVE | 461. AI HALLUCINATION INCIDENT CLASS

Track unsupported/fabricated:
- fact;
- source;
- dose;
- diagnosis;
- timeline;
- patient relation.

High-risk hallucinations trigger model/task review.

---

# EXEC-0462 | ACTIVE | 462. AI TASK ALLOWLIST

AI Gateway only executes registered task types.

No arbitrary user prompt receives unrestricted clinical tools/context by default.

---

# EXEC-0463 | ACTIVE | 463. TOOL-USE CAPABILITY TOKENS

If AI tools are introduced, grant narrow capability per task:
- read selected facts;
- draft;
- retrieve knowledge.

No broad “clinical admin” tool with uncontrolled mutation.

---

# EXEC-0464 | ACTIVE | 464. TWO-PHASE AI ACTION

For any future AI-assisted mutable action:

```text
propose
→ deterministic validation
→ human confirmation where required
→ execute
```

No direct model-to-database clinical mutation.

---

# EXEC-0465 | ACTIVE | 465. AI SANDBOX EVALUATION

New model versions run:
- offline eval;
- adversarial eval;
- shadow task comparison;
before production routing.

---

# EXEC-0466 | ACTIVE | 466. MODEL VERSION PINNING

High-risk tasks pin validated model versions/capabilities where provider permits.

Provider-side silent model changes require monitoring and contractual/technical mitigation where possible.

---

# EXEC-0467 | ACTIVE | 467. PROVIDER CHANGE DETECTION

Record provider model identifiers and behavior metrics.

Unexpected behavior drift triggers investigation.

---

# EXEC-0468 | ACTIVE | 468. AI COST ANOMALY AS SECURITY SIGNAL

Sudden token/call spikes can indicate:
- loop;
- abuse;
- prompt injection;
- context explosion.

Monitor cost/usage alongside safety.

---

# EXEC-0469 | ACTIVE | 469. CONTEXT SIZE LIMIT

Purpose-specific maximum context.

Large chart retrieval uses selection/summarization hierarchy, not uncontrolled full-record dumping.

---

# EXEC-0470 | ACTIVE | 470. SUMMARY-OF-SUMMARY DRIFT

Repeatedly summarizing previous summaries can accumulate error.

Periodic summaries should ground against source facts, not only prior generated summary.

---

# EXEC-0471 | ACTIVE | 471. SOURCE-ANCHORED SUMMARIZATION

Clinical summary statements should link to underlying chart facts where feasible.

---

# EXEC-0472 | ACTIVE | 472. LONGITUDINAL SUMMARY INVALIDATION

When source fact is corrected, identify AI summaries containing dependent claim and mark stale/regenerate as policy permits.

---

# EXEC-0473 | ACTIVE | 473. AI-DERIVED DATA TTL

Some AI-derived artifacts should expire/recompute as chart evolves.

Define freshness/TTL by task.

---

# EXEC-0474 | ACTIVE | 474. KNOWLEDGE RETRIEVAL SNAPSHOT

For clinically consequential AI output, preserve identifiers/versions of retrieved knowledge used at generation time.

---

# EXEC-0475 | ACTIVE | 475. EVAL COVERAGE REGISTRY

Track which requirements/risks each eval covers.

Avoid thousands of tests that all exercise the same easy behavior.

---

# EXEC-0476 | ACTIVE | 476. TEST EFFECTIVENESS METRICS

Beyond coverage:
- mutation score;
- escaped defects;
- flaky rate;
- boundary coverage;
- requirement coverage;
- hazard coverage.

---

# EXEC-0477 | ACTIVE | 477. FLAKY TEST POLICY

Flaky safety tests are defects.

Do not simply rerun until green.

Quarantine only with owner/risk and replacement protection.

---

# EXEC-0478 | ACTIVE | 478. NONDETERMINISTIC TEST CONTROL

Deterministic algorithms use deterministic tests.

Probabilistic model evals use repeated/statistical evaluation with fixed datasets/configuration where possible.

---

# EXEC-0479 | ACTIVE | 479. TEST DATA FACTORY

Synthetic data generation respects:
- plausible relationships;
- edge cases;
- impossible cases;
- jurisdiction;
- age/life stage.

Do not use only random independent fields that create meaningless clinical combinations.

---

# EXEC-0480 | ACTIVE | 480. GENERATIVE ADVERSARIAL TESTING

Use AI to propose novel edge cases, but validate expected outcomes independently.

AI is a test generator, not final oracle.

---

# EXEC-0481 | ACTIVE | 481. CONTINUOUS VERIFICATION

On changes to:
- code;
- algorithm;
- knowledge;
- terminology;
- runtime;
- dependency

automatically select impacted test suites using dependency graph.

---

# EXEC-0482 | ACTIVE | 482. SELECTIVE TESTING WITH SAFETY FLOOR

Impact-based testing can accelerate CI, but C4/C5 always run a minimum mandatory safety suite.

---

# EXEC-0483 | ACTIVE | 483. NIGHTLY / PERIODIC DEEP VALIDATION

Run expensive:
- fuzz;
- mutation;
- large longitudinal;
- replay;
- behavioral diff;
- supply-chain checks

outside per-PR fast path, with release-blocking escalation when failures occur.

---

# EXEC-0484 | ACTIVE | 484. RELEASE CANDIDATE IMMUTABILITY

Once validation starts on a release candidate, artifact set is frozen.

Any behavior-affecting change creates a new candidate and invalidates relevant approvals.

---

# EXEC-0485 | ACTIVE | 485. APPROVAL EXPIRATION ON CHANGE

Clinical/security approvals are tied to exact hashes/versions.

Changing reviewed artifact invalidates approval automatically.

---

# EXEC-0486 | ACTIVE | 486. EVIDENCE BUNDLE HASH

Release evidence bundle can be hashed/signed to prove which evidence supported activation.

---

# EXEC-0487 | ACTIVE | 487. VALIDATION ENVIRONMENT CLEANLINESS

Validation must not depend on developer machine state.

Use reproducible CI/containerized environment where feasible.

---

# EXEC-0488 | ACTIVE | 488. CLOCK / RANDOMNESS CONTROL

Deterministic algorithms receive clock/randomness only through explicit injected interfaces when needed.

No hidden `Date.now()` inside pure clinical computation.

---

# EXEC-0489 | ACTIVE | 489. LOCALE CONTROL

Parsing clinical numeric/date inputs must not depend accidentally on server locale.

External adapters parse according to explicit source format.

---

# EXEC-0490 | ACTIVE | 490. CHARACTER ENCODING

Use UTF-8 and test accents/non-Latin terminology.

Encoding failures must not corrupt identifiers or clinical meaning.

---

# EXEC-0491 | ACTIVE | 491. DECIMAL SEPARATOR SAFETY

Locale inputs such as `1,5` vs `1.5` require explicit parsing policy.

Never guess in high-risk numeric entry without clear UI/source format.

---

# EXEC-0492 | ACTIVE | 492. THOUSANDS-SEPARATOR SAFETY

Prevent `1,000` ambiguity across locales.

Structured numeric APIs should transmit numeric canonical form, not display-formatted strings.

---

# EXEC-0493 | ACTIVE | 493. UNIT PREFIX SAFETY

Explicitly test:
- mg vs mcg;
- mL vs L;
- mmol vs mol.

Prefix errors can be catastrophic.

---

# EXEC-0494 | ACTIVE | 494. DOSAGE EXPRESSION PARSER BOUNDARY

Free-text dosage parsing is candidate extraction only.

Final structured medication order must be validated against typed dose/frequency/route/duration fields.

---

# EXEC-0495 | ACTIVE | 495. ROUTE TERMINOLOGY

Medication route uses canonical concepts.

Do not infer route from drug name alone.

---

# EXEC-0496 | ACTIVE | 496. FREQUENCY SEMANTICS

Avoid ambiguous free-text frequency as computational authority.

Represent schedule structurally where possible.

---

# EXEC-0497 | ACTIVE | 497. MAXIMUM DOSE ENFORCEMENT

When a source-backed max dose applies:
- represent source/version;
- define per-dose vs per-day semantics;
- deterministic validation;
- physician override policy where clinically appropriate.

---

# EXEC-0498 | ACTIVE | 498. FORMULATION FEASIBILITY

Calculated dose may be mathematically correct but impossible to measure/administer.

Medication engine should account for formulation and measurement constraints.

---

# EXEC-0499 | ACTIVE | 499. ROUNDING SAFETY BY FORMULATION

Rounding rules may depend on:
- tablet divisibility;
- syringe resolution;
- concentration;
- device.

Do not use one global dose rounding rule.

---

# EXEC-0500 | ACTIVE | 500. MEDICATION KNOWLEDGE VERSION SNAPSHOT

Prescription safety evaluation records medication knowledge dataset/version used.

---

# EXEC-0501 | ACTIVE | 501. INTERACTION SEVERITY GOVERNANCE

Drug-interaction severity comes from approved source/policy, not LLM sentiment.

---

# EXEC-0502 | ACTIVE | 502. DUPLICATE THERAPY SEMANTICS

Duplicate therapy detection uses pharmacologic concepts/classes and context, not name similarity alone.

---

# EXEC-0503 | ACTIVE | 503. ALLERGY CROSS-REACTIVITY BOUNDARY

Cross-reactivity logic is knowledge-driven and requires explicit source/governance.

Do not infer from text similarity.

---

# EXEC-0504 | ACTIVE | 504. RENAL/HEPATIC ADJUSTMENT BOUNDARY

Dose adjustment logic must distinguish:
- calculation of renal/hepatic metric;
- drug-specific knowledge;
- patient applicability;
- final prescription.

---

# EXEC-0505 | ACTIVE | 505. PREGNANCY/LACTATION KNOWLEDGE BOUNDARY

Use jurisdiction/source-backed medication knowledge.

AI can explain but not invent safety classification.

---

# EXEC-0506 | ACTIVE | 506. PEDIATRIC AGE-BAND BOUNDARIES

Test exact transitions:
- hours/days/months/years;
- inclusive/exclusive endpoints;
- corrected age where relevant.

Boundary dates are common defect sites.

---

# EXEC-0507 | ACTIVE | 507. GERIATRIC CONTEXT BOUNDARY

Age alone does not automatically trigger every geriatric rule.

Use explicit applicability/content governance.

---

# EXEC-0508 | ACTIVE | 508. BODY-SURFACE-AREA CALCULATIONS

If introduced:
- formula/version;
- input units;
- precision;
- population;
- validation;
- max/min constraints.

No hidden formula selection.

---

# EXEC-0509 | ACTIVE | 509. FORMULA SELECTION EXPLANATION

When multiple formulas exist, system must explain which was selected and why.

---

# EXEC-0510 | ACTIVE | 510. MANUAL FORMULA SELECTION

If clinician can select alternate validated formula:
- show applicability;
- record choice;
- preserve version;
- prevent unsupported selection where policy blocks it.

---

# EXEC-0511 | ACTIVE | 511. REFERENCE IMPLEMENTATION ARCHIVE

Preserve validation reference implementations for C4/C5 even if production implementation evolves.

---

# EXEC-0512 | ACTIVE | 512. PERFORMANCE OPTIMIZATION EQUIVALENCE

Any optimized implementation must pass differential equivalence against reference implementation before activation.

---

# EXEC-0513 | ACTIVE | 513. HARDWARE NUMERIC CONSISTENCY

If computation moves across JS/Node/WASM/database/native services, test numeric consistency across runtimes.

---

# EXEC-0514 | ACTIVE | 514. DATABASE-COMPUTED VALUE POLICY

Avoid duplicating clinical formulas in DB triggers/generated columns and application code unless explicitly governed.

Multiple implementations increase drift risk.

---

# EXEC-0515 | ACTIVE | 515. SINGLE AUTHORITATIVE COMPUTATION PATH

For each clinical algorithm, define one authoritative production execution path.

Other implementations are validation/reference unless explicitly designated.

---

# EXEC-0516 | ACTIVE | 516. API VERSIONING FOR COMPUTATION

External/internal consumers must not accidentally receive changed semantics under same API contract.

Separate API compatibility from algorithm versioning.

---

# EXEC-0517 | ACTIVE | 517. CLIENT CAPABILITY NEGOTIATION

Older clients must handle new statuses/warnings safely.

Do not introduce a new critical state that old UI renders as ordinary success.

---

# EXEC-0518 | ACTIVE | 518. BACKWARD-COMPATIBLE STATUS EVOLUTION

Unknown enum values should fail safely or render generic unavailable state—not default to normal.

---

# EXEC-0519 | ACTIVE | 519. SCHEMA CONTRACT TESTS BETWEEN PACKAGES

Use generated types/contracts where possible.

Runtime schema validation remains at process/network boundaries.

---

# EXEC-0520 | ACTIVE | 520. ERROR TAXONOMY

Errors are typed:
- validation;
- applicability;
- data quality;
- dependency;
- authorization;
- runtime;
- infrastructure;
- safety block.

Avoid generic `500` as only semantics.

---

# EXEC-0521 | ACTIVE | 521. USER-FACING ERROR MAPPING

Technical error maps to safe clinician message without leaking secrets or hiding clinically relevant unavailability.

---

# EXEC-0522 | ACTIVE | 522. RETRY UX

If retry is safe, UI indicates retry.

If retry could duplicate action, backend idempotency protects it.

---

# EXEC-0523 | ACTIVE | 523. TIMEOUT UX

A timed-out computation is not “normal”.

Show pending/unavailable and avoid stale silent substitution.

---

# EXEC-0524 | ACTIVE | 524. PARTIAL RESULT POLICY

For multi-part computation, define whether partial outputs are:
- safe to show;
- hidden;
- explicitly incomplete.

Never present partial panel as complete clinical assessment.

---

# EXEC-0525 | ACTIVE | 525. ATOMIC CLINICAL PRESENTATION

Where multiple values must be interpreted together, consider snapshot consistency so UI does not mix outputs from different patient-state versions.

---

# EXEC-0526 | ACTIVE | 526. PATIENT STATE VERSION DISPLAY

High-risk workflows can bind to a Patient State version.

If material facts change, prompt recalculation/review.

---

# EXEC-0527 | ACTIVE | 527. STALE SCREEN DETECTION

Long-open encounter tabs should detect material patient-state changes from another user/source.

---

# EXEC-0528 | ACTIVE | 528. REAL-TIME UPDATE PRIORITY

Not every update requires immediate UI push.

Critical result/patient identity changes may have higher real-time priority than low-risk analytics.

---

# EXEC-0529 | ACTIVE | 529. EVENTUAL CONSISTENCY DISCLOSURE

Where projections are eventually consistent, safety-critical actions should not assume projection freshness without checking source/version.

---

# EXEC-0530 | ACTIVE | 530. SOURCE DIRECT READ FOR CRITICAL VALIDATION

For selected high-risk actions, re-read authoritative source data rather than relying solely on potentially lagged cache/projection.

---

# EXEC-0531 | ACTIVE | 531. CACHE POISONING DEFENSE

Validate cached object tenant/version/integrity metadata.

Never use user-controlled cache key fragments without normalization.

---

# EXEC-0532 | ACTIVE | 532. DISTRIBUTED LOCK CAUTION

Do not use distributed locks as a substitute for proper idempotency/state-machine design.

Use only when semantics require and failure behavior is understood.

---

# EXEC-0533 | ACTIVE | 533. LEASE EXPIRY

If leases/locks are used, handle worker death and expiry safely.

---

# EXEC-0534 | ACTIVE | 534. WORKFLOW VERSIONING

Long-running workflows record workflow definition version.

New deployments must not reinterpret in-flight workflow state incompatibly.

---

# EXEC-0535 | ACTIVE | 535. WORKFLOW MIGRATION

If workflow definition changes, define:
- old instances continue old version;
- migrate with explicit tool;
- cancel/restart where safe.

Never silently reinterpret.

---

# EXEC-0536 | ACTIVE | 536. TIMER DURABILITY

Clinical escalation timers use durable workflow/timer infrastructure.

No in-memory timer for critical follow-up.

---

# EXEC-0537 | ACTIVE | 537. TIMER TIMEZONE SEMANTICS

Due dates distinguish absolute instant vs local clinical date.

DST/timezone changes must not shift intended local follow-up incorrectly.

---

# EXEC-0538 | ACTIVE | 538. BUSINESS DAY CALENDAR

If future policies depend on business days, calendar is jurisdiction/facility-specific and versioned.

Do not hardcode Monday-Friday globally.

---

# EXEC-0539 | ACTIVE | 539. HOLIDAY CALENDAR GOVERNANCE

Holiday calendars affecting clinical operations are data artifacts with source/version.

---

# EXEC-0540 | ACTIVE | 540. SLA VS CLINICAL DUE DATE

Operational SLA and patient clinical due date are distinct fields.

Do not conflate them.

---

# EXEC-0541 | ACTIVE | 541. ESCALATION POLICY VERSIONING

Obligation/result escalation policy is versioned and linked to created workflow.

---

# EXEC-0542 | ACTIVE | 542. ESCALATION RECIPIENT RESOLUTION

Recipient can change due to staffing.

Resolve current responsible role according to policy while preserving historical ownership transitions.

---

# EXEC-0543 | ACTIVE | 543. ORPHAN DETECTION

Continuously detect clinical objects lacking required:
- owner;
- patient;
- source;
- status;
- closure criterion.

---

# EXEC-0544 | ACTIVE | 544. TERMINAL-STATE AUDIT

Terminal does not mean deleted.

Closed/cancelled/not-performed states retain reason and provenance.

---

# EXEC-0545 | ACTIVE | 545. REOPEN SEMANTICS

If a closed clinical obligation/result needs reopening:
- explicit transition;
- reason;
- actor;
- new due/escalation as needed.

---

# EXEC-0546 | ACTIVE | 546. ARCHITECTURAL FITNESS FUNCTIONS

Automate architecture rules:
- no direct UI→DB;
- no AI SDK in clinical-domain;
- no cross-domain table imports;
- no clinical threshold literals in forbidden paths;
- no PHI logging APIs in restricted packages.

Fitness functions run in CI.

---

# EXEC-0547 | ACTIVE | 547. DEPENDENCY DIRECTION TESTS

Enforce package dependency graph programmatically.

Architecture diagrams alone do not prevent erosion.

---

# EXEC-0548 | ACTIVE | 548. CYCLIC PACKAGE DEPENDENCY BLOCKER

CI rejects forbidden cycles.

---

# EXEC-0549 | ACTIVE | 549. PUBLIC API SURFACE MINIMIZATION

Packages expose narrow APIs.

Internal implementation details remain private to reduce accidental coupling.

---

# EXEC-0550 | ACTIVE | 550. DOMAIN EVENT CATALOG

Maintain versioned catalog of domain events and owners.

Events are contracts, not arbitrary strings.

---

# EXEC-0551 | ACTIVE | 551. EVENT SEMANTIC OWNERSHIP

Producer owns event meaning/schema; consumers cannot reinterpret it ad hoc.

---

# EXEC-0552 | ACTIVE | 552. EVENT PII CLASSIFICATION

Each event declares data sensitivity.

Default to identifiers/references rather than full clinical payloads.

---

# EXEC-0553 | ACTIVE | 553. DATA CLASSIFICATION

Classify:
- public;
- internal;
- confidential;
- PHI/sensitive clinical;
- secrets/keys.

Controls derive from classification.

---

# EXEC-0554 | ACTIVE | 554. SECRET ZERO POLICY

No secret in:
- source;
- prompt;
- test fixture;
- logs;
- generated docs.

Automated secret scanning required.

---

# EXEC-0555 | ACTIVE | 555. PRODUCTION ACCESS JUST-IN-TIME

Prefer time-limited, audited production access for humans.

Coding agents receive no routine production access.

---

# EXEC-0556 | ACTIVE | 556. SUPPORT ACCESS MEDIATION

Support staff access to clinical data is purpose-limited and auditable.

Use impersonation/support tooling carefully; avoid shared credentials.

---

# EXEC-0557 | ACTIVE | 557. DATA EXPORT INTEGRITY

Exports include version/provenance where needed and must not silently omit clinically important records due to pagination/filter bugs.

---

# EXEC-0558 | ACTIVE | 558. EXPORT RECONCILIATION

Large exports produce counts/checksums/manifests for completeness verification.

---

# EXEC-0559 | ACTIVE | 559. IMPORT IDEMPOTENCY

Repeated import of same source should not duplicate clinical facts.

---

# EXEC-0560 | ACTIVE | 560. INTEROPERABILITY SEMANTIC VALIDATION

FHIR/HL7 validity does not guarantee clinical semantic correctness.

Validate mappings and units/terminology.

---

# EXEC-0561 | ACTIVE | 561. FHIR VERSION BOUNDARY

FHIR adapter declares supported version/profile.

Internal domain remains decoupled.

---

# EXEC-0562 | ACTIVE | 562. PROFILE CONFORMANCE TESTING

Where interoperating against profiles, use conformance tests and example fixtures.

---

# EXEC-0563 | ACTIVE | 563. DICOM UID INTEGRITY

Imaging integration preserves DICOM identifiers and avoids accidental cross-patient/study association.

---

# EXEC-0564 | ACTIVE | 564. EXTERNAL IDENTIFIER NAMESPACE

Identifiers always carry issuer/system namespace.

Never compare raw identifier strings across issuers as globally unique.

---

# EXEC-0565 | ACTIVE | 565. API IDEMPOTENCY CONTRACT

Mutating APIs for critical workflows support idempotency where retries are expected.

---

# EXEC-0566 | ACTIVE | 566. API RATE-LIMIT CLASSIFICATION

Rate limits distinguish:
- interactive clinician;
- patient portal;
- integration;
- bulk;
- AI.

Do not let bulk traffic starve critical clinician operations.

---

# EXEC-0567 | ACTIVE | 567. API ABUSE DETECTION

Monitor unusual:
- patient enumeration;
- export volume;
- computation volume;
- failed authz.

Security response must avoid disrupting emergency care without policy.

---

# EXEC-0568 | ACTIVE | 568. DENIAL-OF-SERVICE DEGRADATION

Prioritize essential clinical paths under resource pressure.

---

# EXEC-0569 | ACTIVE | 569. TENANT QUOTA SAFETY

Commercial quota exhaustion must not silently block safety-critical access to existing clinical records.

Define product/business policy carefully.

---

# EXEC-0570 | ACTIVE | 570. BILLING/CLINICAL FIREWALL

Payment failure must not corrupt or delete clinical truth.

---

# EXEC-0571 | ACTIVE | 571. LICENSE EXPIRATION BEHAVIOR

If subscription/license changes restrict functionality, preserve legally/clinically required read/export/access according to policy.

---

# EXEC-0572 | ACTIVE | 572. DATA OWNERSHIP SEMANTICS

Product/legal documentation must distinguish data controller/responsibility concepts per jurisdiction.

Architecture supports export, access, correction and retention workflows without making unsupported legal claims.

---

# EXEC-0573 | ACTIVE | 573. COMPLIANCE EVIDENCE AUTOMATION

Generate evidence from:
- CI;
- access reviews;
- backups;
- restore drills;
- vulnerability scans;
- release manifests;
- training/approval records where integrated.

Compliance should reuse operational truth rather than screenshots assembled at audit time.

---

# EXEC-0574 | ACTIVE | 574. CONTROL-TO-EVIDENCE MAPPING

Every compliance/security control identifies:
- implementation;
- owner;
- test;
- evidence source;
- frequency;
- exceptions.

---

# EXEC-0575 | ACTIVE | 575. EXCEPTION MANAGEMENT

Control exceptions require:
- scope;
- risk;
- compensating control;
- approver;
- expiry.

No permanent undocumented exception.

---

# EXEC-0576 | ACTIVE | 576. RISK ACCEPTANCE EXPIRY

Risk acceptance has review/expiry date.

Expired acceptance reopens risk.

---

# EXEC-0577 | ACTIVE | 577. THREAT MODEL UPDATE TRIGGERS

Update threat model when:
- new external integration;
- new AI tool capability;
- new data class;
- new country;
- new patient portal capability;
- architecture boundary change.

---

# EXEC-0578 | ACTIVE | 578. SAFETY CASE UPDATE TRIGGERS

Update safety case when:
- intended use changes;
- algorithm behavior changes;
- new population;
- new evidence;
- serious incident;
- workflow autonomy increases.

---

# EXEC-0579 | ACTIVE | 579. INTENDED-USE DRIFT DETECTION

Product marketing, UI wording and actual behavior must not silently expand intended clinical use beyond validated/regulatory scope.

---

# EXEC-0580 | ACTIVE | 580. CLAIMS GOVERNANCE

Claims such as:
- “97% accurate”;
- “prevents errors”;
- “diagnoses”;
- “compliant/certified”

require evidence/legal/regulatory approval.

Engineering metrics are not automatically marketing claims.

---

# EXEC-0581 | ACTIVE | 581. QUALITY ATTRIBUTE SCENARIOS

Architecture reviews use concrete scenarios for:
- availability;
- latency;
- security;
- modifiability;
- auditability;
- recoverability;
- clinical safety.

Example:
“Terminology service fails during pediatric prescribing; physician must still see current chart and receive explicit inability to run affected safety check.”

---

# EXEC-0582 | ACTIVE | 582. ARCHITECTURE TRADEOFF RECORD

When optimizing one quality attribute harms another, record tradeoff in ADR.

No “best architecture” without context.

---

# EXEC-0583 | ACTIVE | 583. COMPLEXITY BUDGET

Every new subsystem must justify complexity.

Avoid:
- premature microservices;
- premature custom DSL;
- premature graph database;
- duplicate rule engines.

Ultra-developed does not mean maximally complicated.

It means **maximally controlled complexity**.

---

# EXEC-0584 | ACTIVE | 584. DELETE/DECLINE COMPLEXITY

If a mechanism does not materially improve:
- safety;
- correctness;
- traceability;
- scalability;
- operability;
- developer reliability,

do not add it merely because it is sophisticated.

---

# EXEC-0585 | ACTIVE | 585. SIMPLE REFERENCE PATH

Maintain one simple end-to-end reference path that engineers can understand completely.

Complex optimizations must remain comparable to this reference.

---

# EXEC-0586 | ACTIVE | 586. ARCHITECTURE REVIEW CADENCE

Perform formal reviews:
- before first implementation;
- after golden vertical slice;
- before C4/C5 production;
- after major incident;
- before major internationalization/regulatory expansion.

---

# EXEC-0587 | ACTIVE | 587. INDEPENDENT REVIEW

At major gates, use reviewer(s) who did not author the architecture/implementation.

Independence reduces confirmation bias.

---

# EXEC-0588 | ACTIVE | 588. PRE-MORTEM

Before high-risk release ask:
> Assume this caused patient harm six months from now. What plausible chain of failures caused it?

Convert credible chains into tests/controls.

---

# EXEC-0589 | ACTIVE | 589. POST-MORTEM WITHOUT MEMORY LOSS

Incident remediation updates:
- test corpus;
- property registry;
- hazard model;
- runbook;
- architecture if needed.

Never fix only the immediate line of code.

---

# EXEC-0590 | ACTIVE | 590. SYSTEMIC ROOT-CAUSE CLASSIFICATION

Root causes may be:
- specification;
- knowledge;
- data;
- implementation;
- testing;
- review;
- UI/human factors;
- operations;
- governance;
- external dependency.

Do not default every incident to “developer bug”.

---

# EXEC-0591 | ACTIVE | 591. LEADING SAFETY INDICATORS

Track leading indicators:
- stale knowledge;
- expired reviews;
- orphan artifacts;
- failed reconciliation;
- rising override;
- increasing not-computable;
- validation gaps;
- dead letters;
- unowned incidents.

---

# EXEC-0592 | ACTIVE | 592. LAGGING SAFETY INDICATORS

Track:
- confirmed defects;
- patient-impact reviews;
- serious incidents;
- incorrect critical alerts;
- missed obligations.

Use both leading and lagging indicators.

---

# EXEC-0593 | ACTIVE | 593. SAFETY DASHBOARD

Governance dashboard shows:
- C4/C5 asset status;
- review expiry;
- incidents;
- validation;
- knowledge freshness;
- kill-switch state;
- deployment versions.

Not intended as physician workflow UI.

---

# EXEC-0594 | ACTIVE | 594. ENGINEERING HEALTH DASHBOARD

Track:
- flaky tests;
- dependency age;
- migration failures;
- CI duration;
- code ownership gaps;
- architecture fitness violations.

Engineering degradation can become clinical risk.

---

# EXEC-0595 | ACTIVE | 595. KNOWLEDGE HEALTH DASHBOARD

Track:
- stale sources;
- unresolved conflicts;
- terminology drift;
- pending review;
- artifact usage;
- affected populations.

---

# EXEC-0596 | ACTIVE | 596. MODEL HEALTH DASHBOARD

Track per AI task:
- model version;
- eval score;
- abstention;
- unsupported claim rate;
- schema failure;
- latency;
- cost;
- acceptance/rejection.

---

# EXEC-0597 | ACTIVE | 597. CHANGE CORRELATION

When safety metric changes, correlate with:
- software release;
- algorithm release;
- knowledge release;
- terminology release;
- model routing;
- UI experiment.

---

# EXEC-0598 | ACTIVE | 598. EXPERIMENTATION BOUNDARY

A/B experiments must not randomize safety-critical clinical behavior without explicit ethical/clinical/regulatory governance.

UI experiments cannot obscure safety information.

---

# EXEC-0599 | ACTIVE | 599. EXPERIMENT KILL CRITERIA

Experiments have predefined stop criteria.

---

# EXEC-0600 | ACTIVE | 600. SYNTHETIC MONITOR VERSIONING

Synthetic checks are versioned so a changed test does not masquerade as changed system behavior.

---

# EXEC-0601 | ACTIVE | 601. TIME-SERIES BASELINE FOR OPERATIONS

Operational anomaly detection compares metrics over appropriate time/day patterns.

Do not let operational ML automatically alter clinical policy.

---

# EXEC-0602 | ACTIVE | 602. MULTI-REGION FUTURE READINESS

If multi-region is introduced:
- data consistency;
- residency;
- failover;
- clock;
- artifact synchronization;
- key management

must be explicitly designed.

Do not prematurely deploy active-active clinical writes without proven need.

---

# EXEC-0603 | ACTIVE | 603. REGION FAILOVER ARTIFACT CONSISTENCY

Failover region must have compatible:
- software;
- Clinical BOM;
- terminology;
- configuration.

Failing over to stale clinical content is not acceptable.

---

# EXEC-0604 | ACTIVE | 604. BACKUP CONSISTENCY SET

Backups should identify corresponding:
- DB snapshot;
- object storage state;
- artifact registry;
- clinical content manifests.

---

# EXEC-0605 | ACTIVE | 605. RESTORE VALIDATION

Restore drills verify not only data exists but:
- signed notes open;
- historical computations reconstruct;
- obligations resume;
- artifact registry resolves;
- permissions work.

---

# EXEC-0606 | ACTIVE | 606. PARTIAL RESTORE POLICY

Tenant/patient selective restore is dangerous and requires explicit design to preserve references/audit.

Do not improvise in incident.

---

# EXEC-0607 | ACTIVE | 607. DATA CORRUPTION DETECTION

Use constraints, checksums/hashes where appropriate, reconciliation and backups to detect corruption.

---

# EXEC-0608 | ACTIVE | 608. CORRUPTION RESPONSE

On suspected corruption:
- stop propagation;
- preserve evidence;
- identify scope;
- restore/reconcile;
- patient-impact analysis.

---

# EXEC-0609 | ACTIVE | 609. OBJECT STORAGE IMMUTABILITY OPTIONS

For signed artifacts/original documents, consider retention/versioning/immutability controls appropriate to threat/legal requirements.

---

# EXEC-0610 | ACTIVE | 610. MALWARE SCAN FAILURE

If scanner unavailable:
- quarantine new uploads;
- do not expose unscanned file as trusted;
- allow safe core workflow where possible.

---

# EXEC-0611 | ACTIVE | 611. FILE TYPE SNIFFING

Do not trust filename extension/MIME header alone.

Validate file signatures/types.

---

# EXEC-0612 | ACTIVE | 612. DECOMPRESSION / PARSER BOMB DEFENSE

Protect document ingestion from:
- zip bombs;
- huge PDFs;
- pathological images;
- parser exploits.

Use resource limits and sandboxing.

---

# EXEC-0613 | ACTIVE | 613. DOCUMENT PARSER ISOLATION

High-risk parsers/OCR run isolated from core application where practical.

---

# EXEC-0614 | ACTIVE | 614. UNTRUSTED HTML/CONTENT SANITIZATION

External content displayed in UI must be sanitized.

Clinical source text is not trusted HTML.

---

# EXEC-0615 | ACTIVE | 615. PROMPT-INJECTION DATA LABELING

Retrieved text is explicitly labeled as untrusted evidence content, not system instruction.

---

# EXEC-0616 | ACTIVE | 616. AI TOOL OUTPUT VALIDATION

Tool responses consumed by AI are validated before inclusion.

A compromised external integration must not inject executable instructions.

---

# EXEC-0617 | ACTIVE | 617. EXFILTRATION DEFENSE

AI tools cannot send chart data to arbitrary URLs.

Outbound destinations are allowlisted/adapted.

---

# EXEC-0618 | ACTIVE | 618. EGRESS CONTROL

Server/workers handling PHI use controlled egress where infrastructure permits.

---

# EXEC-0619 | ACTIVE | 619. DATA LOSS PREVENTION HOOKS

Support detection/prevention for accidental PHI export/logging as organization matures.

---

# EXEC-0620 | ACTIVE | 620. SECURITY INCIDENT VS CLINICAL INCIDENT COORDINATION

Some incidents are both:
- wrong-patient data leak;
- corrupted clinical rule;
- unavailable critical workflow.

Runbooks coordinate security + clinical safety response.

---

# EXEC-0621 | ACTIVE | 621. ULTRA-HARDENING ACCEPTANCE MATRIX

Before calling the computation/knowledge infrastructure “production hardened”, demonstrate evidence for:

### Correctness
- golden/reference;
- property;
- metamorphic;
- differential;
- mutation;
- boundary;
- unit;
- temporal;
- state-space.

### Safety
- hazard analysis;
- safety case;
- negative capability;
- wrong-patient;
- stale data;
- critical workflow;
- kill/rollback.

### Knowledge
- source provenance;
- compiler;
- conflict;
- freshness;
- impact analysis;
- terminology upgrade.

### Operations
- replay;
- reconciliation;
- dead-letter recovery;
- queue-age monitoring;
- restore;
- failover/degradation.

### Security
- cross-tenant;
- authz;
- artifact integrity;
- supply chain;
- prompt injection;
- egress.

### Human factors
- explanation;
- alert burden;
- default safety;
- mobile/accessibility;
- override.

### Governance
- ownership;
- approval;
- evidence bundle;
- risk classification;
- review expiry;
- incident feedback.

Any missing category prevents “hardened” status.

---

# EXEC-0622 | ACTIVE | 622. MATURITY LEVELS

Use maturity levels rather than vague “complete”.

```text
M0 — Concept
M1 — Specified
M2 — Implemented
M3 — Verified
M4 — Clinically validated
M5 — Production hardened
M6 — Continuously assured
```

No subsystem can claim M5/M6 solely because code exists.

---

# EXEC-0623 | ACTIVE | 623. CONTINUOUS ASSURANCE

M6 requires ongoing evidence:
- monitoring;
- source freshness;
- periodic validation;
- incident learning;
- dependency review;
- restore drills;
- security review;
- clinical governance.

Safety is maintained, not achieved once.

---

# EXEC-0624 | ACTIVE | 624. ULTRA-DEVELOPED DESIGN PRINCIPLE

The target is not “infinite complexity”.

The target is:

> **For every plausible failure class, know whether we prevent it, detect it, contain it, recover from it, or explicitly accept the residual risk—and possess evidence for that answer.**

This is the standard expected from the Clinical Computation Platform.

---

# EXEC-0625 | ACTIVE | 625. FINAL SENIOR/PRINCIPAL ENGINEERING LAW

A sophisticated system can still be unsafe if sophistication is uncontrolled.

Medical OS therefore optimizes for:

```text
correctness
× safety
× traceability
× reproducibility
× recoverability
× evidence freshness
× human usability
× governance
```

not feature count and not architectural fashion.

When a new layer adds complexity without measurable control, reject it.

When a simple invariant prevents an entire class of failure, prefer it.

When uncertainty remains, expose it.

When evidence changes, version it.

When computation changes, compare it.

When production fails, degrade safely.

When an agent is unsure, stop rather than improvise clinical truth.

When the physician must decide, preserve that authority.

---

# EXEC-0626 | ACTIVE | 626. NANOMETRIC PRODUCTION REVIEW — BUG SURFACE MODEL

This pass targets defects that commonly survive architecture review, unit tests and code review, then appear under real production timing, concurrency, migration, partial failure, operator error or semantic ambiguity.

The system must model a bug surface across:

```text
DATA
× TIME
× IDENTITY
× TENANCY
× VERSION
× CONCURRENCY
× RETRY
× CACHE
× QUEUE
× UI STATE
× KNOWLEDGE
× AI
× EXTERNAL SYSTEM
× HUMAN ACTION
× DEPLOYMENT
```

A component can be locally correct and globally wrong.

Production acceptance therefore evaluates interactions, not only functions.

---

# EXEC-0627 | ACTIVE | 627. PRODUCTION INVARIANT CATALOG

Maintain executable invariants with stable IDs.

Examples:

```text
INV-TENANT-001: No clinical object is readable across unauthorized tenants.
INV-SIGN-001: Signed clinical content is never destructively edited.
INV-RESULT-001: Critical result cannot disappear without explicit lifecycle.
INV-OBL-001: Every active clinical obligation has owner + due semantics.
INV-COMP-001: Every persisted computation identifies exact algorithm version.
INV-UNIT-001: No high-risk calculation executes with unresolved unit.
INV-AI-001: AI output cannot directly mutate signed clinical truth.
INV-PATIENT-001: High-impact action is bound server-side to explicit patient.
```

Every invariant maps to:
- enforcing code;
- database/workflow control;
- tests;
- telemetry/reconciliation;
- owner.

---

# EXEC-0628 | ACTIVE | 628. BUG CLASSIFICATION TAXONOMY

Every defect is classified:

```text
B-DATA       data corruption/semantic mismatch
B-TIME       chronology/freshness/timezone
B-ID         wrong identity/patient
B-TENANT     isolation/authz
B-STATE      illegal/stale state transition
B-CONCUR     race/lost update
B-RETRY      duplicate side effect
B-CACHE      stale/cross-version/cross-tenant
B-QUEUE      lost/late/duplicate/out-of-order
B-VERSION    incompatible semantic version
B-MIGRATION  schema/data migration
B-KNOWLEDGE  stale/conflicting/wrong applicability
B-AI         hallucination/context/tool/output
B-UI         presentation/interaction mismatch
B-EXT        third-party integration
B-OPS        deployment/config/operator
B-SEC        abuse/security
B-PERF       resource/latency/backpressure
```

This taxonomy feeds incident trends and test planning.

---

# EXEC-0629 | ACTIVE | 629. RACE CONDITION MATRIX

For every mutable clinical aggregate test:

```text
read/read
read/write
write/write
write/sign
sign/write
result/correction
result/review
review/correction
order/cancel
order/result
obligation/close
obligation/supersede
merge/write
permission-change/write
```

For each pair define:
- expected winner;
- rejection behavior;
- reconciliation;
- audit;
- user feedback.

No clinically consequential `last-write-wins` by accident.

---

# EXEC-0630 | ACTIVE | 630. TOCTOU DEFENSE

Time-of-check/time-of-use defects are explicitly tested.

Examples:
- authorization valid at page load but revoked before mutation;
- patient state checked before prescription but changed before commit;
- algorithm applicability checked before a corrected lab arrives;
- clinician role changes while background task is queued.

High-risk mutations revalidate relevant conditions at execution/commit.

---

# EXEC-0631 | ACTIVE | 631. DOUBLE-SUBMIT DEFENSE

Every high-impact UI action assumes:
- double click;
- browser retry;
- network retry;
- user refresh;
- mobile reconnect.

Examples:
- sign note;
- create prescription;
- close result;
- send patient message;
- create obligation.

Server idempotency is authoritative.

Disabling the button is only UX, never the safety mechanism.

---

# EXEC-0632 | ACTIVE | 632. STALE TAB BUG MODEL

A tab open for hours can contain obsolete:
- patient state;
- permissions;
- medication list;
- allergies;
- result status;
- encounter version.

Before high-impact commit:
- compare version;
- detect material changes;
- require refresh/reconciliation when necessary.

---

# EXEC-0633 | ACTIVE | 633. WRONG-PATIENT TAB SWITCH DEFENSE

Test:
1. open patient A;
2. open patient B;
3. browser back/forward;
4. duplicated tab;
5. delayed API response from A arrives while B visible.

UI state and API response must remain patient-bound.

Never update visible B state with response carrying A context.

---

# EXEC-0634 | ACTIVE | 634. ASYNC RESPONSE CORRELATION

Every asynchronous client request that can update patient UI carries:
- request ID;
- patient/encounter context;
- version where relevant.

Client discards stale/mismatched responses.

---

# EXEC-0635 | ACTIVE | 635. OPTIMISTIC UI LIMITS

Do not optimistically show irreversible/high-risk clinical action as complete before server commit.

Safe candidates for optimistic UI are explicitly classified.

Signing, prescribing, critical-result closure and patient merge are not baseline optimistic actions.

---

# EXEC-0636 | ACTIVE | 636. FORM DIRTY-STATE SAFETY

Navigation/reload/crash must not silently lose clinically meaningful drafts.

Define:
- autosave cadence;
- server draft version;
- local recovery;
- conflict semantics;
- unsaved indicator.

Do not autosave signed content.

---

# EXEC-0637 | ACTIVE | 637. AUTOSAVE RACE DEFENSE

Autosave request N can arrive after N+1.

Persist only if expected draft version is current.

Older autosave must not overwrite newer text.

---

# EXEC-0638 | ACTIVE | 638. IME / COMPOSITION INPUT TESTING

Clinical text entry must test international keyboard composition, accents and mobile input.

Autosave/shortcuts must not fire incorrectly during IME composition.

---

# EXEC-0639 | ACTIVE | 639. BROWSER NAVIGATION TESTS

Test:
- refresh;
- back;
- forward;
- duplicate tab;
- session expiry;
- browser restore;
- deep link.

Clinical context must remain correct.

---

# EXEC-0640 | ACTIVE | 640. SESSION EXPIRY DURING WORK

If session expires during a long encounter:
- preserve recoverable draft;
- reauthenticate;
- revalidate authorization;
- resume safely.

Do not discard work or commit under stale authority.

---

# EXEC-0641 | ACTIVE | 641. PERMISSION CHANGE MID-SESSION

Revocation/role change propagates within defined maximum delay.

High-risk mutation always server-authorized at request time.

---

# EXEC-0642 | ACTIVE | 642. TENANT SWITCH DEFENSE

If users can belong to multiple organizations:
- tenant switch is explicit;
- caches/query keys include tenant;
- local storage is tenant-scoped;
- background requests from previous tenant cannot hydrate current UI.

---

# EXEC-0643 | ACTIVE | 643. CLIENT CACHE KEY LAW

Every patient/tenant-specific client query key contains the full required identity scope.

Example:

```text
["patient", tenantId, patientId, "medications"]
```

Never cache by `patientId` alone if identifier uniqueness is not globally guaranteed.

---

# EXEC-0644 | ACTIVE | 644. SERVER CACHE NAMESPACE LAW

Server cache includes:
- tenant where applicable;
- artifact/version;
- authorization-independent safe key dimensions.

Never cache authorized response object and serve it to another principal without explicit safe design.

---

# EXEC-0645 | ACTIVE | 645. CDN / EDGE CACHE PHI RULE

Authenticated PHI responses default to non-public caching.

No accidental shared CDN cache.

Headers are tested in integration/e2e.

---

# EXEC-0646 | ACTIVE | 646. BROWSER STORAGE POLICY

Define exactly what may enter:
- localStorage;
- sessionStorage;
- IndexedDB;
- service-worker cache.

Sensitive clinical payload persistence is prohibited unless explicitly designed/encrypted/governed.

---

# EXEC-0647 | ACTIVE | 647. SERVICE WORKER SAFETY

If PWA/service worker is introduced:
- never cache authenticated PHI accidentally;
- version caches;
- purge on logout/tenant change;
- test stale app shell/API mismatch.

---

# EXEC-0648 | ACTIVE | 648. LOGOUT PURGE

Logout clears client-side sensitive state and invalidates server session according to auth architecture.

Browser back must not reveal cached PHI after logout.

---

# EXEC-0649 | ACTIVE | 649. MULTI-USER SHARED DEVICE

Test shared workstation:
- user A logout;
- user B login;
- no A patient data in cache/autocomplete/history.

---

# EXEC-0650 | ACTIVE | 650. URL PHI MINIMIZATION

Avoid patient names, diagnoses or sensitive data in URLs/query strings.

URLs leak through history/logs/referrers.

Use opaque IDs where needed.

---

# EXEC-0651 | ACTIVE | 651. REFERRER POLICY

Set appropriate Referrer-Policy so sensitive internal URLs are not leaked to external destinations.

---

# EXEC-0652 | ACTIVE | 652. CLIPBOARD POLICY

Avoid automatically placing PHI in clipboard.

Where copy is intentional, make context clear.

Clipboard cannot be treated as secure storage.

---

# EXEC-0653 | ACTIVE | 653. PRINT SAFETY

Print views:
- bind correct patient;
- include identifiers necessary to avoid mix-up;
- exclude unintended hidden UI data;
- test pagination;
- do not expose other patients from virtualized/background DOM.

---

# EXEC-0654 | ACTIVE | 654. SCREENSHOT / EXPORT BOUNDARY

Product cannot fully prevent OS screenshots.

Do not make false security claims.

Control exports, audit them where appropriate, and minimize accidental exposure.

---

# EXEC-0655 | ACTIVE | 655. PAGINATION CONSISTENCY

Offset pagination can duplicate/skip rows under concurrent inserts.

For mutable clinical feeds/timelines, prefer stable cursor/keyset semantics.

Define deterministic tie-breaker.

---

# EXEC-0656 | ACTIVE | 656. SORT STABILITY

Clinical timeline ordering uses:
- clinical effective timestamp;
- deterministic secondary key.

Two equal timestamps must not randomly reorder between renders.

---

# EXEC-0657 | ACTIVE | 657. DATE-ONLY SEMANTICS

A date-only clinical fact is not midnight UTC.

Use a date type/semantic field, not timestamp conversion.

Examples:
- DOB;
- due date when day precision only;
- historical diagnosis date.

---

# EXEC-0658 | ACTIVE | 658. AGE CALCULATION

Age is calculated from DOB and relevant clinical date, not cached forever.

Pediatric boundaries use exact dates.

Test leap-day births.

---

# EXEC-0659 | ACTIVE | 659. DST BUG SUITE

Test due times/appointments/workflows across daylight-saving transitions in jurisdictions that use them.

Chihuahua/local rules may change over years; timezone database version matters.

Use IANA timezone identifiers, not fixed offsets.

---

# EXEC-0660 | ACTIVE | 660. TZ DATABASE VERSION AWARENESS

Runtime/container upgrades can update timezone rules.

Behavioral regression tests cover clinically relevant scheduling/time calculations.

---

# EXEC-0661 | ACTIVE | 661. CLOCK SKEW IN DISTRIBUTED SYSTEM

Audit ordering cannot assume clocks on separate systems are perfectly synchronized.

Use correlation/event sequence plus timestamps.

---

# EXEC-0662 | ACTIVE | 662. FUTURE-DATED DATA

Future timestamps can be:
- legitimate scheduled event;
- source clock error;
- data-entry error.

Clinical observations future-dated unexpectedly should be flagged, not silently incorporated.

---

# EXEC-0663 | ACTIVE | 663. DUPLICATE REQUEST ID COLLISION

Idempotency key scope includes tenant + operation.

Client-generated IDs are validated for format/ownership.

Do not allow attacker/user to suppress another operation by guessing key.

---

# EXEC-0664 | ACTIVE | 664. IDEMPOTENCY RESPONSE SEMANTICS

Same idempotency key with different payload:
- reject conflict.

Never return success from previous payload for materially different request.

---

# EXEC-0665 | ACTIVE | 665. OUTBOX POISON MESSAGE

One malformed event must not block the entire partition indefinitely.

Use bounded retries + dead-letter + alert + safe continuation policy.

---

# EXEC-0666 | ACTIVE | 666. OUTBOX GAP DETECTION

Monitor committed clinical changes whose expected outbox event is missing.

Transactional design should make this impossible; reconciliation verifies invariant.

---

# EXEC-0667 | ACTIVE | 667. CONSUMER OFFSET LOSS

Queue consumer restart/rebalance must not lose or duplicate effects beyond idempotent tolerance.

Test crash:
- before effect;
- after effect before ack;
- after ack.

---

# EXEC-0668 | ACTIVE | 668. EVENT VERSION RACE

Producer deploys new event schema before consumer compatibility.

Use expand-compatible rollout order and contract tests.

---

# EXEC-0669 | ACTIVE | 669. DEPLOYMENT ORDER

For schema/API changes:

```text
expand DB
→ deploy compatible readers
→ deploy writers
→ backfill
→ verify
→ remove old behavior later
→ contract DB
```

Never destructive migration before all running instances are compatible.

---

# EXEC-0670 | ACTIVE | 670. ROLLING DEPLOY MIXED VERSION

During rolling deploy, old and new app versions coexist.

All shared contracts must tolerate this window.

---

# EXEC-0671 | ACTIVE | 671. FEATURE FLAG + DEPLOY RACE

Do not enable new clinical feature before all required code/schema/artifacts are deployed and verified.

Activation has dependency preconditions.

---

# EXEC-0672 | ACTIVE | 672. MIGRATION LOCK / TIMEOUT

Large migrations must not unexpectedly lock hot clinical tables.

Measure on production-like scale.

Use online/expand patterns.

---

# EXEC-0673 | ACTIVE | 673. INDEX BUILD SAFETY

Large index creation uses nonblocking/concurrent strategy where supported and validated.

Monitor resource impact.

---

# EXEC-0674 | ACTIVE | 674. BACKFILL SAFETY

Backfills:
- chunked;
- resumable;
- idempotent;
- rate-limited;
- observable;
- dry-run where possible.

Never assume table size from development.

---

# EXEC-0675 | ACTIVE | 675. NULL BACKFILL TRANSITION

When making field required:
1. add nullable;
2. write new field;
3. backfill;
4. verify;
5. enforce constraint.

Do not deploy NOT NULL against dirty production data blindly.

---

# EXEC-0676 | ACTIVE | 676. ENUM MIGRATION SAFETY

Database/application enums can cause deployment ordering bugs.

Prefer strategies that allow forward compatibility.

Unknown values fail safely.

---

# EXEC-0677 | ACTIVE | 677. DEFAULT COLUMN CAUTION

Adding a default can silently assign false clinical meaning to historical rows.

Never use a semantic clinical default merely to satisfy migration.

---

# EXEC-0678 | ACTIVE | 678. DESTRUCTIVE MIGRATION BLOCKER

Dropping/renaming clinical data requires:
- impact analysis;
- backup;
- migration mapping;
- verification;
- rollback/recovery;
- approval.

---

# EXEC-0679 | ACTIVE | 679. MIGRATION ROW-COUNT RECONCILIATION

Before/after migration compare expected:
- counts;
- nulls;
- uniqueness;
- relationships;
- hashes/samples where appropriate.

---

# EXEC-0680 | ACTIVE | 680. LARGE TABLE TEST FIXTURE

CI small datasets cannot reveal production migration behavior.

Maintain production-scale synthetic benchmarks for critical tables.

---

# EXEC-0681 | ACTIVE | 681. N+1 QUERY DETECTION

Patient Workspace can accidentally create hundreds of queries as chart grows.

Use query tracing/performance tests.

Correctness without acceptable latency is not production readiness.

---

# EXEC-0682 | ACTIVE | 682. UNBOUNDED QUERY BLOCKER

Every list/history query has:
- limit;
- pagination/window;
- indexed access path.

No accidental “load entire lifetime chart” on page open.

---

# EXEC-0683 | ACTIVE | 683. QUERY PLAN REGRESSION

Track critical query plans/latency against realistic data after schema/index changes.

---

# EXEC-0684 | ACTIVE | 684. HOT PATIENT / HOT TENANT

One large institution or complex patient must not degrade all tenants.

Test skew, not only uniform load.

---

# EXEC-0685 | ACTIVE | 685. THUNDERING HERD

After cache expiry/restart, thousands of requests can hit DB/provider simultaneously.

Use jitter, request coalescing or controlled warmup where appropriate.

---

# EXEC-0686 | ACTIVE | 686. CACHE STAMPEDE SAFETY

Do not let expensive Patient State recomputation stampede.

But stale safety-critical state must not be served beyond policy merely to protect cache.

---

# EXEC-0687 | ACTIVE | 687. MEMORY LEAK SOAK TEST

Run long-lived worker/server soak tests.

Watch:
- heap;
- connection pools;
- file descriptors;
- queue consumers.

---

# EXEC-0688 | ACTIVE | 688. CONNECTION POOL EXHAUSTION

Serverless + Postgres can exhaust connections.

Use Neon/serverless-compatible pooling architecture and test concurrency.

Connection failure must degrade visibly.

---

# EXEC-0689 | ACTIVE | 689. TRANSACTION POOLING COMPATIBILITY

If transaction pooling is used, avoid assumptions requiring sticky session state unless supported.

Test RLS/session-variable strategy carefully.

---

# EXEC-0690 | ACTIVE | 690. RLS CONTEXT LEAK

If tenant/user context is set in DB session variables, pooled connections can leak context if not transaction-scoped/reset.

This is a release-blocking security bug class.

Prefer transaction-local context and explicit tests.

---

# EXEC-0691 | ACTIVE | 691. TRANSACTION ISOLATION TESTS

Select isolation level based on invariant.

Test write skew for:
- duplicate active obligation;
- duplicate patient identifier;
- concurrent sign;
- result closure.

---

# EXEC-0692 | ACTIVE | 692. DEADLOCK HANDLING

Deadlocks are expected under concurrency.

Retry only safe/idempotent transaction boundaries.

Expose persistent failure.

---

# EXEC-0693 | ACTIVE | 693. UNIQUE-CONSTRAINT AS CONCURRENCY CONTROL

Where uniqueness is an invariant, enforce in DB and handle conflict.

Do not rely on “check then insert” alone.

---

# EXEC-0694 | ACTIVE | 694. PATIENT MERGE RACE

Block/reconcile writes during critical merge phases.

Test concurrent:
- new result;
- new note;
- new medication;
- portal message.

---

# EXEC-0695 | ACTIVE | 695. MERGE ALIAS RESOLUTION

Old patient IDs may remain in external links/events.

Maintain controlled alias/redirection mapping.

Never silently point an ID to a different patient without provenance.

---

# EXEC-0696 | ACTIVE | 696. PATIENT SPLIT COMPLEXITY

Split after erroneous merge requires assigning each clinical object to correct identity.

Automated guesses are candidates; qualified review required for ambiguous records.

---

# EXEC-0697 | ACTIVE | 697. SEARCH INDEX LAG

Search index may lag source DB.

Exact identifier lookup for safety-critical patient selection should have authoritative fallback.

---

# EXEC-0698 | ACTIVE | 698. SEARCH INDEX DELETE/UPDATE

Merged/deactivated records must not remain misleadingly selectable due to stale index.

---

# EXEC-0699 | ACTIVE | 699. SEARCH RESULT IDENTITY DISPLAY

Show enough stable identity attributes to distinguish similar names while respecting privacy.

---

# EXEC-0700 | ACTIVE | 700. DUPLICATE NAME BUG

Never use name as identifier in code, URL, cache or analytics join.

---

# EXEC-0701 | ACTIVE | 701. UNICODE NORMALIZATION

Names/search/identifiers may differ by Unicode normalization.

Normalize for search carefully while preserving original representation.

Clinical codes remain governed by terminology rules.

---

# EXEC-0702 | ACTIVE | 702. PHONE NORMALIZATION

Patient search by phone needs country-aware canonicalization.

Do not merge identities solely on normalized phone.

---

# EXEC-0703 | ACTIVE | 703. EMAIL CASE / NORMALIZATION

Use standards-aware normalization; do not invent provider-specific transformations that can merge distinct addresses.

---

# EXEC-0704 | ACTIVE | 704. SOFT DELETE SEMANTICS

Clinical entities generally require lifecycle states, not generic soft-delete.

A `deleted_at` field alone is insufficient clinical semantics.

---

# EXEC-0705 | ACTIVE | 705. CASCADE DELETE AUDIT

ORM cascade configuration is reviewed.

No parent deletion should accidentally erase clinical history.

---

# EXEC-0706 | ACTIVE | 706. ORM GENERATED SQL REVIEW

High-risk queries/migrations require generated SQL inspection.

ORM abstraction does not remove DB semantics.

---

# EXEC-0707 | ACTIVE | 707. JSON FIELD VERSIONING

If JSON is used for flexible noncore content:
- schema version;
- validation;
- migration strategy.

No giant untyped clinical JSON blobs.

---

# EXEC-0708 | ACTIVE | 708. JSON NULL AMBIGUITY

Distinguish SQL NULL vs JSON null vs absent key where semantics matter.

---

# EXEC-0709 | ACTIVE | 709. NUMERIC DB TYPE

Do not store clinically sensitive decimals as floating types without explicit justification.

Use NUMERIC/DECIMAL or exact representation according to ADR.

---

# EXEC-0710 | ACTIVE | 710. MONEY VS CLINICAL QUANTITY

Do not reuse generic decimal/money helpers for clinical quantities if rounding semantics differ.

---

# EXEC-0711 | ACTIVE | 711. UNIT CONVERSION ROUNDTRIP TEST

For reversible conversions, test roundtrip within defined tolerance.

Never repeatedly convert stored canonical value back and forth causing drift.

---

# EXEC-0712 | ACTIVE | 712. ORIGINAL VALUE PRESERVATION

Preserve original external value/unit alongside normalized representation where clinically relevant.

---

# EXEC-0713 | ACTIVE | 713. LAB SCIENTIFIC NOTATION

Parsers must support legitimate scientific notation and reject malformed variants safely.

---

# EXEC-0714 | ACTIVE | 714. LESS-THAN / GREATER-THAN LAB VALUES

Lab values like `<5` or `>1000` are censored/bounded observations, not exact numeric 5/1000.

Model comparator semantics explicitly.

---

# EXEC-0715 | ACTIVE | 715. QUALITATIVE LAB RESULTS

Positive/negative/reactive/nonreactive/trace are not forced into arbitrary numbers.

---

# EXEC-0716 | ACTIVE | 716. LAB REFERENCE RANGE TEXT

Some ranges are categorical or context-specific.

Do not assume every range is numeric lower-upper.

---

# EXEC-0717 | ACTIVE | 717. LAB FLAG TRUST

External H/L flags are source metadata, not sole clinical truth.

Preserve them; deterministic normalization can independently evaluate where appropriate.

---

# EXEC-0718 | ACTIVE | 718. CORRECTED LAB DUPLICATION

A corrected result replaces authority prospectively but does not erase original.

Trend engine selects correct authoritative version.

---

# EXEC-0719 | ACTIVE | 719. PANEL PARTIAL ARRIVAL

Lab panel components can arrive at different times.

Do not mark entire panel final unless source semantics support it.

---

# EXEC-0720 | ACTIVE | 720. RESULT MATCHING TO ORDER

Matching by patient + test name alone is unsafe.

Use source identifiers/accession/order mapping and explicit reconciliation.

---

# EXEC-0721 | ACTIVE | 721. UNMATCHED RESULT WORKFLOW

Unmatched external result enters queue for reconciliation.

Do not discard or attach to “closest” order automatically.

---

# EXEC-0722 | ACTIVE | 722. WRONG-PATIENT EXTERNAL RESULT

If demographic/source identifiers conflict, quarantine/review rather than automatic attachment.

---

# EXEC-0723 | ACTIVE | 723. DUPLICATE ACCESSION ACROSS LABS

Accession IDs are namespaced by source/issuer.

---

# EXEC-0724 | ACTIVE | 724. CRITICAL VALUE REPEAT

Repeated identical critical values need policy:
- new alert;
- update existing;
- suppress duplicate;
depending on time/context/source.

Never deduplicate solely by value.

---

# EXEC-0725 | ACTIVE | 725. CRITICAL RESULT ACK RACE

Two clinicians acknowledge simultaneously.

State machine remains consistent; audit both attempts appropriately.

---

# EXEC-0726 | ACTIVE | 726. ACKNOWLEDGED VS ACTIONED

Acknowledgement does not imply action completed.

Keep separate states.

---

# EXEC-0727 | ACTIVE | 727. PATIENT INFORMED SEMANTICS

Message sent ≠ delivered ≠ patient acknowledged.

Workflow states distinguish them.

---

# EXEC-0728 | ACTIVE | 728. RESULT REOPEN AFTER CORRECTION

Correction after closure can reopen/create new review obligation according to policy.

---

# EXEC-0729 | ACTIVE | 729. OBLIGATION DUE-DATE RECALCULATION

If source plan changes, do not silently move due date without supersession/audit.

---

# EXEC-0730 | ACTIVE | 730. RECURRING OBLIGATION MODEL

Recurring monitoring creates distinct occurrences or explicit recurrence state.

Avoid one immortal obligation whose due date keeps moving.

---

# EXEC-0731 | ACTIVE | 731. SNOOZE SEMANTICS

Snoozing alert/obligation:
- does not close it;
- has expiry;
- reason where risk warrants;
- preserves original due date.

---

# EXEC-0732 | ACTIVE | 732. ESCALATION LOOP PREVENTION

Escalation cannot recursively create duplicate escalation obligations indefinitely.

---

# EXEC-0733 | ACTIVE | 733. STAFF DEACTIVATION

When clinician/staff owner leaves:
- active obligations/results are reassigned/escalated;
- access revoked;
- audit preserved.

No clinical work remains assigned to inactive account.

---

# EXEC-0734 | ACTIVE | 734. FACILITY CLOSURE / TRANSFER

Multi-facility architecture must handle obligations/results when location closes/transfers.

---

# EXEC-0735 | ACTIVE | 735. SCHEDULE OVERBOOK RACE

Appointment slot booking uses concurrency-safe reservation.

Two clients cannot claim same exclusive slot accidentally.

---

# EXEC-0736 | ACTIVE | 736. APPOINTMENT TIMEZONE

Store appointment instant + facility timezone semantics.

Patient display converts deliberately.

---

# EXEC-0737 | ACTIVE | 737. RECURRENCE DST

Recurring appointments preserve intended local wall-clock time where appropriate across DST.

---

# EXEC-0738 | ACTIVE | 738. CANCEL/RESCHEDULE RACE

Concurrent cancel/reschedule produces one valid terminal/current state with audit.

---

# EXEC-0739 | ACTIVE | 739. NO-SHOW VS CANCEL

Distinct operational/clinical semantics.

Do not collapse.

---

# EXEC-0740 | ACTIVE | 740. ENCOUNTER DUPLICATION

Double click/check-in retry must not create duplicate encounters.

---

# EXEC-0741 | ACTIVE | 741. ENCOUNTER REOPEN

Signed/closed encounter is not simply toggled back to draft.

Use addendum/amendment/new encounter according to clinical policy.

---

# EXEC-0742 | ACTIVE | 742. NOTE SIGN RACE

Two sign attempts:
- only one canonical signed version;
- duplicate request idempotent;
- conflicting content rejected.

---

# EXEC-0743 | ACTIVE | 743. SIGNATURE CONTEXT

Signature records:
- signer;
- timestamp;
- content hash/snapshot;
- role;
- version.

Authentication event alone is not the clinical signature record.

---

# EXEC-0744 | ACTIVE | 744. SIGNED NOTE DEPENDENCIES

If signed note references derived values, historical context/version remains reconstructable.

---

# EXEC-0745 | ACTIVE | 745. TEMPLATE UPDATE AFTER SIGNING

Historical note rendering does not silently change because template changed.

---

# EXEC-0746 | ACTIVE | 746. COPY-FORWARD BUGS

Copy-forward can perpetuate stale diagnoses/exam findings.

Copied structured/narrative content should preserve source/date and require review.

Do not auto-copy high-risk findings as current.

---

# EXEC-0747 | ACTIVE | 747. DEFAULT NORMAL EXAM PROHIBITION

Do not prepopulate “normal” physical exam findings as if observed.

Templates can present options, not false documentation.

---

# EXEC-0748 | ACTIVE | 748. NEGATIVE ROS DEFAULT PROHIBITION

Unasked symptoms cannot become negatives due to template defaults.

---

# EXEC-0749 | ACTIVE | 749. REQUIRED FIELD SAFETY

Required fields should reflect genuine clinical/legal need.

Do not force fabricated values just to close encounter.

Allow explicit unknown/unable where appropriate.

---

# EXEC-0750 | ACTIVE | 750. VALIDATION ERROR FOCUS

When form validation fails, UI identifies exact issue without losing entered data.

---

# EXEC-0751 | ACTIVE | 751. MEDICATION DUPLICATE SUBMISSION

Idempotency prevents duplicate medication order/prescription.

---

# EXEC-0752 | ACTIVE | 752. MEDICATION CONCENTRATION VERSION

Drug formulation/concentration can change.

Prescription records exact product/formulation data used.

---

# EXEC-0753 | ACTIVE | 753. MEDICATION DECIMAL ENTRY

UI prevents locale/decimal ambiguity and displays units adjacent to input.

---

# EXEC-0754 | ACTIVE | 754. DOSE UNIT DIMENSION CHECK

Distinguish:
- mg;
- mg/kg;
- mg/kg/day;
- mg/m²;
- mL;
- units.

These are different dimensions, not strings.

---

# EXEC-0755 | ACTIVE | 755. PER-DAY DIVISION

If total daily dose is divided into N doses:
- deterministic division;
- max per dose;
- feasible administration;
- rounding after appropriate stage.

---

# EXEC-0756 | ACTIVE | 756. ROUNDING ORDER

Define whether rounding occurs:
- after total dose;
- after per-dose calculation;
- after concentration conversion.

Incorrect order can materially change dose.

---

# EXEC-0757 | ACTIVE | 757. MAX DOSE ORDER

Apply maximum constraints at correct semantic stage.

Per-dose maximum ≠ daily maximum.

---

# EXEC-0758 | ACTIVE | 758. WEIGHT UNIT ENTRY DEFENSE

Weight entry supports kg/lb only with explicit conversion/display.

A 22 lb child must not become 22 kg silently.

---

# EXEC-0759 | ACTIVE | 759. HEIGHT UNIT ENTRY DEFENSE

cm/m/inches conversion explicit.

---

# EXEC-0760 | ACTIVE | 760. STALE PEDIATRIC WEIGHT

Risk policy defines freshness threshold/context.

High-risk dose may require current confirmed weight.

---

# EXEC-0761 | ACTIVE | 761. WEIGHT CHANGE PLAUSIBILITY

Large rapid weight change triggers confirmation rather than automatic rejection.

---

# EXEC-0762 | ACTIVE | 762. BSA UNIT BUG TESTS

Height/weight unit combinations tested against reference cases.

---

# EXEC-0763 | ACTIVE | 763. RENAL FUNCTION FORMULA SELECTION

Different drug/guideline contexts may require different renal metric.

Do not globally substitute eGFR for CrCl or vice versa.

Formula selection is explicit/versioned.

---

# EXEC-0764 | ACTIVE | 764. LAB UNIT FOR RENAL INPUT

Creatinine unit conversion is explicit and tested.

---

# EXEC-0765 | ACTIVE | 765. AGE/SEX CONTEXT FORMULA CHANGES

Formula inputs/applicability follow source/version; no hidden assumptions.

---

# EXEC-0766 | ACTIVE | 766. DRUG KNOWLEDGE DATASET OUTAGE

Medication workflow shows affected safety checks unavailable.

Do not imply “no interactions” when database failed.

---

# EXEC-0767 | ACTIVE | 767. EMPTY INTERACTION RESPONSE

Distinguish:
- checked, none found;
- check unavailable;
- unsupported drug;
- incomplete medication list.

---

# EXEC-0768 | ACTIVE | 768. ALLERGY UNKNOWN VS NONE

Never display “No allergies” when status is unknown/not assessed.

---

# EXEC-0769 | ACTIVE | 769. ALLERGY DUPLICATE RECONCILIATION

Same substance with different reactions/statuses requires reconciliation, not blind dedup.

---

# EXEC-0770 | ACTIVE | 770. ALLERGY INACTIVATION

“Inactive/entered in error” is not deletion.

Historical prescriptions retain context.

---

# EXEC-0771 | ACTIVE | 771. MEDICATION DISCONTINUATION RACE

New prescription/reconciliation and discontinuation concurrently require version conflict handling.

---

# EXEC-0772 | ACTIVE | 772. MEDICATION START DATE FUTURE

Future planned medication is not active now.

Lifecycle/state calculation respects dates.

---

# EXEC-0773 | ACTIVE | 773. MEDICATION END DATE

Expired course should not remain active indefinitely because status update job failed; reconciliation catches it.

---

# EXEC-0774 | ACTIVE | 774. PRN SEMANTICS

PRN medication frequency/max use represented structurally where safety logic needs it.

---

# EXEC-0775 | ACTIVE | 775. TAPER / VARIABLE DOSE

Do not force complex taper into one scalar dose.

Use structured regimen segments where supported.

---

# EXEC-0776 | ACTIVE | 776. ORDER SET VERSIONING

If order sets are introduced, exact set version is recorded.

Applying set creates individual orders; later set update does not mutate them.

---

# EXEC-0777 | ACTIVE | 777. ORDER CANCELLATION AFTER RESULT

Cancellation semantics after result received differ from pre-performance cancellation.

State machine enforces valid transition.

---

# EXEC-0778 | ACTIVE | 778. DUPLICATE ORDER DETECTION

Duplicate detection is advisory/contextual; repeated test can be clinically intentional.

No automatic cancellation.

---

# EXEC-0779 | ACTIVE | 779. ORDER STATUS SOURCE CONFLICT

External lab status and internal workflow can disagree.

Represent source/status and reconcile explicitly.

---

# EXEC-0780 | ACTIVE | 780. DOCUMENT WRONG-PATIENT DEFENSE

Before document becomes part of chart, validate patient association.

AI-extracted name is not sufficient identity proof.

---

# EXEC-0781 | ACTIVE | 781. DOCUMENT DUPLICATE HASH

Same binary hash can help detect duplicate upload but does not prove same clinical context/patient.

---

# EXEC-0782 | ACTIVE | 782. PDF ACTIVE CONTENT

Sanitize/isolate PDFs and never trust embedded scripts/links.

---

# EXEC-0783 | ACTIVE | 783. OCR DECIMAL ERROR

Test `1.0`→`10`, `0.5`→`05`, `6`→`8`, etc.

High-risk extracted numeric data remains unverified until policy threshold/human verification.

---

# EXEC-0784 | ACTIVE | 784. OCR UNIT ERROR

`mg`/`mcg`, `mmol/L`, superscripts and special characters require targeted tests.

---

# EXEC-0785 | ACTIVE | 785. PAGE ROTATION / CROP

Document extraction tests rotated, scanned, cropped and multi-column reports.

---

# EXEC-0786 | ACTIVE | 786. MULTI-PATIENT PDF

A PDF can contain more than one patient/document.

Do not assume one upload = one patient artifact.

Detect/quarantine ambiguous cases.

---

# EXEC-0787 | ACTIVE | 787. PASSWORD-PROTECTED FILE

Handle explicitly; do not mark extraction complete with empty content.

---

# EXEC-0788 | ACTIVE | 788. ZERO-BYTE / TRUNCATED FILE

Upload success requires integrity validation, not HTTP completion alone.

---

# EXEC-0789 | ACTIVE | 789. OBJECT STORAGE WRITE/DB COMMIT SPLIT

Design compensation for:
- object uploaded, DB failed;
- DB row created, upload failed.

No orphan sensitive files indefinitely.

---

# EXEC-0790 | ACTIVE | 790. OBJECT DELETE / RETENTION RACE

Retention job cannot delete object still referenced by active/legal-hold record.

---

# EXEC-0791 | ACTIVE | 791. PRESIGNED URL EXPIRY

Patient/clinician download links:
- short-lived;
- scoped;
- authorization checked before issuance.

Do not persist long-lived public URLs.

---

# EXEC-0792 | ACTIVE | 792. SHARE LINK TOKEN ENTROPY

Patient Link tokens are cryptographically strong, scoped, expiring and revocable.

---

# EXEC-0793 | ACTIVE | 793. SHARE LINK REPLAY

Define whether repeated access is allowed.

Sensitive one-time workflows can use OTP/additional verification.

---

# EXEC-0794 | ACTIVE | 794. SHARE LINK WRONG RECIPIENT

Sending to wrong email/phone is a privacy incident class.

Preview destination and provide revocation.

---

# EXEC-0795 | ACTIVE | 795. COMMUNICATION RETRY DUPLICATION

Provider timeout after accepting message can lead to duplicate resend.

Use provider message IDs/idempotency where available and reconcile ambiguous status.

---

# EXEC-0796 | ACTIVE | 796. WEBHOOK AUTHENTICATION

Verify signatures/secrets/timestamps according to provider.

Reject replay where supported.

---

# EXEC-0797 | ACTIVE | 797. WEBHOOK ORDERING

Do not assume delivery status webhooks arrive in order.

Use state transition rules.

---

# EXEC-0798 | ACTIVE | 798. WEBHOOK SECRET ROTATION

Support overlapping old/new secret during controlled rotation if provider requires.

---

# EXEC-0799 | ACTIVE | 799. EMAIL BOUNCE / PHONE REASSIGNMENT

Contact channels can become invalid/reassigned.

Do not treat previous delivery as permanent identity verification.

---

# EXEC-0800 | ACTIVE | 800. OTP BRUTE FORCE

Rate-limit, expire, scope and invalidate OTPs appropriately.

---

# EXEC-0801 | ACTIVE | 801. PATIENT PORTAL ACCOUNT LINKING

Portal identity linking to patient chart is high-risk.

Require robust verification and auditable linking.

---

# EXEC-0802 | ACTIVE | 802. PORTAL DEPENDENT / GUARDIAN ACCESS

Related-person access has:
- relationship;
- scope;
- effective dates;
- age/legal transitions;
- revocation.

Do not model as simple shared password.

---

# EXEC-0803 | ACTIVE | 803. MINOR AGE TRANSITION

When minor reaches relevant age/legal threshold, guardian/patient access policies may change.

Country Pack/governance handles jurisdiction-specific rule.

---

# EXEC-0804 | ACTIVE | 804. PORTAL RESULT RELEASE POLICY

Not every result must be released identically.

Policy is versioned and jurisdiction/facility aware.

Do not hardcode delay/release globally.

---

# EXEC-0805 | ACTIVE | 805. PORTAL AI EXPLANATION GATE

Patient-facing AI explanation only uses approved result/context and must not replace clinician communication for critical workflows.

---

# EXEC-0806 | ACTIVE | 806. NOTIFICATION PREFERENCE VS SAFETY

Patient/user preferences can suppress optional messages, not mandatory safety communication where policy requires.

---

# EXEC-0807 | ACTIVE | 807. NOTIFICATION TIMEZONE

Scheduled reminders respect recipient/facility timezone policy.

---

# EXEC-0808 | ACTIVE | 808. QUIET HOURS

Quiet-hour logic must not delay critical communication when policy overrides it.

---

# EXEC-0809 | ACTIVE | 809. TEMPLATE VARIABLE FAILURE

Missing variable must not send malformed medical message/prescription.

Render validation blocks send.

---

# EXEC-0810 | ACTIVE | 810. HTML EMAIL ESCAPING

Escape user/clinical content to prevent injection.

---

# EXEC-0811 | ACTIVE | 811. SMS LENGTH / SEGMENTATION

Do not truncate critical instructions silently.

---

# EXEC-0812 | ACTIVE | 812. WHATSAPP/PROVIDER TEMPLATE VERSION

External approved templates can change/status expire.

Adapter exposes availability/version; send failures are explicit.

---

# EXEC-0813 | ACTIVE | 813. PAYMENT WEBHOOK ISOLATION

Billing events cannot directly mutate clinical truth.

---

# EXEC-0814 | ACTIVE | 814. BILLING DUPLICATE EVENT

Idempotent processing.

---

# EXEC-0815 | ACTIVE | 815. REFUND / VOID AUDIT

Financial lifecycle separate from clinical encounter lifecycle.

---

# EXEC-0816 | ACTIVE | 816. INVENTORY RACE

If medication/supply inventory is introduced, concurrent decrements require DB-safe accounting.

Clinical documentation must not disappear because inventory update failed.

---

# EXEC-0817 | ACTIVE | 817. ANALYTICS EVENT PHI REVIEW

Analytics schema is allowlisted.

No free-form note content.

---

# EXEC-0818 | ACTIVE | 818. ANALYTICS DUPLICATE EVENT

Analytics tolerates duplicates or deduplicates separately; it is never clinical source of truth.

---

# EXEC-0819 | ACTIVE | 819. METRIC CARDINALITY EXPLOSION

Never use patient IDs, request IDs or arbitrary error text as high-cardinality metric labels.

---

# EXEC-0820 | ACTIVE | 820. TRACE SAMPLING

Critical errors/security/safety signals should not be lost solely due to random trace sampling.

Use targeted error capture without PHI leakage.

---

# EXEC-0821 | ACTIVE | 821. LOG REDACTION TESTS

Automated tests attempt to log representative PHI/secrets and verify redaction/absence.

---

# EXEC-0822 | ACTIVE | 822. ERROR REPORTING SDK SCRUBBING

Configure third-party error SDKs to avoid request bodies/headers/DOM snapshots containing PHI unless explicitly approved.

---

# EXEC-0823 | ACTIVE | 823. SESSION REPLAY PROHIBITION DEFAULT

Do not enable generic third-party session replay on clinical screens by default.

If ever used, requires specialized privacy/security design.

---

# EXEC-0824 | ACTIVE | 824. SUPPORT SCREENSHARE POLICY

Operational policy must account for PHI exposure during support.

---

# EXEC-0825 | ACTIVE | 825. BACKUP ENCRYPTION

Backups encrypted and access-controlled.

Restore credentials separated.

---

# EXEC-0826 | ACTIVE | 826. BACKUP RESTORE IDENTITY

Restored environment must not accidentally send real emails/SMS/webhooks.

Nonproduction restores disable external side effects and rotate secrets.

---

# EXEC-0827 | ACTIVE | 827. PRODUCTION CLONE SAFETY

Never create developer-accessible production clone with real PHI as routine debugging mechanism.

---

# EXEC-0828 | ACTIVE | 828. STAGING SIDE-EFFECT FIREWALL

Staging adapters default to sandbox/sink endpoints.

No accidental patient communication.

---

# EXEC-0829 | ACTIVE | 829. ENVIRONMENT BANNER

Internal nonproduction environments are visually distinct to reduce operator confusion.

Do not rely only on URL.

---

# EXEC-0830 | ACTIVE | 830. PRODUCTION CONFIRMATION FOR DANGEROUS OPS

Administrative bulk/destructive operations require explicit production context confirmation and authorization.

---

# EXEC-0831 | ACTIVE | 831. ADMIN TOOL AUDIT

Admin/support scripts are production software.

Version, review, audit and test them.

---

# EXEC-0832 | ACTIVE | 832. ONE-OFF SQL PROHIBITION FOR CLINICAL MUTATION

Avoid manual production SQL to “fix” clinical records.

Use controlled repair tooling with domain invariants/audit.

Emergency exception requires incident record and reconciliation.

---

# EXEC-0833 | ACTIVE | 833. DATA REPAIR TOOL

Build repair commands that:
- preview;
- validate;
- mutate through governed path;
- audit;
- produce before/after evidence.

---

# EXEC-0834 | ACTIVE | 834. OPERATOR FAT-FINGER DEFENSE

Bulk operations show scope/count/sample before execution.

---

# EXEC-0835 | ACTIVE | 835. BULK SELECT BUG

Never default “select all across all tenants/patients” from ambiguous UI.

Scope is explicit.

---

# EXEC-0836 | ACTIVE | 836. CSV IMPORT FORMULA INJECTION

Escape dangerous spreadsheet formula prefixes on exported CSV where applicable.

Imported CSV cells are untrusted text.

---

# EXEC-0837 | ACTIVE | 837. CSV LOCALE PARSING

Explicit delimiter/decimal/date format.

Preview before clinical import.

---

# EXEC-0838 | ACTIVE | 838. CSV COLUMN SHIFT

Header/schema mapping validation prevents one-column displacement from becoming clinical data.

---

# EXEC-0839 | ACTIVE | 839. API MASS ASSIGNMENT

DTO/schema allowlists fields.

Never spread arbitrary request body into ORM clinical object.

---

# EXEC-0840 | ACTIVE | 840. PATCH SEMANTICS

Distinguish absent field from explicit null/clear.

Clinical PATCH operations require field-specific rules.

---

# EXEC-0841 | ACTIVE | 841. OVERPOSTING AUTHORIZATION

User authorized to edit one field may not be authorized for all fields on same object.

Field/action authorization where needed.

---

# EXEC-0842 | ACTIVE | 842. SERIALIZATION OF BIG NUMBERS

IDs/precise numerics must not lose precision through JSON/JS number representation.

Use strings where necessary.

---

# EXEC-0843 | ACTIVE | 843. PROTOTYPE POLLUTION / OBJECT MERGE

Avoid unsafe deep merge of untrusted JSON.

Schema-parse into known structures.

---

# EXEC-0844 | ACTIVE | 844. REGEX DOS

User/imported text processed by regex must avoid catastrophic backtracking.

---

# EXEC-0845 | ACTIVE | 845. ZIP/ARCHIVE PATH TRAVERSAL

If archives are ever ingested, sanitize paths and extract in sandbox.

---

# EXEC-0846 | ACTIVE | 846. SSRF DEFENSE

Document/import URL fetchers and AI tools cannot fetch arbitrary internal URLs.

Allowlist/proxy and block private metadata networks.

---

# EXEC-0847 | ACTIVE | 847. REDIRECT VALIDATION

Outbound fetch follows redirects only under safe policy.

---

# EXEC-0848 | ACTIVE | 848. DNS REBINDING DEFENSE

Relevant URL-fetching infrastructure resolves/validates destination safely.

---

# EXEC-0849 | ACTIVE | 849. FILE NAME SANITIZATION

Display original safely; storage key is generated, not raw filename path.

---

# EXEC-0850 | ACTIVE | 850. CONTENT DISPOSITION

Downloads use safe Content-Disposition and content type.

---

# EXEC-0851 | ACTIVE | 851. CSP REGRESSION TEST

Security headers are integration-tested.

---

# EXEC-0852 | ACTIVE | 852. CSRF FOR COOKIE AUTH

Mutating browser requests protected appropriately.

SameSite alone is not assumed sufficient for every architecture.

---

# EXEC-0853 | ACTIVE | 853. CORS DENY DEFAULT

Only required origins/methods/headers.

No wildcard credentials.

---

# EXEC-0854 | ACTIVE | 854. OPEN REDIRECT

Login/share-link redirect destinations are allowlisted.

---

# EXEC-0855 | ACTIVE | 855. SESSION FIXATION

Authentication rotates session identifiers.

---

# EXEC-0856 | ACTIVE | 856. MFA RECOVERY

Recovery flow must not become weaker bypass of MFA.

---

# EXEC-0857 | ACTIVE | 857. PASSWORD RESET TOKEN

Single-use, expiring, scoped.

---

# EXEC-0858 | ACTIVE | 858. MAGIC LINK REPLAY

Authentication magic links follow similar controls.

---

# EXEC-0859 | ACTIVE | 859. OAUTH ACCOUNT CONFUSION

External identity linking requires verified stable issuer+subject, not email alone.

---

# EXEC-0860 | ACTIVE | 860. SERVICE ACCOUNT ROTATION

Machine credentials have owner, expiry/rotation and least privilege.

---

# EXEC-0861 | ACTIVE | 861. JWT VALIDATION

Validate issuer, audience, signature, expiry, not-before and algorithm.

Do not trust decoded claims before verification.

---

# EXEC-0862 | ACTIVE | 862. JWT ROLE STALENESS

Long-lived role claims can remain after revocation.

Use short lifetimes/current server authorization for high-risk operations.

---

# EXEC-0863 | ACTIVE | 863. IDOR TEST SUITE

Automated tests mutate IDs across:
- patient;
- encounter;
- result;
- document;
- prescription;
- obligation;
- tenant.

Every endpoint verifies ownership/authorization.

---

# EXEC-0864 | ACTIVE | 864. GRAPHQL/GENERIC QUERY BOUNDARY

If introduced, generic query layers must not bypass domain authorization or expose unrestricted clinical graph traversal.

---

# EXEC-0865 | ACTIVE | 865. BATCH API AUTHORIZATION

Authorize each resource or safe set predicate, not only batch endpoint itself.

---

# EXEC-0866 | ACTIVE | 866. EXPORT AUTHORIZATION SNAPSHOT

Long-running export revalidates/records authorization context and scope.

Permission revocation behavior is defined.

---

# EXEC-0867 | ACTIVE | 867. BACKGROUND JOB TENANT FILTER

Every tenant-scoped job requires explicit tenant context.

“No tenant means all tenants” is prohibited default.

---

# EXEC-0868 | ACTIVE | 868. CRON OVERLAP

Recurring jobs can overlap if prior run is slow.

Use lease/idempotency/checkpoint semantics.

---

# EXEC-0869 | ACTIVE | 869. CRON MISFIRE

After downtime, define whether missed jobs:
- catch up;
- skip;
- coalesce.

Critical follow-up cannot silently skip.

---

# EXEC-0870 | ACTIVE | 870. SCHEDULER DUPLICATION

Two scheduler instances must not create duplicate obligations/tasks.

---

# EXEC-0871 | ACTIVE | 871. LEADER ELECTION FAILURE

If leader election is used, split-brain behavior is tested.

Prefer idempotent work over fragile singleton assumptions.

---

# EXEC-0872 | ACTIVE | 872. PARTIAL NETWORK PARTITION

A worker may reach DB but not provider, or vice versa.

State reflects uncertainty; retry/reconciliation handles it.

---

# EXEC-0873 | ACTIVE | 873. AMBIGUOUS EXTERNAL SUCCESS

Timeout after POST may mean provider accepted request.

Do not blindly retry non-idempotent external action without reconciliation.

---

# EXEC-0874 | ACTIVE | 874. CIRCUIT BREAKER SEMANTICS

Circuit breakers prevent cascade but must expose unavailable safety checks.

Do not turn dependency outage into false negative.

---

# EXEC-0875 | ACTIVE | 875. BULKHEADS

Isolate:
- AI;
- document processing;
- analytics;
- bulk jobs;
from interactive clinical core.

---

# EXEC-0876 | ACTIVE | 876. TIMEOUT BUDGET PROPAGATION

Nested services respect overall request deadline.

Avoid each layer independently waiting full timeout.

---

# EXEC-0877 | ACTIVE | 877. CANCELLATION PROPAGATION

Cancelled client request may stop unnecessary work, but already committed clinical mutation is not rolled back implicitly.

---

# EXEC-0878 | ACTIVE | 878. ORPHAN ASYNC WORK

Track jobs whose initiating object was cancelled/deleted/superseded.

Worker rechecks current state before side effect.

---

# EXEC-0879 | ACTIVE | 879. EXTERNAL RATE LIMIT

Adapters honor provider limits with backoff/jitter and queue-age monitoring.

---

# EXEC-0880 | ACTIVE | 880. RETRY STORM

Dependency recovery can trigger synchronized retries.

Use jitter/backpressure.

---

# EXEC-0881 | ACTIVE | 881. FALLBACK DATA STALENESS

If cached external reference data are allowed during outage, display/record version/freshness and enforce maximum staleness.

---

# EXEC-0882 | ACTIVE | 882. TERMINOLOGY SERVICE PARTIAL FAILURE

Failure to resolve one concept must not silently map to “unknown” concept that changes clinical logic.

---

# EXEC-0883 | ACTIVE | 883. TERMINOLOGY CACHE VERSION

Cache key includes terminology release/mapping version.

---

# EXEC-0884 | ACTIVE | 884. TERMINOLOGY RETIRED CODE

Historical code remains interpretable; new entry uses current mapping policy.

---

# EXEC-0885 | ACTIVE | 885. TERMINOLOGY SYNONYM COLLISION

One synonym can map to multiple concepts.

Require disambiguation where clinically relevant.

---

# EXEC-0886 | ACTIVE | 886. KNOWLEDGE RULE CLOCK

Knowledge effective dates use explicit timezone/date semantics.

---

# EXEC-0887 | ACTIVE | 887. KNOWLEDGE HOT RELOAD

If runtime hot-reloads artifacts:
- atomic switch;
- no half-loaded dependency set;
- version visible per request.

---

# EXEC-0888 | ACTIVE | 888. ARTIFACT SET ATOMICITY

A Clinical BOM activation is atomic from runtime perspective.

Do not mix half old/half new interdependent artifacts.

---

# EXEC-0889 | ACTIVE | 889. ARTIFACT DOWNLOAD FAILURE

Runtime continues last approved complete set or explicit unavailable state according to policy.

Never execute partially downloaded content.

---

# EXEC-0890 | ACTIVE | 890. ARTIFACT HASH MISMATCH

Hard fail load; alert security/operations.

---

# EXEC-0891 | ACTIVE | 891. ARTIFACT REGISTRY SPLIT BRAIN

If multiple registry replicas disagree, define authoritative consistency model.

High-risk runtime must not randomly select versions.

---

# EXEC-0892 | ACTIVE | 892. KNOWLEDGE COMPILER NONDETERMINISM

Same source IR + compiler version should produce same artifact where deterministic build expected.

Test it.

---

# EXEC-0893 | ACTIVE | 893. KNOWLEDGE RULE PRIORITY TIE

Equal-priority incompatible rules require explicit resolution, not iteration-order winner.

---

# EXEC-0894 | ACTIVE | 894. MAP/OBJECT ITERATION ORDER

Clinical output cannot depend on incidental hash/map iteration order.

Sort deterministically where order matters.

---

# EXEC-0895 | ACTIVE | 895. RANDOMNESS

Clinical deterministic computation uses no uncontrolled randomness.

Probabilistic components record seed/config where meaningful for evaluation.

---

# EXEC-0896 | ACTIVE | 896. AI STREAMING PARTIAL OUTPUT

Do not persist/display incomplete streamed structured clinical output as final.

Buffer/validate before committing candidate artifact.

---

# EXEC-0897 | ACTIVE | 897. AI STREAM INTERRUPTION

Interrupted generation yields explicit incomplete state.

---

# EXEC-0898 | ACTIVE | 898. AI JSON REPAIR

Automatic JSON repair may alter meaning.

For high-risk structured output, reject malformed result rather than silently “repair” clinical values.

---

# EXEC-0899 | ACTIVE | 899. AI TOOL RETRY

A model retry must not duplicate a tool side effect.

Tool layer idempotency remains authoritative.

---

# EXEC-0900 | ACTIVE | 900. AI CONTEXT PATIENT BINDING

Every AI task context is server-built and patient-bound.

Client cannot inject another patient ID into context builder.

---

# EXEC-0901 | ACTIVE | 901. AI SYSTEM PROMPT SECRECY NON-ASSUMPTION

Security must not depend on system prompt remaining secret.

---

# EXEC-0902 | ACTIVE | 902. AI MODEL OUTPUT ENCODING

Escape/sanitize model-generated markdown/HTML before rendering.

---

# EXEC-0903 | ACTIVE | 903. AI CITATION SPAN DRIFT

If source document version changes, old AI citation remains bound to old version, not silently re-pointed.

---

# EXEC-0904 | ACTIVE | 904. AI SUMMARY STALE BADGE

Accepted/generated summaries carry freshness/version and can become stale after material chart changes.

---

# EXEC-0905 | ACTIVE | 905. AI TASK CANCELLATION

Navigating away/patient switch cancels or isolates AI response so it cannot appear under wrong patient.

---

# EXEC-0906 | ACTIVE | 906. AI CROSS-REQUEST CONTAMINATION

No shared mutable prompt/context object across concurrent users.

---

# EXEC-0907 | ACTIVE | 907. VECTOR INDEX TENANT ISOLATION

If vector search is used:
- tenant filters enforced server-side;
- test cross-tenant retrieval;
- namespace/index strategy documented.

Metadata filter alone must be verified, not assumed.

---

# EXEC-0908 | ACTIVE | 908. EMBEDDING VERSION

Embedding model/version changes can alter retrieval.

Index version and rebuild strategy explicit.

---

# EXEC-0909 | ACTIVE | 909. VECTOR STALE DOCUMENT

Corrected/deleted/superseded document must be removed/invalidated in retrieval index.

---

# EXEC-0910 | ACTIVE | 910. RETRIEVAL DUPLICATE CHUNKS

Duplicate chunks should not falsely amplify evidence.

Deduplicate by source/version/span.

---

# EXEC-0911 | ACTIVE | 911. RETRIEVAL RECENCY BIAS

Newest is not automatically most authoritative.

Ranking incorporates approved source semantics.

---

# EXEC-0912 | ACTIVE | 912. RETRIEVAL AUTHORITY BIAS

High semantic similarity does not outrank source authority/applicability automatically.

---

# EXEC-0913 | ACTIVE | 913. RETRIEVAL EMPTY RESULT

AI must know retrieval failed.

Do not answer from model memory as if approved knowledge was found.

---

# EXEC-0914 | ACTIVE | 914. RETRIEVAL PARTIAL OUTAGE

Explicitly mark incomplete knowledge context where relevant.

---

# EXEC-0915 | ACTIVE | 915. KNOWLEDGE QUERY INJECTION

User free text cannot alter structured filters/authorization through query syntax injection.

---

# EXEC-0916 | ACTIVE | 916. SQL INJECTION

Parameterized queries only; dynamic identifiers allowlisted.

---

# EXEC-0917 | ACTIVE | 917. SEARCH QUERY DOS

Bound fuzzy/regex/full-text query complexity.

---

# EXEC-0918 | ACTIVE | 918. PATIENT STATE REBUILD

Full rebuild is deterministic/idempotent and produces comparison report against current projection.

---

# EXEC-0919 | ACTIVE | 919. PATIENT STATE REBUILD DURING WRITES

Use snapshot/version strategy so rebuild does not lose concurrent events.

---

# EXEC-0920 | ACTIVE | 920. PROJECTOR DUPLICATE EVENT

Projectors idempotent.

---

# EXEC-0921 | ACTIVE | 921. PROJECTOR EVENT GAP

Detect missing sequence/event where sequencing model supports it.

---

# EXEC-0922 | ACTIVE | 922. PROJECTOR VERSION UPGRADE

New projector can rebuild into shadow projection and compare before cutover.

---

# EXEC-0923 | ACTIVE | 923. READ-MODEL CUTOVER

Atomic switch after reconciliation.

---

# EXEC-0924 | ACTIVE | 924. CLINICAL GRAPH REBUILD

Graph edges rebuilt from authoritative sources without losing explicit clinician-authored relationships.

---

# EXEC-0925 | ACTIVE | 925. CARE GAP DUPLICATION

Multiple evidence sources for same completed care item should close one gap, not create contradictory duplicates.

---

# EXEC-0926 | ACTIVE | 926. CARE GAP FALSE CLOSURE

A test ordered is not a test completed; a result exists is not necessarily reviewed.

Closure criterion is explicit.

---

# EXEC-0927 | ACTIVE | 927. PREVENTIVE RULE AGE TRANSITION

Care gaps recalculate when patient crosses age/applicability boundary.

---

# EXEC-0928 | ACTIVE | 928. CHRONIC DISEASE SPACE STALE STATE

Disease workspace is derived; current source facts override stale projection after reconciliation.

---

# EXEC-0929 | ACTIVE | 929. CONDITION STATUS TRANSITION

Problem statuses have valid state machine.

Resolved condition can be reactivated explicitly.

---

# EXEC-0930 | ACTIVE | 930. DIAGNOSIS VS PROBLEM

Encounter diagnosis and longitudinal problem are related but not automatically identical objects.

---

# EXEC-0931 | ACTIVE | 931. HYPOTHESIS PROMOTION

Possible/rule-out hypothesis does not become confirmed problem automatically due to repeated mention.

---

# EXEC-0932 | ACTIVE | 932. NLP NEGATION TO PROBLEM

“no diabetes” must never create diabetes problem.

---

# EXEC-0933 | ACTIVE | 933. FAMILY HISTORY EXPERIENCER

Family condition never becomes patient condition.

---

# EXEC-0934 | ACTIVE | 934. HISTORICAL CONDITION

Past resolved disease remains historical, not active.

---

# EXEC-0935 | ACTIVE | 935. DUPLICATE PROBLEM RECONCILIATION

Same canonical concept can have distinct episodes/context.

Dedup requires clinical semantics, not code equality alone.

---

# EXEC-0936 | ACTIVE | 936. PROBLEM-MEDICATION LINK

Medication indication link can be unknown/multiple.

Do not fabricate one-to-one mapping.

---

# EXEC-0937 | ACTIVE | 937. ORDER-RESULT LINK MANY-TO-MANY

One order can yield multiple results; external result can correspond to panel/order structures.

Model relationships flexibly.

---

# EXEC-0938 | ACTIVE | 938. DOCUMENT-RESULT LINK

Original report and structured result remain linked but distinct.

---

# EXEC-0939 | ACTIVE | 939. SOURCE DELETE AFTER DERIVATION

If external/source artifact is withdrawn/entered in error, derived facts are invalidated according to provenance graph.

---

# EXEC-0940 | ACTIVE | 940. PROVENANCE CASCADE IS NOT DELETE CASCADE

Invalidation propagates status/recompute, not destructive erasure.

---

# EXEC-0941 | ACTIVE | 941. EVIDENCE GRAPH CYCLE

Evidence provenance graph should be acyclic for derivation lineage.

Detect accidental cycles.

---

# EXEC-0942 | ACTIVE | 942. EXPLANATION GRAPH SIZE

Bound explanation graph size for pathological inputs; allow drill-down rather than giant payload.

---

# EXEC-0943 | ACTIVE | 943. EXPLANATION VERSION

Explanation corresponds exactly to computation version.

---

# EXEC-0944 | ACTIVE | 944. EXPLANATION LOCALIZATION

Translation does not alter numbers, units, thresholds or source identity.

---

# EXEC-0945 | ACTIVE | 945. ROUNDING DISPLAY MISMATCH

Displayed rounded value and classification must derive consistently.

Example: do not display `5.0` while classify based on hidden `5.049` without explanation if threshold makes display misleading.

---

# EXEC-0946 | ACTIVE | 946. BOUNDARY DISPLAY PRECISION

Show sufficient precision near clinical thresholds to avoid apparent contradiction.

---

# EXEC-0947 | ACTIVE | 947. UNIT DISPLAY MISMATCH

Label must come from same structured quantity as displayed value.

No separately hardcoded unit label.

---

# EXEC-0948 | ACTIVE | 948. COPY NUMBER WITHOUT UNIT

Copy actions for clinical quantities should generally include unit/context.

---

# EXEC-0949 | ACTIVE | 949. TABLE COLUMN MISALIGNMENT

Responsive/virtualized tables must not visually associate value with wrong patient/analyte.

E2E visual/semantic tests for critical tables.

---

# EXEC-0950 | ACTIVE | 950. VIRTUALIZATION BUGS

Row virtualization can reuse DOM and show stale cells if keys unstable.

Use stable IDs and test scrolling rapidly.

---

# EXEC-0951 | ACTIVE | 951. REACT KEY LAW

Never use array index as key for mutable clinical lists where row identity matters.

---

# EXEC-0952 | ACTIVE | 952. FORM FIELD NAME COLLISION

Dynamic forms use stable question IDs, not display labels.

Two questions can share label.

---

# EXEC-0953 | ACTIVE | 953. ADAPTIVE FORM HIDDEN VALUE

When conditional question becomes hidden:
- define whether prior answer remains valid;
- is marked inactive;
- is cleared only through explicit semantics.

Do not silently submit stale hidden values.

---

# EXEC-0954 | ACTIVE | 954. QUESTION VERSIONING

Clinical question definition changes do not reinterpret historical answer.

Answer references question version.

---

# EXEC-0955 | ACTIVE | 955. OPTION VALUE STABILITY

Select option IDs are stable canonical values; display labels can change.

---

# EXEC-0956 | ACTIVE | 956. MULTISELECT DUPLICATE

Normalize duplicates and preserve explicit order only if clinically meaningful.

---

# EXEC-0957 | ACTIVE | 957. FORMULA DEPENDENCY ON FORM DRAFT

If live calculation uses unsaved draft inputs, UI labels it provisional until persisted/validated where appropriate.

---

# EXEC-0958 | ACTIVE | 958. PARTIAL ENCOUNTER STATE

Clinical intelligence must know whether encounter data are incomplete/draft.

Do not treat draft absence as confirmed negative.

---

# EXEC-0959 | ACTIVE | 959. SIGNING WITH PENDING ASYNC DATA

If critical extraction/calculation is still pending, signing policy defines whether:
- block;
- warn;
- allow with explicit state.

No silent late insertion into signed note.

---

# EXEC-0960 | ACTIVE | 960. LATE AI OUTPUT AFTER SIGN

AI response generated from pre-sign draft cannot mutate signed note when it arrives later.

---

# EXEC-0961 | ACTIVE | 961. LATE LAB DURING ENCOUNTER

Result arriving while encounter open updates context with clear “new” state; does not silently alter already documented assessment.

---

# EXEC-0962 | ACTIVE | 962. LATE CORRECTION AFTER PRESCRIPTION

System can flag affected medication safety calculation/decision for review; does not rewrite prescription.

---

# EXEC-0963 | ACTIVE | 963. VERSIONED DECISION CONTEXT

High-impact actions record patient-state/version context so later changes can be distinguished.

---

# EXEC-0964 | ACTIVE | 964. FORM SUBMISSION SERIALIZATION

Prevent double/parallel mutation sequences that depend on order unless workflow explicitly supports them.

---

# EXEC-0965 | ACTIVE | 965. HTTP RETRY SEMANTICS

Infrastructure/proxies may retry idempotent requests.

Do not use GET for mutation.

PUT/PATCH/POST semantics designed intentionally.

---

# EXEC-0966 | ACTIVE | 966. 204/EMPTY BODY HANDLING

Client must not interpret malformed/empty server response as successful clinical object creation without required identifier/version.

---

# EXEC-0967 | ACTIVE | 967. PARTIAL JSON RESPONSE

Network truncation/parse failure is explicit error, not partial success.

---

# EXEC-0968 | ACTIVE | 968. API CLOCK/DATE SERIALIZATION

ISO 8601 conventions explicit; date-only fields remain date-only.

---

# EXEC-0969 | ACTIVE | 969. API UNKNOWN ENUM

Client displays safe unknown state and telemetry; does not map unknown to first/default enum.

---

# EXEC-0970 | ACTIVE | 970. API NULL FIELD

Schema distinguishes optional vs nullable.

---

# EXEC-0971 | ACTIVE | 971. API ERROR RETRYABILITY

Error payload indicates retryable class where appropriate; client does not retry validation/authz failures.

---

# EXEC-0972 | ACTIVE | 972. CLIENT OFFLINE RETRY

Queued mutations after reconnect revalidate patient/version/authorization before execution.

---

# EXEC-0973 | ACTIVE | 973. MOBILE BACKGROUND RESUME

App/browser resume refreshes critical context after long background period.

---

# EXEC-0974 | ACTIVE | 974. PUSH NOTIFICATION DEEP LINK

Deep link reauthenticates/authorizes and verifies current patient/resource.

Notification payload contains minimum PHI.

---

# EXEC-0975 | ACTIVE | 975. NOTIFICATION STALE DEEP LINK

If resource resolved/changed, destination shows current status, not obsolete action button.

---

# EXEC-0976 | ACTIVE | 976. DEEP LINK TENANT CONTEXT

Multi-tenant user opening link must enter correct authorized tenant context explicitly.

---

# EXEC-0977 | ACTIVE | 977. UNIVERSAL SEARCH KEYBOARD RACE

Rapid typing/cancelled searches cannot render old response over newer query.

---

# EXEC-0978 | ACTIVE | 978. SEARCH EXACT VS FUZZY

Exact folio/identifier match is visually distinguished from fuzzy candidate.

---

# EXEC-0979 | ACTIVE | 979. TYPEAHEAD WRONG SELECTION

Keyboard navigation highlights selected patient clearly; Enter selects current highlighted result only.

---

# EXEC-0980 | ACTIVE | 980. RECENT PATIENT LIST PRIVACY

Recent patient shortcuts are user/tenant scoped and cleared on logout/shared device.

---

# EXEC-0981 | ACTIVE | 981. BROWSER AUTOFILL

Disable inappropriate autofill on sensitive/structured clinical fields where browser behavior can insert wrong values.

---

# EXEC-0982 | ACTIVE | 982. NUMBER INPUT WHEEL

Prevent accidental mouse-wheel changes on focused high-risk numeric fields or require confirmation.

---

# EXEC-0983 | ACTIVE | 983. MOBILE NUMERIC KEYBOARD

Use appropriate input mode but still schema-validate.

---

# EXEC-0984 | ACTIVE | 984. UNIT SWITCH AFTER VALUE ENTRY

If user switches unit, either convert explicitly or clear/reconfirm; never relabel same numeric value.

---

# EXEC-0985 | ACTIVE | 985. DROPDOWN STALE OPTIONS

Terminology/drug option selected under old catalog remains resolvable/versioned after catalog update.

---

# EXEC-0986 | ACTIVE | 986. ASYNC VALIDATION RACE

Field validation response for old value must not overwrite validation state for newer value.

---

# EXEC-0987 | ACTIVE | 987. ERROR TOAST LOSS

Critical validation errors should remain associated with field/workflow, not disappear as ephemeral toast only.

---

# EXEC-0988 | ACTIVE | 988. SUCCESS TOAST FALSE POSITIVE

Show success only after authoritative server completion.

---

# EXEC-0989 | ACTIVE | 989. BUTTON ENABLEMENT IS NOT AUTHORIZATION

Even if button hidden/disabled, endpoint enforces policy.

---

# EXEC-0990 | ACTIVE | 990. MODAL CONTEXT LOSS

Modal opened for patient A must close/invalidate if global patient context changes.

---

# EXEC-0991 | ACTIVE | 991. UNSAVED MODAL CLOSE

Warn/preserve meaningful unsaved clinical input.

---

# EXEC-0992 | ACTIVE | 992. ESCAPE KEY SAFETY

Escape must not silently discard high-value form without appropriate recovery.

---

# EXEC-0993 | ACTIVE | 993. DEFAULT ENTER KEY

Enter in form must not accidentally trigger sign/prescribe/destructive primary action.

---

# EXEC-0994 | ACTIVE | 994. TAB ORDER

Keyboard tab order follows safe logical clinical flow.

---

# EXEC-0995 | ACTIVE | 995. SCREEN READER LABEL

Medication dose/value/unit labels programmatically associated.

---

# EXEC-0996 | ACTIVE | 996. COLOR-BLIND SAFETY

Critical/abnormal states use icon/text, not color alone.

---

# EXEC-0997 | ACTIVE | 997. ZOOM / LARGE TEXT

At accessibility zoom, patient identity and critical warnings remain visible and associated.

---

# EXEC-0998 | ACTIVE | 998. PRINT CSS REGRESSION

Print-specific CSS tested in CI/render snapshots for prescription/note outputs.

---

# EXEC-0999 | ACTIVE | 999. FONT FALLBACK

Missing font must not cause prescription/document clipping or ambiguous characters.

---

# EXEC-1000 | ACTIVE | 1000. PDF PAGE BREAK

Medication instruction or signature block cannot be split in misleading way.

---

# EXEC-1001 | ACTIVE | 1001. QR CODE ERROR CORRECTION

If QR is used, validate payload, size and print scanability; QR is not sole source of required information.

---

# EXEC-1002 | ACTIVE | 1002. BARCODE/QR WRONG RECORD

Generated code payload bound to exact artifact/patient-safe reference; test cache/template reuse.

---

# EXEC-1003 | ACTIVE | 1003. TEMPLATE VARIABLE ESCAPING

Patient-provided text cannot break document layout or inject markup.

---

# EXEC-1004 | ACTIVE | 1004. LONG NAME / LONG ADDRESS

Test extreme legitimate lengths in UI/PDF.

No clipping of patient identity.

---

# EXEC-1005 | ACTIVE | 1005. RIGHT-TO-LEFT FUTURE READINESS

If RTL languages are introduced, clinical layout and numeric/unit pairing require dedicated QA; do not assume CSS mirroring is sufficient.

---

# EXEC-1006 | ACTIVE | 1006. INTERNATIONAL DECIMAL/DATES

Locale affects display only; internal semantics canonical.

---

# EXEC-1007 | ACTIVE | 1007. DEPLOYMENT HEALTH GATE

Deployment does not become healthy solely because HTTP `/health` returns 200.

Check:
- DB;
- artifact registry;
- critical configuration;
- queue;
- migration version;
- Clinical BOM compatibility.

---

# EXEC-1008 | ACTIVE | 1008. READINESS VS LIVENESS

Separate:
- liveness: process should restart?
- readiness: can receive traffic?

Do not restart endlessly because external optional dependency is down.

---

# EXEC-1009 | ACTIVE | 1009. STARTUP ARTIFACT VALIDATION

Before serving high-risk computation, verify required approved artifact set loaded and hashes valid.

---

# EXEC-1010 | ACTIVE | 1010. PARTIAL STARTUP

If optional subsystem unavailable, advertise degraded capabilities explicitly.

---

# EXEC-1011 | ACTIVE | 1011. DEPLOYMENT SMOKE TEST

After deploy, run synthetic:
- login;
- tenant auth;
- patient open;
- encounter draft;
- deterministic calculation;
- artifact resolution;
- audit/outbox;
without real PHI.

---

# EXEC-1012 | ACTIVE | 1012. CANARY TENANT SAFETY

Canary must not expose unapproved high-risk behavior merely because tenant volunteered for beta.

Clinical validation/governance still applies.

---

# EXEC-1013 | ACTIVE | 1013. DATABASE FAILOVER

Test transactions/idempotency during failover.

Client must not show success for uncertain commit without reconciliation.

---

# EXEC-1014 | ACTIVE | 1014. UNCERTAIN COMMIT

If connection drops after commit request, state is unknown.

Retry with idempotency/reconciliation; never assume failure.

---

# EXEC-1015 | ACTIVE | 1015. READ REPLICA LAG

Safety-critical read-after-write should not use stale replica when immediate consistency required.

---

# EXEC-1016 | ACTIVE | 1016. REPLICA ROUTING

Define which queries may use replicas.

---

# EXEC-1017 | ACTIVE | 1017. BACKUP PITR TEST

Point-in-time recovery tested around:
- signed note;
- result closure;
- algorithm release.

---

# EXEC-1018 | ACTIVE | 1018. RESTORE SIDE-EFFECT REPLAY

Restoring DB to earlier point can cause outbox/workflow replay.

Recovery procedure prevents duplicate external actions.

---

# EXEC-1019 | ACTIVE | 1019. DISASTER RECOVERY RPO/RTO BY DOMAIN

Define RPO/RTO separately for:
- chart;
- documents;
- audit;
- artifact registry;
- queues/workflows.

---

# EXEC-1020 | ACTIVE | 1020. AUDIT CLOCK ORDER AFTER RESTORE

Preserve event chronology/correlation even across restore/replay.

---

# EXEC-1021 | ACTIVE | 1021. PRODUCTION DATA FIX FOR ALGORITHM DEFECT

If algorithm defect affected persisted derived values:
- identify executions by version;
- classify patient impact;
- preserve original;
- recompute as new derived version where approved;
- notify/review where required.

---

# EXEC-1022 | ACTIVE | 1022. NO BLIND GLOBAL RECOMPUTE

Never recompute every patient after algorithm change without scope/clinical justification.

---

# EXEC-1023 | ACTIVE | 1023. ALGORITHM VERSION RETENTION

Historical artifact binary/source/manifest remains available for required retention period.

---

# EXEC-1024 | ACTIVE | 1024. DEPENDENCY VULNERABILITY UPDATE

Security dependency patch can change clinical behavior.

Run affected behavioral regression even for “security-only” upgrade.

---

# EXEC-1025 | ACTIVE | 1025. NODE/RUNTIME UPGRADE

Runtime upgrade can affect:
- date;
- Intl;
- crypto;
- serialization;
- numeric libraries.

Treat as platform behavioral change.

---

# EXEC-1026 | ACTIVE | 1026. DATABASE VERSION UPGRADE

Test query plans, collation, JSON/date behavior, extensions and RLS.

---

# EXEC-1027 | ACTIVE | 1027. COLLATION CHANGE

Search/uniqueness can change with collation/ICU upgrade.

Patient identity/search regression suite required.

---

# EXEC-1028 | ACTIVE | 1028. LIBRARY TRANSITIVE DEPENDENCY

Lockfile changes are reviewed; a minor package update can alter parser/date/decimal behavior.

---

# EXEC-1029 | ACTIVE | 1029. SBOM DIFF

Release shows dependency additions/removals and risk.

---

# EXEC-1030 | ACTIVE | 1030. LICENSE CHANGE

Dependency/clinical data license changes can block release/distribution.

---

# EXEC-1031 | ACTIVE | 1031. EXTERNAL API VERSION DEPRECATION

Adapters monitor provider deprecation deadlines and test new versions before cutoff.

---

# EXEC-1032 | ACTIVE | 1032. PROVIDER SANDBOX DIFFERENCE

Do not assume sandbox behavior equals production.

Contract monitoring and controlled production validation required.

---

# EXEC-1033 | ACTIVE | 1033. SCHEMA-VALID BUT SEMANTICALLY WRONG

External payload can pass JSON schema yet contain impossible semantics.

Domain validation remains necessary.

---

# EXEC-1034 | ACTIVE | 1034. SILENT PROVIDER FIELD CHANGE

Monitor unknown fields/enum values and contract drift.

---

# EXEC-1035 | ACTIVE | 1035. WEBHOOK CLOCK SKEW

Signature timestamp validation allows bounded skew without replay weakness.

---

# EXEC-1036 | ACTIVE | 1036. CERTIFICATE EXPIRY

Monitor TLS/certificates/secrets before expiry.

---

# EXEC-1037 | ACTIVE | 1037. DOMAIN/DNS EXPIRY

Operational ownership includes domain/DNS lifecycle.

---

# EXEC-1038 | ACTIVE | 1038. STORAGE QUOTA

Low disk/object quota cannot silently stop document/audit persistence.

Alert before exhaustion.

---

# EXEC-1039 | ACTIVE | 1039. DATABASE STORAGE GROWTH

Monitor table/index/bloat growth.

Clinical history is long-lived; capacity planning uses realistic retention.

---

# EXEC-1040 | ACTIVE | 1040. AUDIT VOLUME

Audit can become massive; partition/archive without losing queryability/integrity.

---

# EXEC-1041 | ACTIVE | 1041. HIGH-CARDINALITY PATIENT HISTORY

One patient with decades of data is a dedicated performance test.

---

# EXEC-1042 | ACTIVE | 1042. PATHOLOGICAL NOTE SIZE

Bound note/document payloads reasonably while supporting legitimate long records.

No request should exhaust memory.

---

# EXEC-1043 | ACTIVE | 1043. LARGE PDF

Streaming/upload limits; do not buffer huge files fully in app memory.

---

# EXEC-1044 | ACTIVE | 1044. VIRUS SCANNER QUEUE BACKLOG

Quarantined uploads remain clearly pending; core charting unaffected.

---

# EXEC-1045 | ACTIVE | 1045. AI QUEUE BACKLOG

AI summary delay never blocks deterministic clinical core.

---

# EXEC-1046 | ACTIVE | 1046. PRIORITY INVERSION

Bulk low-priority jobs cannot occupy all workers while critical result workflow waits.

---

# EXEC-1047 | ACTIVE | 1047. WORKER POOL PARTITIONING

Separate pools/queues by workload/risk where justified.

---

# EXEC-1048 | ACTIVE | 1048. DATABASE HOT ROW

Avoid one global counter/row lock for human folio generation at scale.

Use scalable tenant/year sequence strategy.

---

# EXEC-1049 | ACTIVE | 1049. FOLIO UNIQUENESS

Human folio uniqueness scope is explicit and DB-enforced.

---

# EXEC-1050 | ACTIVE | 1050. FOLIO GAP

Gaps can occur due to rollback; do not promise gapless sequence unless legally required and specifically engineered.

---

# EXEC-1051 | ACTIVE | 1051. FOLIO REUSE PROHIBITION

Never reuse a historical clinical folio after deletion/cancellation.

---

# EXEC-1052 | ACTIVE | 1052. RANDOM ID ENTROPY

Public opaque IDs use sufficient entropy; internal sequential IDs are not exposed as authorization mechanism.

---

# EXEC-1053 | ACTIVE | 1053. UUID CASE / STRING NORMALIZATION

Canonicalize identifiers at boundaries; avoid duplicate representations.

---

# EXEC-1054 | ACTIVE | 1054. CLOCK-BASED ID ORDERING

If ULID/time-sortable IDs used, do not treat ID order as authoritative clinical chronology.

---

# EXEC-1055 | ACTIVE | 1055. DATABASE SEQUENCE RESTORE

Restore/migration must avoid sequence collisions.

---

# EXEC-1056 | ACTIVE | 1056. TEST CLOCK

Tests use injectable/frozen clock for temporal workflows.

---

# EXEC-1057 | ACTIVE | 1057. TEST TIMEZONE MATRIX

Run critical temporal tests in multiple representative timezones.

---

# EXEC-1058 | ACTIVE | 1058. PROPERTY TEST SEED RECORDING

On failure, record random seed/example for deterministic reproduction.

---

# EXEC-1059 | ACTIVE | 1059. FUZZ CORPUS RETENTION

Every discovered crashing/unsafe input becomes permanent regression corpus.

---

# EXEC-1060 | ACTIVE | 1060. MUTATION SURVIVOR REVIEW

Surviving mutations in C4/C5 code require review; they indicate weak tests or irrelevant code.

---

# EXEC-1061 | ACTIVE | 1061. CHAOS SAFETY ASSERTIONS

Chaos test passes only if clinical invariants remain true, not merely service recovers.

---

# EXEC-1062 | ACTIVE | 1062. LOAD TEST DATA ISOLATION

Load tests never target production PHI.

---

# EXEC-1063 | ACTIVE | 1063. LOAD TEST THINK TIME

Model realistic clinician interaction, not only synthetic maximum RPS.

Also test burst scenarios.

---

# EXEC-1064 | ACTIVE | 1064. SOAK TEST LONG WORKFLOW

Run multi-hour encounter/autosave/session tests.

---

# EXEC-1065 | ACTIVE | 1065. BROWSER MATRIX

Define supported browsers/versions.

Clinical PDF/print/input behavior can differ.

---

# EXEC-1066 | ACTIVE | 1066. DEVICE MATRIX

Desktop/tablet/mobile critical flows tested according to supported capability.

---

# EXEC-1067 | ACTIVE | 1067. NETWORK CONDITION MATRIX

Test:
- high latency;
- packet loss;
- intermittent offline;
- slow upload.

---

# EXEC-1068 | ACTIVE | 1068. PROXY / CORPORATE NETWORK

Healthcare facilities may use restrictive proxies/firewalls.

Document required endpoints and graceful failure.

---

# EXEC-1069 | ACTIVE | 1069. COOKIE RESTRICTIONS

Auth architecture tested under modern browser cookie/privacy policies.

---

# EXEC-1070 | ACTIVE | 1070. POPUP BLOCKER

Do not depend on popups for critical workflow without fallback.

---

# EXEC-1071 | ACTIVE | 1071. DOWNLOAD BLOCKER

Prescription/document access has visible fallback if browser blocks download.

---

# EXEC-1072 | ACTIVE | 1072. PRINT DIALOG CANCELLATION

Cancelling print does not mark prescription as delivered/printed unless explicitly tracked separately.

---

# EXEC-1073 | ACTIVE | 1073. FILE DOWNLOAD COMPLETION

Server cannot know user successfully opened file solely from response 200.

Do not overclaim delivery.

---

# EXEC-1074 | ACTIVE | 1074. EMAIL DELIVERY SEMANTICS

Provider accepted ≠ inbox delivered ≠ read.

---

# EXEC-1075 | ACTIVE | 1075. WHATSAPP DELIVERY SEMANTICS

Use provider-defined statuses; do not map all to “patient informed”.

---

# EXEC-1076 | ACTIVE | 1076. AUDIT READ ACCESS

Reading audit logs is itself sensitive and authorized.

---

# EXEC-1077 | ACTIVE | 1077. AUDIT EXPORT

Audit export is scoped, logged and protected.

---

# EXEC-1078 | ACTIVE | 1078. AUDIT RETENTION

Retention policy can differ from operational logs.

Do not purge audit with ordinary log rotation.

---

# EXEC-1079 | ACTIVE | 1079. AUDIT FAILURE POLICY

For high-risk mutations, define behavior if required audit persistence fails.

Never silently perform unaudited critical mutation if policy requires atomic audit.

---

# EXEC-1080 | ACTIVE | 1080. PROVENANCE FAILURE POLICY

Similarly, clinically consequential derived output should not persist without required provenance.

---

# EXEC-1081 | ACTIVE | 1081. METRICS FAILURE

Metrics outage must not block clinical care.

Audit/provenance and metrics have different criticality.

---

# EXEC-1082 | ACTIVE | 1082. OBSERVABILITY BACKPRESSURE

Telemetry exporter failure must not exhaust app memory or block clinical requests.

---

# EXEC-1083 | ACTIVE | 1083. TRACE CONTEXT SPOOFING

Do not trust externally supplied trace IDs for authorization; sanitize/bound them.

---

# EXEC-1084 | ACTIVE | 1084. CORRELATION ID COLLISION

Correlation IDs are operational only, not security identifiers.

---

# EXEC-1085 | ACTIVE | 1085. ERROR MESSAGE PHI

Exception messages must not include raw note/patient payload.

---

# EXEC-1086 | ACTIVE | 1086. DATABASE ERROR LEAK

Do not expose SQL/schema/internal identifiers to client unnecessarily.

---

# EXEC-1087 | ACTIVE | 1087. SECURITY HEADER ENVIRONMENT PARITY

Production security headers are tested in preview/staging equivalent.

---

# EXEC-1088 | ACTIVE | 1088. CSP NONCE/CACHE

If CSP nonce used, ensure caching does not reuse nonce incorrectly.

---

# EXEC-1089 | ACTIVE | 1089. XSS FROM MEDICAL TEXT

Clinical text can contain markup-like strings; render as text by default.

---

# EXEC-1090 | ACTIVE | 1090. MARKDOWN SAFETY

If Markdown supported, sanitize rendered HTML and disallow unsafe constructs.

---

# EXEC-1091 | ACTIVE | 1091. CSV EXPORT ENCODING

UTF-8/BOM decision tested for target spreadsheet compatibility without data corruption.

---

# EXEC-1092 | ACTIVE | 1092. EXCEL DATE COERCION

Identifiers/codes that look like dates/numbers can be corrupted by spreadsheets.

Exports preserve textual semantics where needed.

---

# EXEC-1093 | ACTIVE | 1093. LEADING ZERO PRESERVATION

Folio/codes/phones can contain leading zeros; do not numeric-coerce.

---

# EXEC-1094 | ACTIVE | 1094. PDF TEXT EXTRACTION PRIVACY

Generated PDF metadata should not accidentally include hidden PHI/debug data.

---

# EXEC-1095 | ACTIVE | 1095. DOCUMENT METADATA

Uploaded files may contain author/location metadata.

Define whether to preserve, strip or protect based on purpose.

---

# EXEC-1096 | ACTIVE | 1096. IMAGE EXIF

If images uploaded, EXIF may contain sensitive metadata.

Policy determines stripping/preservation.

---

# EXEC-1097 | ACTIVE | 1097. THUMBNAIL GENERATION

Derived thumbnails inherit access controls and retention of source.

---

# EXEC-1098 | ACTIVE | 1098. OBJECT ACL DRIFT

Periodic check ensures private clinical objects have expected ACL/bucket policy.

---

# EXEC-1099 | ACTIVE | 1099. ORPHAN OBJECT RECONCILIATION

Detect storage objects without DB references and DB references without objects.

Repair via governed policy.

---

# EXEC-1100 | ACTIVE | 1100. PRESIGNED UPLOAD VALIDATION

Upload token restricts:
- tenant;
- object key;
- size;
- type;
- expiry.

Finalization validates object.

---

# EXEC-1101 | ACTIVE | 1101. CONTENT HASH TIMING

Hash authoritative stored bytes, not only client-provided hash.

---

# EXEC-1102 | ACTIVE | 1102. MALWARE FALSE POSITIVE/NEGATIVE

Scanner result is one control; preserve quarantine/review path.

---

# EXEC-1103 | ACTIVE | 1103. FILE PARSER VERSION

Extraction records parser/OCR version; upgrades run regression corpus.

---

# EXEC-1104 | ACTIVE | 1104. OCR MODEL DRIFT

Provider/model updates require extraction quality monitoring.

---

# EXEC-1105 | ACTIVE | 1105. LAB PARSER TEMPLATE DRIFT

A lab changes PDF layout; extraction confidence/validation detects it rather than silently shifting columns.

---

# EXEC-1106 | ACTIVE | 1106. SOURCE-SPECIFIC PARSER KILL SWITCH

Disable one broken provider/parser without disabling all document ingestion.

---

# EXEC-1107 | ACTIVE | 1107. EXTRACTION CONFIDENCE CALIBRATION

Confidence thresholds are task/provider-specific and validated.

Model confidence alone does not authorize high-risk data.

---

# EXEC-1108 | ACTIVE | 1108. HUMAN VERIFICATION UX

Verifier sees original source next to extracted value/unit/context.

Do not make verification a blind checkbox.

---

# EXEC-1109 | ACTIVE | 1109. VERIFICATION RACE

Two reviewers editing extracted data concurrently use versioning/audit.

---

# EXEC-1110 | ACTIVE | 1110. VERIFIED DATA CORRECTION

Later correction creates new verified version; preserves prior.

---

# EXEC-1111 | ACTIVE | 1111. KNOWLEDGE SOURCE DUPLICATE

Same guideline mirrored at multiple URLs is one source/version, not independent evidence.

---

# EXEC-1112 | ACTIVE | 1112. SOURCE IDENTITY

Identify issuing organization/document/version independently from retrieval URL.

---

# EXEC-1113 | ACTIVE | 1113. SOURCE UPDATE WITHOUT URL CHANGE

Hash/content metadata detects changed document at same URL.

---

# EXEC-1114 | ACTIVE | 1114. URL CHANGE WITHOUT SOURCE CHANGE

Do not create false new guideline version merely because hosting URL changed.

---

# EXEC-1115 | ACTIVE | 1115. RETRACTION / ERRATUM

Evidence registry supports errata/retractions and downstream impact.

---

# EXEC-1116 | ACTIVE | 1116. PARTIAL GUIDELINE UPDATE

Track changed recommendations, not only document-level “new version”.

---

# EXEC-1117 | ACTIVE | 1117. SOURCE LANGUAGE VERSION

Translations can lag original.

Track language/version relationship.

---

# EXEC-1118 | ACTIVE | 1118. GUIDELINE IMPLEMENTATION LAG

Local adoption may lag publication; runtime follows approved policy.

---

# EXEC-1119 | ACTIVE | 1119. KNOWLEDGE REVIEW CONFLICT OF INTEREST

Governance may record reviewer conflicts/roles where organization requires.

Not an engineering substitute for clinical governance.

---

# EXEC-1120 | ACTIVE | 1120. AI KNOWLEDGE EXTRACTION DOUBLE REVIEW

For high-impact source-to-rule conversion:
- AI extraction is candidate;
- independent verification;
- compiled behavior tests.

---

# EXEC-1121 | ACTIVE | 1121. KNOWLEDGE RULE NEGATION

Test “do not”, “unless”, exceptions and contraindications explicitly.

Negation errors can invert medical meaning.

---

# EXEC-1122 | ACTIVE | 1122. KNOWLEDGE TEMPORAL LANGUAGE

“within”, “after”, “before”, “at least”, “no more than” compile to explicit interval semantics.

Boundary inclusivity is tested.

---

# EXEC-1123 | ACTIVE | 1123. KNOWLEDGE QUANTIFIER LANGUAGE

“all”, “any”, “either”, “both”, “one of” require typed logical translation.

---

# EXEC-1124 | ACTIVE | 1124. KNOWLEDGE EXCEPTION PRECEDENCE

Exceptions override general rule only when explicitly modeled.

---

# EXEC-1125 | ACTIVE | 1125. KNOWLEDGE MISSING DATA

Rule defines behavior for missing each required fact.

No truthiness shortcuts.

---

# EXEC-1126 | ACTIVE | 1126. KNOWLEDGE UNKNOWN TERMINOLOGY

Unmapped concept blocks affected rule rather than matching by free-text guess.

---

# EXEC-1127 | ACTIVE | 1127. KNOWLEDGE UNIT BOUNDARY

Threshold carries unit/dimension in IR.

---

# EXEC-1128 | ACTIVE | 1128. KNOWLEDGE DECIMAL PRECISION

Threshold comparison uses exact defined semantics.

---

# EXEC-1129 | ACTIVE | 1129. KNOWLEDGE EFFECTIVE VERSION AT EVENT TIME

Prospective recommendation uses current approved knowledge; historical reconstruction uses historical active knowledge.

---

# EXEC-1130 | ACTIVE | 1130. KNOWLEDGE SOURCE ACCESS FAILURE DURING AUDIT

Historical provenance remains usable even if external URL disappears.

Store legally permitted metadata/snapshot/hash.

---

# EXEC-1131 | ACTIVE | 1131. AI EVAL DATA LEAK

Do not use production feedback cases in training/evaluation without lawful governance and separation.

---

# EXEC-1132 | ACTIVE | 1132. AI EVAL PROMPT LEAK

Hidden eval prompts/cases are access-controlled to preserve independent measurement.

---

# EXEC-1133 | ACTIVE | 1133. AI MODEL NONDETERMINISM

Clinical task evaluation uses repeated samples/temperature policy appropriate to task.

Production structured tasks generally minimize unnecessary randomness.

---

# EXEC-1134 | ACTIVE | 1134. AI TEMPERATURE CONFIG DRIFT

Model parameters are versioned as part of task config.

---

# EXEC-1135 | ACTIVE | 1135. AI PROVIDER SAFETY FILTER FAILURE

Provider refusal/filtering is explicit task failure, not empty clinical result.

---

# EXEC-1136 | ACTIVE | 1136. AI LANGUAGE SWITCH

Model responding in wrong language must not corrupt structured data; patient-facing text language is validated.

---

# EXEC-1137 | ACTIVE | 1137. AI NUMERIC TRANSCRIPTION

Never trust LLM arithmetic when deterministic calculator exists.

---

# EXEC-1138 | ACTIVE | 1138. AI DATE CALCULATION

Use deterministic date engine for age/intervals.

---

# EXEC-1139 | ACTIVE | 1139. AI TERMINOLOGY CODING

AI suggests code; terminology service validates candidate and applicability.

---

# EXEC-1140 | ACTIVE | 1140. AI MEDICATION NAME NORMALIZATION

LLM suggestion resolves through medication catalog; unresolved drug stays unverified.

---

# EXEC-1141 | ACTIVE | 1141. AI DIFFERENTIAL DUPLICATION

Normalize duplicate hypotheses without merging clinically distinct entities incorrectly.

---

# EXEC-1142 | ACTIVE | 1142. AI DIFFERENTIAL SAFETY

Differential output is physician-support content, not automatic Problem List mutation.

---

# EXEC-1143 | ACTIVE | 1143. AI OMISSION ENGINE FALSE NEGATIVE

Critical omission detection should not rely solely on generative AI.

Deterministic/knowledge safety rules cover designated high-risk omissions.

---

# EXEC-1144 | ACTIVE | 1144. AI OMISSION ENGINE FALSE POSITIVE

Measure burden/override; suppress noisy low-value suggestions through governed tuning.

---

# EXEC-1145 | ACTIVE | 1145. AI CONCORDANCE CONFLICT

AI can discover possible contradictions; deterministic facts/provenance determine actual conflict representation.

---

# EXEC-1146 | ACTIVE | 1146. AI TRAJECTORY CLAIM

Underlying trend computed deterministically; AI only contextualizes.

---

# EXEC-1147 | ACTIVE | 1147. AI CARE GAP CLAIM

Care-gap eligibility/closure deterministic/knowledge-driven where designated; AI explanation cannot create/close gap.

---

# EXEC-1148 | ACTIVE | 1148. AI PATIENT STATE SUMMARY

Summary is derived view with source links and freshness.

It is not authoritative Patient State storage.

---

# EXEC-1149 | ACTIVE | 1149. AI NOTE DRAFT ATTRIBUTION

AI-drafted note remains draft until clinician accepts/signs.

Audit may record AI assistance according to policy.

---

# EXEC-1150 | ACTIVE | 1150. AI NOTE OMISSION

AI summary/note can omit relevant fact.

Signing UI should preserve access to source/structured data; do not hide chart behind generated narrative.

---

# EXEC-1151 | ACTIVE | 1151. AI NOTE FABRICATION

Unsupported statements are a release/eval target.

No “normal exam” fabrication.

---

# EXEC-1152 | ACTIVE | 1152. AI NOTE COPY-FORWARD

Do not feed previous AI note as sole source for next note.

Ground against current structured/source facts.

---

# EXEC-1153 | ACTIVE | 1153. AI PROMPT VERSION AFTER SIGN

Historical signed note does not change when prompt/model updates.

---

# EXEC-1154 | ACTIVE | 1154. AI RETRIEVAL WRONG PATIENT

Cross-patient retrieval is catastrophic class; dedicated adversarial tests and hard tenant/patient filters.

---

# EXEC-1155 | ACTIVE | 1155. AI RETRIEVAL WRONG ENCOUNTER

Current task context distinguishes current encounter from historical encounters.

---

# EXEC-1156 | ACTIVE | 1156. AI TOOL AUTHORIZATION

Tool call authorization is server-side per requested action/resource, independent of model request.

---

# EXEC-1157 | ACTIVE | 1157. AI TOOL ARGUMENT VALIDATION

All tool arguments schema/domain validated.

Model cannot bypass by creative JSON.

---

# EXEC-1158 | ACTIVE | 1158. AI TOOL LOOP LIMIT

Bound number of tool calls/time/tokens.

No runaway autonomous loop.

---

# EXEC-1159 | ACTIVE | 1159. AI TOOL SIDE-EFFECT PREVIEW

Future mutable tool calls show structured preview to physician where confirmation required.

---

# EXEC-1160 | ACTIVE | 1160. AI MODEL KILL BY TASK

Disable one task/model combination without shutting down all AI.

---

# EXEC-1161 | ACTIVE | 1161. AI AUDIT VOLUME

Store sufficient governance metadata without storing unnecessary raw prompts containing PHI indefinitely.

Retention is task/risk based.

---

# EXEC-1162 | ACTIVE | 1162. AI CONTEXT HASH

For high-risk tasks, hash/reference context manifest for reproducibility without duplicating entire chart.

---

# EXEC-1163 | ACTIVE | 1163. AI REPRODUCIBILITY LIMIT

Generative output may not be exactly reproducible even with same inputs/provider.

Record enough metadata for investigation; do not promise deterministic replay unless actually achieved.

---

# EXEC-1164 | ACTIVE | 1164. ALGORITHM VS AI AUTHORITY UI

UI visually distinguishes:
- deterministic calculation;
- knowledge recommendation;
- AI suggestion.

Do not make all three look equally authoritative.

---

# EXEC-1165 | ACTIVE | 1165. PRODUCTION BUG BOUNTY / INTERNAL REPORTING

Create easy internal mechanism for clinicians/staff to report:
- wrong calculation;
- wrong patient context;
- missing result;
- strange AI output;
- workflow contradiction.

Reports preserve relevant version/context automatically.

---

# EXEC-1166 | ACTIVE | 1166. SUPPORT REPRODUCTION PACKAGE

For a reported issue, generate privacy-controlled diagnostic package:
- object IDs;
- versions;
- timestamps;
- artifact versions;
- event correlation;
- state transitions;
without dumping unnecessary PHI.

---

# EXEC-1167 | ACTIVE | 1167. INCIDENT REPLAY

Reproduce bug in isolated environment using synthetic/redacted equivalent or authorized controlled data process.

Never experiment on live patient record.

---

# EXEC-1168 | ACTIVE | 1168. BUG FIX REGRESSION LAW

Every production bug creates at least one regression test/property/reconciliation control unless technically impossible and documented.

---

# EXEC-1169 | ACTIVE | 1169. ESCAPED DEFECT ANALYSIS

For every serious escaped defect ask:
- why specification missed it;
- why test missed it;
- why review missed it;
- why monitoring missed it;
- why recovery did/did not work.

---

# EXEC-1170 | ACTIVE | 1170. DEFECT PREVENTION OVER PATCHING

Fix the defect class, not only one instance.

Example:
wrong unit bug → typed unit boundary + property tests + UI contract, not one `if`.

---

# EXEC-1171 | ACTIVE | 1171. PRODUCTION READINESS GATE — REAL SYSTEM

No subsystem is production-ready until it demonstrates:

```text
functional correctness
+ negative capability
+ concurrency correctness
+ retry/idempotency
+ migration safety
+ realistic performance
+ degraded behavior
+ observability
+ security
+ clinical safety
+ recovery
+ operator runbook
```

---

# EXEC-1172 | ACTIVE | 1172. GOLDEN PRODUCTION FAILURE SUITE

Maintain permanent scenarios:

1. double-click prescription;
2. stale tab signs note;
3. permission revoked before save;
4. patient switch during delayed AI response;
5. corrected critical lab after acknowledgement;
6. duplicate lab webhook;
7. out-of-order result webhook;
8. worker crashes after side effect before ack;
9. DB failover after uncertain commit;
10. algorithm artifact hash mismatch;
11. knowledge update conflicts with active rule;
12. stale pediatric weight;
13. lb entered where kg expected;
14. OCR decimal/unit error;
15. patient merge while result arrives;
16. old/new app versions during rolling deploy;
17. terminology update retires active code;
18. AI retrieval returns no approved evidence;
19. AI provider outage;
20. cache contains prior tenant response;
21. RLS context leaks through pooled connection;
22. migration runs on large table;
23. queue backlog delays obligation;
24. support user loses permission mid-session;
25. patient portal share link sent to wrong recipient;
26. backup restore would replay messages;
27. Clinical BOM differs after failover;
28. timezone/DST crosses due date;
29. hidden adaptive-form value remains stale;
30. copied “normal exam” attempts to persist without observation.

All must have explicit expected safe behavior.

---

# EXEC-1173 | ACTIVE | 1173. PRE-PRODUCTION SHADOW CLINIC

Before real pilot, run a synthetic “shadow clinic” continuously.

Simulate:
- hundreds/thousands of patients;
- concurrent clinicians;
- labs;
- corrections;
- appointments;
- prescriptions;
- documents;
- AI tasks;
- outages;
- retries;
- merges;
- long histories.

Run accelerated virtual time to expose week/month/year workflow bugs.

---

# EXEC-1174 | ACTIVE | 1174. ACCELERATED TIME TESTING

A real one-year follow-up bug should not require one year to discover.

Test clock can advance:
- days;
- months;
- birthdays;
- review expirations;
- recurring obligations;
- knowledge expiry.

Never use accelerated clock in production.

---

# EXEC-1175 | ACTIVE | 1175. PRODUCTION-LIKE DATA SHAPE

Synthetic load must reproduce:
- skewed tenants;
- very large charts;
- sparse charts;
- repeated labs;
- long notes;
- many documents;
- high obligation counts.

Uniform random data hides real bottlenecks.

---

# EXEC-1176 | ACTIVE | 1176. FAULT-INJECTION CAMPAIGN

Before pilot, systematically inject:
- latency;
- timeout;
- duplicate;
- reordering;
- malformed payload;
- permission revocation;
- stale cache;
- partial DB failure;
- provider outage;
- artifact corruption.

Measure invariant preservation.

---

# EXEC-1177 | ACTIVE | 1177. BUG SURFACE COVERAGE MAP

Maintain matrix:

```text
Failure class
→ prevention
→ detection
→ containment
→ recovery
→ test
→ telemetry
→ owner
```

No high-risk failure class remains with all columns empty.

---

# EXEC-1178 | ACTIVE | 1178. PRODUCTION PILOT GUARDRAILS

Initial clinical pilot:
- limited facilities/users;
- controlled feature flags;
- no unsupported high-risk AI autonomy;
- on-call engineering;
- clinical safety reviewer;
- rapid kill switches;
- daily incident/near-miss review;
- predefined stop criteria.

---

# EXEC-1179 | ACTIVE | 1179. PILOT STOP CRITERIA

Examples:
- cross-patient/cross-tenant defect;
- incorrect high-risk calculation;
- critical-result loss;
- signed-record corruption;
- unexplained repeated AI unsafe claim;
- inability to reconstruct affected action.

Stop criteria are defined before pilot, not after incident.

---

# EXEC-1180 | ACTIVE | 1180. PILOT EXPANSION CRITERIA

Expand only after:
- invariant pass;
- no unresolved S0/S1;
- acceptable S2 profile;
- restore drill;
- incident process proven;
- clinician usability acceptable;
- knowledge/algorithm review current.

---

# EXEC-1181 | ACTIVE | 1181. PRODUCTION CHANGE FREEZE TRIGGERS

Temporarily freeze high-risk changes during:
- active serious incident;
- unresolved migration corruption;
- critical knowledge uncertainty;
- major infrastructure instability.

---

# EXEC-1182 | ACTIVE | 1182. SAFE HOTFIX PATH

Hotfix:
- minimal scope;
- linked incident;
- mandatory regression;
- expedited independent review;
- artifact/version bump if behavior changes;
- post-release retrospective.

No direct untracked production patch.

---

# EXEC-1183 | ACTIVE | 1183. OBSERVABILITY BEFORE FEATURE

A new high-risk feature cannot launch if its failure cannot be observed.

Instrumentation is part of implementation, not later polish.

---

# EXEC-1184 | ACTIVE | 1184. RUNBOOK BEFORE INCIDENT

C3+ workflows require recovery/runbook before production.

---

# EXEC-1185 | ACTIVE | 1185. DATA RECONCILIATION BEFORE SCALE

Do not scale tenant count before reconciliation tools can prove:
- no orphan results;
- no orphan obligations;
- no broken provenance;
- no missing artifacts.

---

# EXEC-1186 | ACTIVE | 1186. PRODUCTION ACCESS BEFORE SCALE

Operational access controls, audit and emergency procedures must exist before broad rollout.

---

# EXEC-1187 | ACTIVE | 1187. CLINICAL CONTENT OPERATIONS BEFORE SCALE

Knowledge review/freshness process must exist before accumulating hundreds of active clinical rules.

---

# EXEC-1188 | ACTIVE | 1188. VERSION DISCIPLINE BEFORE SCALE

If team cannot answer “which algorithm/knowledge/model produced this?” for every high-impact output, scaling stops.

---

# EXEC-1189 | ACTIVE | 1189. PERFORMANCE BEFORE SCALE

Benchmark against target:
- concurrent clinicians;
- patient chart size;
- result ingestion rate;
- document volume;
- AI volume.

Do not extrapolate from localhost.

---

# EXEC-1190 | ACTIVE | 1190. COST BEFORE SCALE

Measure:
- DB;
- storage;
- egress;
- queues;
- observability;
- AI;
- document processing.

Cost spikes can become availability risk.

---

# EXEC-1191 | ACTIVE | 1191. OPERATOR TRAINING

Operational team needs training for:
- kill switches;
- restore;
- patient-impact query;
- artifact rollback;
- security incident;
- clinical incident.

A runbook nobody can execute is not a control.

---

# EXEC-1192 | ACTIVE | 1192. CLINICIAN SAFETY TRAINING

Pilot clinicians understand:
- AI is assistive;
- meaning of deterministic/knowledge/AI outputs;
- unavailable states;
- reporting mechanism;
- critical workflow responsibilities.

---

# EXEC-1193 | ACTIVE | 1193. SUPPORT ESCALATION MATRIX

Support cannot independently interpret/fix clinical logic.

Escalate to:
- engineering;
- clinical safety;
- knowledge;
- security;
- regulatory

according to issue class.

---

# EXEC-1194 | ACTIVE | 1194. NANOMETRIC DEFINITION OF DONE

A production-sensitive change is not Done until:

```text
spec traced
code reviewed
types/schema valid
invariants preserved
tests pass
negative tests pass
concurrency considered
retry considered
migration considered
telemetry exists
failure UX exists
security reviewed as needed
clinical safety reviewed as needed
rollback/recovery exists
docs/runbook updated
```

---

# EXEC-1195 | ACTIVE | 1195. FINAL NANOMETRIC PRODUCTION LAW

The easiest production bugs are often created by assumptions that were never written down.

The hardest production bugs are often created by interactions between individually correct components.

Medical OS therefore assumes:

```text
requests repeat
events reorder
networks fail
clocks disagree
users double-click
tabs become stale
permissions change
providers lie accidentally
documents are malformed
knowledge changes
models hallucinate
deployments overlap
migrations encounter dirty data
caches become stale
workers crash
humans make mistakes
```

The architecture is acceptable only when these conditions produce a **controlled, observable and recoverable state rather than silent clinical corruption**.

The target is not software that never encounters failure.

The target is software in which failure is anticipated, bounded, visible, reversible where possible, and incapable of silently redefining clinical truth.
---

# EXEC-1196 | ACTIVE | 1196. 40-ENGINEER NANOSTRUCTURAL SCALE-UP

This layer converts the companion into an operating constitution for an equivalent 40-engineer senior multidisciplinary team. The purpose is not maximum code volume; it is independent ownership, adversarial review, executable contracts, production evidence and recovery for every critical property.

# EXEC-1197 | ACTIVE | 1197. 40-ENGINEER TOPOLOGY

```text
E01–E04  Technical Steering: architecture, clinical systems, security/privacy, reliability/data
E05–E10  Clinical Core: patient/MPI, encounter, longitudinal state, medication, results/obligations, integration
E11–E15  Knowledge + Computation: algorithm platform, Knowledge Engine, terminology, rules, numerical verification
E16–E20  AI + Documents: AI Gateway, clinical AI, retrieval, OCR/documents, AI safety/evals
E21–E25  Platform + Data: Postgres/Neon, workflows/outbox, search/projections, storage, runtime/config
E26–E29  Security + Identity: authentication, authorization/RLS, AppSec, privacy/crypto/audit
E30–E33  Experience: design system, Patient Workspace, Encounter UX, mobile/patient UX
E34–E36  Interop + Operations: FHIR/HL7/DICOM, communications/scheduling, Country Packs/adapters
E37–E40  Quality + Reliability: test architecture, SRE, performance/chaos/DR, release/supply-chain evidence
```
Clinical, pharmacy, laboratory, radiology, human-factors, regulatory and penetration-test reviewers remain independent expert functions; engineering does not replace them.

# EXEC-1198 | ACTIVE | 1198. DUAL OWNERSHIP

Every C4/C5 capability has a primary engineer and a challenger from another specialty, plus clinical/safety review when applicable. Author, expected-behavior designer and sole validator cannot be the same person.

# EXEC-1199 | ACTIVE | 1199. CAPABILITY OWNERSHIP REGISTRY

Maintain machine-readable capability metadata: risk class, primary/challenger/clinical owners, requirements, invariants, APIs, tables, events, algorithms, knowledge artifacts, dashboards, runbooks and release gates. CI rejects incomplete C4/C5 ownership.

# EXEC-1200 | ACTIVE | 1200. ARCHITECTURE COUNCIL

E01–E04 own dependency direction, ADR quality, cross-domain invariants, complexity budgets and architecture fitness functions. New microservices, databases, queues, DSLs, model providers or trust boundaries require problem, alternatives, failure modes, clinical/security impact, operational cost, migration, rollback and exit strategy.

# EXEC-1201 | ACTIVE | 1201. MODULAR MONOLITH ENFORCEMENT

The baseline remains a modular monolith until evidence justifies extraction. CI enforces package boundaries, forbidden imports, domain ownership and prohibition of UI→DB, AI→signed-record and cross-domain repository shortcuts.

# EXEC-1202 | ACTIVE | 1202. CLINICAL SEMANTIC KERNEL

Create a small governed kernel: PatientRef, EncounterRef, ClinicalQuantity, ClinicalCode, ClinicalDate, ClinicalInstant, SourceRef, ProvenanceRef, AlgorithmVersionRef, KnowledgeArtifactRef, InformationState and VerificationStatus. Keep it stable and dependency-light.

# EXEC-1203 | ACTIVE | 1203. OPAQUE TYPES

PatientId ≠ EncounterId; TenantId ≠ OrganizationId; mg ≠ mL; ClinicalDate ≠ Instant. Use branded/opaque types so semantically different primitives cannot be interchanged accidentally.

# EXEC-1204 | ACTIVE | 1204. DIMENSIONAL QUANTITY SYSTEM

Clinical quantities model exact value, dimension, canonical unit, original unit/value, precision, comparator and conversion provenance. A free `{value:number, unit:string}` is insufficient for C4/C5 arithmetic.

# EXEC-1205 | ACTIVE | 1205. EXACT DECIMAL ENGINE

Adopt one exact decimal strategy for safety-critical arithmetic with explicit scale and rounding mode. Binary floating arithmetic is not authoritative for dose/threshold logic without documented proof. Maintain golden serialization and rounding vectors.

# EXEC-1206 | ACTIVE | 1206. COMPUTATION AUTHORITY MATRIX

Every capability declares authority: DETERMINISTIC, KNOWLEDGE, AI_ASSISTED, PHYSICIAN or HYBRID; and mutation authority: READ_ONLY, DRAFT_ONLY, PHYSICIAN_COMMIT or SYSTEM_COMMIT. Invalid combinations are design errors.

# EXEC-1207 | ACTIVE | 1207. DETERMINISTIC FIRST CODE GATE

Exact arithmetic, unit conversion, date intervals, validated formulas, authorization, state transitions and exact threshold comparisons cannot use generative AI as authoritative calculator. AI may explain, never replace exact computation.

# EXEC-1208 | ACTIVE | 1208. ALGORITHM MANIFEST

Every released C4/C5 algorithm records ID/version/hash, sources, applicability, schemas, unit policy, rounding, missing-data behavior, reference vectors, reviewers, activation and retirement. Historical executions remain reproducible.

# EXEC-1209 | ACTIVE | 1209. INDEPENDENT REFERENCE IMPLEMENTATION

Where feasible, maintain a production implementation and an independently implemented test oracle that does not share all helpers. Continuously compare generated/boundary cases.

# EXEC-1210 | ACTIVE | 1210. METAMORPHIC AND PROPERTY TESTING

Define properties where exhaustive oracles are impossible: unit-equivalent inputs preserve physical result; unrelated chart facts cannot change BMI; duplicate idempotent events do not double-apply; reordering independent observations does not change normalized state.

# EXEC-1211 | ACTIVE | 1211. NUMERICAL BOUNDARY FACTORY

Generate exact threshold, epsilon-below/above, zero, negative, extreme, precision-limit and equivalent-unit cases. Boundary coverage is release evidence, not optional unit-test decoration.

# EXEC-1212 | ACTIVE | 1212. ALGORITHM PROOF OBLIGATION

Each C5 PR answers: what is computed, why applicable, required inputs, missing-data behavior, dimensions, rounding stage, maxima/minima, invalidators and authoritative sources.

# EXEC-1213 | ACTIVE | 1213. ALGORITHM FACTORY

Provide a scaffold: typed contract → source/formula → applicability → units/rounding → implementation → generated property/boundary tests → independent vectors → clinical review → benchmark → manifest → shadow → release. Speed comes from standardized rigor.

# EXEC-1214 | ACTIVE | 1214. ALGORITHM SDK

Central approved primitives for exact decimal, quantities, dates/age, thresholds, result unions, explanation graphs, provenance and versioning. Feature developers must not recreate these primitives.

# EXEC-1215 | ACTIVE | 1215. ALGORITHM RESULT UNION

Never encode failure as 0/null/NaN. Use typed outcomes: SUCCESS, NOT_APPLICABLE, INSUFFICIENT_INFORMATION, INVALID_INPUT, UNSUPPORTED, DEPENDENCY_UNAVAILABLE, INTERNAL_ERROR.

# EXEC-1216 | ACTIVE | 1216. DERIVED FACT LINEAGE

A displayed derived fact traces to exact patient inputs, source observations, units, algorithm/version, knowledge/version if used, execution time and explanation. Dependency changes mark it stale and can trigger governed recomputation.

# EXEC-1217 | ACTIVE | 1217. KNOWLEDGE ENGINE PLANES

```text
SOURCE → EVIDENCE → SEMANTIC → COMPILATION → VALIDATION → RELEASE → RUNTIME → OBSERVABILITY
```
There is no Source→Runtime shortcut.

# EXEC-1218 | ACTIVE | 1218. KNOWLEDGE SOURCE REGISTRY

Track issuer, title, jurisdiction, specialty, publication/effective dates, supersession, retrieval metadata, content hash, license, authority tier, evidence type, review status and freshness owner.

# EXEC-1219 | ACTIVE | 1219. KNOWLEDGE PROPOSITION MODEL

Decompose guidance into atomic propositions: population, condition, action, strength, exceptions, timing, threshold/unit, evidence, jurisdiction and effective period. Preserve source text as evidence/context, not executable truth.

# EXEC-1220 | ACTIVE | 1220. TYPED KNOWLEDGE IR

Compile propositions to a typed IR supporting boolean logic, temporal operators, comparisons, quantified conditions, exceptions and explicit TRUE/FALSE/UNKNOWN/NOT_APPLICABLE/UNVERIFIED states. Unknown never silently becomes false.

# EXEC-1221 | ACTIVE | 1221. KNOWLEDGE APPLICABILITY

Applicability can depend on exact age, pregnancy/context, jurisdiction, problem state, medications, renal/hepatic state, encounter context and time. Missing applicability facts yield unknown/insufficient information, never plausible defaults.

# EXEC-1222 | ACTIVE | 1222. KNOWLEDGE CONFLICT GRAPH

Detect overlapping populations/time with incompatible recommendations or thresholds. Conflict is explicit and governed; iteration order, source name or latest timestamp cannot silently decide precedence.

# EXEC-1223 | ACTIVE | 1223. KNOWLEDGE STATIC ANALYSIS

Compiler rejects or flags unreachable rules, contradictory branches, missing units, circular dependencies, undefined terminology, ambiguous exceptions, uncovered unknown states, impossible intervals and priority ties.

# EXEC-1224 | ACTIVE | 1224. KNOWLEDGE GENERATED TESTS

IR generates positive, negative, boundary, missing-data, exception and conflict tests. Clinical reviewers add adversarial cases specifically designed to invert negation, timing and exception semantics.

# EXEC-1225 | ACTIVE | 1225. KNOWLEDGE BEHAVIORAL DIFF

Before activation, execute old/new artifacts over synthetic cohorts and report newly triggered, removed, severity-changed, timing-changed and population-changed behavior.

# EXEC-1226 | ACTIVE | 1226. KNOWLEDGE BLAST RADIUS

Estimate affected patients, obligations, care gaps, medication checks and decision-support surfaces before high-impact activation, using privacy-preserving aggregate analysis where appropriate.

# EXEC-1227 | ACTIVE | 1227. KNOWLEDGE RELEASE TRAIN

DRAFT → TECHNICALLY_VALIDATED → CLINICALLY_REVIEWED → SHADOW → APPROVED → CANARY → ACTIVE → SUPERSEDED/RETIRED. Rollback switches to a previously approved complete set; no version is erased.

# EXEC-1228 | ACTIVE | 1228. KNOWLEDGE INCIDENT IMPACT

Given artifact/version, identify executions, potentially affected patients, outputs and linked downstream actions. This capability is mandatory before large-scale automated clinical knowledge.

# EXEC-1229 | ACTIVE | 1229. KNOWLEDGE EXPLANATION GRAPH

Every recommendation can explain why it triggered, which patient facts matched, which were missing, which exception paths were considered and exact rule/source/version.

# EXEC-1230 | ACTIVE | 1230. KNOWLEDGE INCREMENTAL EVALUATION

Index rules by concept/population/event/dependency and reevaluate only affected subsets. Full deterministic rebuild remains available for reconciliation.

# EXEC-1231 | ACTIVE | 1231. KNOWLEDGE SUPPLY CHAIN

Source acquisition, transformation, reviewer, compiler, build environment, hashes/signatures, artifact registry and runtime loading are a clinical content supply chain with independent integrity controls.

# EXEC-1232 | ACTIVE | 1232. CLINICAL BILL OF MATERIALS

Every environment/release identifies exact app commit, DB migration, algorithm set, knowledge set, terminology release, AI task configs, prompt policies and clinical configuration. Compatibility is checked before serving.

# EXEC-1233 | ACTIVE | 1233. TERMINOLOGY INFRASTRUCTURE

Terminology is versioned infrastructure: code systems, value sets, concept maps, synonyms, retirement and provenance. All coding flows use one governed terminology boundary; historical codes remain interpretable.

# EXEC-1234 | ACTIVE | 1234. LAB SEMANTIC MODEL

A laboratory observation supports analyte/code, numeric/qualitative value, comparator, unit, reference interval, abnormal flag, specimen, method, effective/issued time, source and correction status.

# EXEC-1235 | ACTIVE | 1235. LAB NORMALIZATION PIPELINE

Source → patient/result identity → analyte resolution → value parsing → unit resolution → normalization → source preservation → plausibility → longitudinal placement → deterministic trend → review workflow.

# EXEC-1236 | ACTIVE | 1236. TREND ENGINE

Compute deterministic absolute/percent delta, slope where meaningful, persistence, direction and baseline-relative change using clinically meaningful effective times. AI only contextualizes the computed trajectory.

# EXEC-1237 | ACTIVE | 1237. TREND COMPARABILITY

Do not compare incompatible units, uncertain analyte mappings, qualitative vs quantitative results or clinically noncomparable methods without explicit normalization policy.

# EXEC-1238 | ACTIVE | 1238. PATIENT STATE PIPELINE

Authoritative facts → normalized facts → lifecycle state → deterministic derived facts → knowledge evaluations → unresolved obligations → longitudinal summaries → AI assistive views. AI is never the source-of-truth layer.

# EXEC-1239 | ACTIVE | 1239. PATIENT STATE SNAPSHOT

Snapshots carry as-of version/time, source watermark, computation/knowledge versions and degraded/completeness flags. Read models are rebuildable and can be shadow-compared before projector cutover.

# EXEC-1240 | ACTIVE | 1240. INTERFACE STRUCTURAL SHELL

Desktop baseline: persistent patient rail/identity, central Clinical Workspace, contextual Intelligence Rail. Central work remains primary; AI cannot dominate the physician's task.

# EXEC-1241 | ACTIVE | 1241. PATIENT IDENTITY HEADER

Patient-bound screens keep sufficient textual identity visible during high-impact actions. Color/avatar alone is never identity. Route transitions must not transiently show patient B header over patient A data.

# EXEC-1242 | ACTIVE | 1242. INFORMATION HIERARCHY

Priority: patient identity → immediate safety → current task → current state → pending obligations/results → supporting history → AI/secondary intelligence.

# EXEC-1243 | ACTIVE | 1243. INFORMATION STATE LANGUAGE

Visually and semantically distinguish unknown, not assessed, absent, negative, pending, unavailable, not applicable, verified and AI suggested. One dash cannot represent all.

# EXEC-1244 | ACTIVE | 1244. DESIGN TOKEN SYSTEM

Govern color, typography, spacing, radius, elevation, motion, z-index, focus, density and semantic severity. Brand colors and clinical severity colors are separate systems.

# EXEC-1245 | ACTIVE | 1245. CLINICAL NUMERIC TYPOGRAPHY

Use tabular numerals where useful, attach units to values, preserve sufficient threshold precision and avoid display rounding that appears to contradict classification.

# EXEC-1246 | ACTIVE | 1246. COMMAND CENTER

Home is operational clinical intelligence: critical results, overdue obligations, today encounters, unsigned drafts, failed communications and degraded capabilities. A zero appears only after a successful zero-result query.

# EXEC-1247 | ACTIVE | 1247. PRE-VISIT INTELLIGENCE

Surface reason, recent changes, chronic problems, meds/allergies, pending results, overdue follow-up and abnormal trends with source links. Deterministic/knowledge engines own designated safety-critical pending items.

# EXEC-1248 | ACTIVE | 1248. ENCOUNTER FLOW

Identity/antecedents → vitals → HPI/adaptive history → prior studies → physical exam → assessment/differential → decision checkpoint → plan → prescription/orders → follow-up obligations → review/sign. Nonlinear navigation is allowed with tracked clinical completeness.

# EXEC-1249 | ACTIVE | 1249. COVERAGE MAP

Coverage is clinically relevant, not percentage of filled fields. Return covered, missing, not applicable, deferred and unknown against a versioned Clinical Pack; avoid gamified checkbox scores.

# EXEC-1250 | ACTIVE | 1250. ADAPTIVE HISTORY

Question graph uses stable IDs, typed answers, dependencies, applicability and versioned branching. Editing an upstream answer reevaluates hidden branches so stale hidden values cannot silently submit.

# EXEC-1251 | ACTIVE | 1251. PHYSICAL EXAM SAFETY

Never prepopulate normal findings or negative ROS as observed. Templates present choices; clinician observation creates the fact.

# EXEC-1252 | ACTIVE | 1252. DIFFERENTIAL WORKSPACE

Hypothesis object contains candidate condition, status, supporting evidence, contradicting evidence, missing evidence, suggestion source and clinician disposition. Repeated mention never auto-promotes a hypothesis to confirmed problem.

# EXEC-1253 | ACTIVE | 1253. DECISION CHECKPOINT

Before designated high-impact actions, evaluate unresolved critical allergy, severe interaction, critical result, missing required weight, major contradiction and mandatory safety facts. Hard blocks are rare and clinically governed.

# EXEC-1254 | ACTIVE | 1254. ALERT ARCHITECTURE

Alerts have hazard identity, severity, rationale, source, next action and governed override. Deduplicate multiple engines reporting one hazard; monitor burden/override/action to control fatigue.

# EXEC-1255 | ACTIVE | 1255. PRESCRIPTION STUDIO

Separate clinical prescription content from rendering template, branding and country/legal requirements. Preview and PDF share one canonical render model. Required legal fields cannot be removed by customization.

# EXEC-1256 | ACTIVE | 1256. MEDICATION SAFETY PIPELINE

Canonical drug → formulation → indication/context → allergies → active meds → duplication → interactions → renal/hepatic → age/weight → deterministic dose → maxima → administration feasibility → physician decision.

# EXEC-1257 | ACTIVE | 1257. MEDICATION SAFETY UNAVAILABLE

Differentiate “checked and none found” from “check unavailable”, unsupported drug or incomplete medication list. Never render blanket safe state after dependency failure.

# EXEC-1258 | ACTIVE | 1258. PEDIATRIC DOSE STRUCTURE

Exact age + fresh/verified weight + unit normalization + indication + source + mg/kg or mg/kg/day semantics + maxima + concentration + measurable volume + rounding policy + physician-selected dose + provenance.

# EXEC-1259 | ACTIVE | 1259. PRESCRIPTION AUTHORITY

Calculated dose and prescribed dose are distinct. The physician's selected prescription is explicit, and overrides retain rationale/version/audit where policy requires.

# EXEC-1260 | ACTIVE | 1260. RESULT INBOX

Prioritize critical, actionable abnormal, corrected, unreviewed, unmatched and routine results using deterministic/governed policy. Filters cannot make underlying work disappear from reconciliation.

# EXEC-1261 | ACTIVE | 1261. RESULT CLOSED LOOP

Received ≠ reviewed ≠ actioned ≠ patient informed ≠ closed. Corrections can reopen review/obligations; acknowledgement by two clinicians remains concurrency-safe.

# EXEC-1262 | ACTIVE | 1262. OBLIGATION CENTER

Every obligation exposes what, why, patient, owner, due, source, status, escalation and next action. Recurrence creates explicit occurrences/state; snooze never equals closure.

# EXEC-1263 | ACTIVE | 1263. ZERO LOST FOLLOW-UP RECONCILIATION

Independent reconciliation continuously searches for results, plans, referrals, monitoring and communications that imply pending clinical work without a valid owned lifecycle.

# EXEC-1264 | ACTIVE | 1264. DOCUMENT INTELLIGENCE

Original immutable document + quarantine + extraction candidate + page/span provenance + human verification + structured facts. OCR/AI output is never automatically verified clinical truth.

# EXEC-1265 | ACTIVE | 1265. DOCUMENT SIDE-BY-SIDE

High-risk extraction verification shows source region/page beside candidate value/unit. Handle rotated, cropped, multi-column, multi-patient, password-protected, truncated and malformed documents explicitly.

# EXEC-1266 | ACTIVE | 1266. AI INTERFACE

AI is ambient/contextual: pre-visit, inline assist, summarize, explain trend, draft, chart Q&A and missing-evidence suggestions. Avoid a generic chatbot as the primary clinical operating model.

# EXEC-1267 | ACTIVE | 1267. AI TASK REGISTRY

Register each use case separately with task ID/version, intended/prohibited use, risk tier, context, allowed data, model policy, knowledge policy, tools, schema, timeout, evals and human authority.

# EXEC-1268 | ACTIVE | 1268. AI GATEWAY

Domain code cannot import provider model SDKs. Gateway performs routing, context minimization, provider policy, schema validation, task/version capture, telemetry and kill switches.

# EXEC-1269 | ACTIVE | 1269. AI CLAIM-EVIDENCE CONTRACT

Evidence-grounded tasks link material claims to supplied source IDs/spans when feasible. Missing retrieval is explicit; model memory cannot masquerade as approved evidence.

# EXEC-1270 | ACTIVE | 1270. AI CONTEXT BINDING

Server builds patient/tenant-bound context. Async responses carry request/patient/encounter identity and are discarded if stale or switched. Context truncation is observable and can force abstention.

# EXEC-1271 | ACTIVE | 1271. AI PROMPT VERSIONING

Prompts and policies are repository-controlled, reviewed, tested and versioned. No ad-hoc production edits in provider consoles.

# EXEC-1272 | ACTIVE | 1272. AI MODEL ROUTING

Route by task, risk, capability, language, privacy, latency, cost and current evaluation status. Cost/latency cannot select a model outside approved safety/quality envelope.

# EXEC-1273 | ACTIVE | 1273. AI OUTPUT UNION

SUCCESS, ABSTAINED, UNSUPPORTED, INSUFFICIENT_CONTEXT, PROVIDER_FAILURE, SCHEMA_FAILURE and SAFETY_BLOCKED remain distinct through UI.

# EXEC-1274 | ACTIVE | 1274. AI EVALUATION

Per-task metrics include factual support, omission, harmful fabrication, citation accuracy, schema validity, refusal, latency, robustness, language/subgroup behavior where relevant and human-factors effects such as anchoring/overreliance.

# EXEC-1275 | ACTIVE | 1275. AI SHADOW AND HOLDOUT

Candidate model/config runs on hidden/adversarial holdouts and shadow workload before exposure. Clinician accept/reject feedback does not automatically retrain production behavior.

# EXEC-1276 | ACTIVE | 1276. AI DEGRADED CORE

With AI fully disabled, chart, identity, encounters, meds, deterministic calculations, orders/results, obligations, critical alerts, audit and follow-up remain safe and functional.

# EXEC-1277 | ACTIVE | 1277. SECURITY THREAT MODELS

Each major domain maintains assets, trust boundaries, attackers, abuse cases, controls and residual risk. Security framework mappings supplement—not replace—Medical OS-specific threat modeling.

# EXEC-1278 | ACTIVE | 1278. TENANT ISOLATION

Test list/read/create/update/export/search/background/vector/document access across tenants. RLS, app authz, cache keys, search filters and worker context form defense in depth.

# EXEC-1279 | ACTIVE | 1279. RLS POOL SAFETY

Any DB session context is transaction-local/reset and tested under pooled/serverless behavior. Cross-tenant context leakage is a release-blocking defect.

# EXEC-1280 | ACTIVE | 1280. PRIVILEGED ADMIN PLANE

Tenant administration, knowledge activation, algorithm release, bulk export and privilege changes use stronger isolated controls. No hidden universal support/admin bypass.

# EXEC-1281 | ACTIVE | 1281. PRIVACY DATA INVENTORY

Every data class records purpose, sensitivity, storage, processors, retention, access, export and correction/deletion constraints. PHI egress routes are explicitly catalogued.

# EXEC-1282 | ACTIVE | 1282. PHI EGRESS CONTROL

AI providers, communications, interoperability, exports and support receive minimum necessary data. Automated sentinel tests ensure forbidden PHI/secrets do not leak into logs or provider payloads.

# EXEC-1283 | ACTIVE | 1283. SUPPLY CHAIN SECURITY

Controlled CI builds, SBOM/provenance, dependency/license/vulnerability review, secret scanning, SAST/SCA/IaC checks and independent penetration testing before broad production.

# EXEC-1284 | ACTIVE | 1284. OBSERVABILITY CONTRACT

Critical workflows emit start, state transitions, failure class, latency and completion correlation without raw PHI. Clinical SLIs include critical-result visibility, obligation lag, Patient State freshness, audit success and algorithm/knowledge resolution.

# EXEC-1285 | ACTIVE | 1285. SAFETY BUDGET

Cross-tenant disclosure, wrong-patient mutation, silent critical-result loss and signed-record corruption are not normal SLO errors. They trigger stop/incident policies.

# EXEC-1286 | ACTIVE | 1286. RECONCILIATION DASHBOARD

Operations can see orphan results, stuck obligations, failed outbox, stale projections, storage mismatches, knowledge load errors and algorithm failures. Reconciliation is independent of the primary path.

# EXEC-1287 | ACTIVE | 1287. INCIDENT PATIENT IMPACT

Serious incident tooling queries potentially affected records/actions by time, code version, algorithm, knowledge, model task, provider and tenant. Recovery is incomplete until reconciliation completes.

# EXEC-1288 | ACTIVE | 1288. NEAR-MISS ENGINEERING

Capture prevented wrong-patient actions, suppressed duplicates, unsafe AI rejects and caught dose errors. Near misses become regression/property controls.

# EXEC-1289 | ACTIVE | 1289. PERFORMANCE BUDGETS

Define p50/p95/p99 targets by patient search, Workspace, save, prescription, Result Inbox and Patient State refresh. Benchmark pathological long charts, skewed tenants and hours-long browser sessions.

# EXEC-1290 | ACTIVE | 1290. SERVERLESS / NEON REALITY

Test cold starts, connection pooling, transaction semantics, RLS context, read-after-write and long-running jobs. Durable workflows must not depend on a request lifespan.

# EXEC-1291 | ACTIVE | 1291. QUEUE PRIORITIES

Separate critical clinical, interactive, normal and bulk work where justified. Monitor oldest-message age, not count alone; dead letters require owner and repair action.

# EXEC-1292 | ACTIVE | 1292. DEPLOYMENT COMPATIBILITY

Use expand → compatible readers → writers → backfill → verify → later contract. Old/new app versions, event schemas and DB schema coexist safely during rolling deploys.

# EXEC-1293 | ACTIVE | 1293. CLINICAL BOM STARTUP GATE

Before serving high-risk computation, verify app/migration/algorithm/knowledge/terminology/config compatibility and artifact integrity. Partial startup exposes explicit degraded capabilities.

# EXEC-1294 | ACTIVE | 1294. DISASTER RECOVERY

RPO/RTO are defined and measured separately for chart, documents, audit, artifacts and workflows. Restore drills prevent replay of already-completed external side effects.

# EXEC-1295 | ACTIVE | 1295. HUMAN FACTORS HAZARD LOG

Track wrong patient, wrong dose, hidden result, ambiguous unit, alert overload, destructive defaults, interruption and lost drafts. UI mitigations map to tests and clinician validation.

# EXEC-1296 | ACTIVE | 1296. COGNITIVE LOAD BUDGET

Each screen limits simultaneous primary decisions. Secondary intelligence uses progressive disclosure; critical identity/safety/current task never disappear beneath AI or analytics.

# EXEC-1297 | ACTIVE | 1297. INTERRUPTION RECOVERY

After interruption, physician immediately sees patient, current task, unsaved state, new information and pending decision. Session reauthentication preserves drafts but revalidates authorization.

# EXEC-1298 | ACTIVE | 1298. NANOSTRUCTURAL UI CONTRACT

Every high-risk surface documents user, decision, patient identity, read model, freshness, mutations, permissions, information states, loading/error/degraded behavior, keyboard/mobile behavior and tests.

# EXEC-1299 | ACTIVE | 1299. PIXEL-TO-SEMANTIC TRACEABILITY

Every visible clinical status/control maps to a domain state/source/action/permission/test. No decorative clinical-looking indicator without a semantic contract.

# EXEC-1300 | ACTIVE | 1300. UI STATE MACHINES

Critical flows use explicit typed states instead of contradictory booleans. Prescription example: editing → validating → ready → submitting → committed | conflict | failed.

# EXEC-1301 | ACTIVE | 1301. ROUTE TRANSITION ATOMICITY

Patient switch cancels/isolates old async work, clears sensitive state, loads new identity and only then renders new workspace. Stale old responses cannot hydrate the new patient.

# EXEC-1302 | ACTIVE | 1302. SAFE LOADING AND EMPTY STATES

“No data” differs from loading, unavailable, permission denied and filtered out. Skeletons cannot leave prior-patient values visible beneath a new header.

# EXEC-1303 | ACTIVE | 1303. CLINICAL DESIGN SYSTEM

Provide safe PatientPicker, ClinicalQuantityInput, DoseInput, ClinicalCodePicker, Date/Instant components, severity, source/provenance, multi-state unknown inputs, clinical tables and semantic diff components.

# EXEC-1304 | ACTIVE | 1304. ACCESSIBILITY

Critical flows require keyboard, screen-reader, zoom, reduced-motion, touch and color-independent severity support. Automated checks are necessary but manual clinical usability remains required.

# EXEC-1305 | ACTIVE | 1305. RESPONSIVE PRIORITY

On smaller screens collapse secondary analytics/history detail/intelligence before patient identity, current task and critical safety. Responsive does not mean every desktop capability belongs on mobile.

# EXEC-1306 | ACTIVE | 1306. PRINT/PDF SAFETY

Canonical server/client render model, stable fonts, multi-page patient identity, safe page breaks, long-name/many-medication golden cases and reproducible hashes linked to signed semantic content.

# EXEC-1307 | ACTIVE | 1307. 40-ENGINEER REVIEW CELLS

Create focused review cells: data model; state machine; numerical; knowledge; AI; security; UX safety; reliability. Rotate challengers to reduce shared blind spots.

# EXEC-1308 | ACTIVE | 1308. AI CODING AGENT GOVERNANCE

Agents receive issue, requirements, scope, prohibited changes, risk, files, tests and stop conditions. They use no production PHI/secrets, do not deploy production or self-approve C4/C5 changes.

# EXEC-1309 | ACTIVE | 1309. SECOND-AGENT CHALLENGE

For selected high-risk changes, a separate reviewer/agent asks how it crosses tenants, duplicates, uses stale state, fails after commit, mishandles units, survives dependency outage and processes out-of-order events.

# EXEC-1310 | ACTIVE | 1310. TEST ARCHITECTURE

Risk-driven layers: static/type → unit → property → integration → contract → E2E → adversarial → performance → chaos → clinical validation. Expected values must not be generated by the same code under test.

# EXEC-1311 | ACTIVE | 1311. SYNTHETIC PATIENT FACTORY

Generate age groups, pregnancy contexts, renal/hepatic states, polypharmacy, allergies, chronic disease, long charts, contradictory and missing data, while avoiding identifiable real patient data.

# EXEC-1312 | ACTIVE | 1312. SHADOW CLINIC

Permanent accelerated-time synthetic clinic with concurrent clinicians, labs, corrections, meds, documents, obligations, AI, outages, retries, merges, migrations and years of virtual follow-up.

# EXEC-1313 | ACTIVE | 1313. FAULT INJECTION

Inject latency, timeout, duplicate, reordering, malformed payload, permission revocation, stale cache, DB/provider outage, artifact corruption and uncertain commit. Pass only if clinical invariants remain true.

# EXEC-1314 | ACTIVE | 1314. FORMAL METHODS CANDIDATES

Use model checking/formal techniques selectively for authorization, result/obligation state machines, critical distributed retry semantics and unit invariants when benefit exceeds complexity. Do not pretend brute force covers infinite state.

# EXEC-1315 | ACTIVE | 1315. PROPERTY REGISTRY

Machine-readable global properties such as tenant isolation, signed immutability, result no-orphan, obligation ownership, algorithm reproducibility and AI non-authority. Each links to prevention, tests, reconciliation and monitoring.

# EXEC-1316 | ACTIVE | 1316. CONTINUOUS ASSURANCE

Aggregate CI, security, property tests, restore drills, knowledge freshness, AI evals, runtime SLIs and incident evidence. Evidence has expiry; M6 requires current evidence after release.

# EXEC-1317 | ACTIVE | 1317. RISK CLASSES

C0 cosmetic, C1 administrative, C2 workflow, C3 clinical informational, C4 clinical decision influence, C5 safety critical. This is engineering governance, not regulatory classification. Risk follows actual use and composite workflow.

# EXEC-1318 | ACTIVE | 1318. MATURITY PER CAPABILITY

M0 Concept → M1 Specified → M2 Implemented → M3 Verified → M4 Clinically validated → M5 Production hardened → M6 Continuously assured. Production admission depends on risk-specific maturity.

# EXEC-1319 | ACTIVE | 1319. GOLDEN JOURNEYS

Maintain end-to-end golden journeys for pediatric prescription, critical result, chronic longitudinal care, document intelligence, AI-assisted encounter, tenant isolation, disaster recovery, knowledge release and algorithm release.

# EXEC-1320 | ACTIVE | 1320. 40-ENGINEER WAVES

Wave A foundations; Wave B clinical core; Wave C closed loops; Wave D algorithms/knowledge/documents/AI; Wave E ecosystem; Wave F hardening. Parallelize behind stable contracts, not by building 40 disconnected features.

# EXEC-1321 | ACTIVE | 1321. FIRST VERTICAL SLICE

Authenticate → tenant → synthetic patient search → Patient Workspace → encounter → vitals → one deterministic derived fact → note draft → obligation → sign → audit/outbox → longitudinal reopen. Prove architecture before AI.

# EXEC-1322 | ACTIVE | 1322. SECOND VERTICAL SLICE

Medication/allergy → deterministic dose → physician-selected prescription → canonical PDF → provenance/audit → reload. Exercise exact decimal, units and authority separation.

# EXEC-1323 | ACTIVE | 1323. THIRD VERTICAL SLICE

Order → synthetic result → critical/abnormal classification → Result Inbox → review/action → obligation → correction/reopen. Prove zero-lost-follow-up lifecycle.

# EXEC-1324 | ACTIVE | 1324. FOURTH VERTICAL SLICE

One synthetic Clinical Pack through source registry → proposition → IR/compiler → tests → review → runtime explanation → shadow update. Prove Knowledge Engine before scaling content.

# EXEC-1325 | ACTIVE | 1325. FIFTH VERTICAL SLICE

Private document upload → quarantine → OCR/extraction → side-by-side verification → structured fact → provenance → search. Prove document intelligence without treating AI as truth.

# EXEC-1326 | ACTIVE | 1326. SIXTH VERTICAL SLICE

AI Gateway → one pre-visit summary task → minimized structured context → evidence refs → schema/eval → physician display → provider outage fallback.

# EXEC-1327 | ACTIVE | 1327. TRACEABILITY GRAPH

Machine-readable V2 requirement → V2.1 implementation → Companion law → issue → code → test → evidence → release. Detect orphan requirements and critical code without requirement/ADR.

# EXEC-1328 | ACTIVE | 1328. ARCHITECTURE FITNESS SUITE

Automate dependency DAG, forbidden imports, write-path restrictions, model SDK boundary, tenant query rules, public bucket checks, raw clinical threshold detection and UI→DB prohibition.

# EXEC-1329 | ACTIVE | 1329. STATIC CLINICAL LINTING

Custom lint candidates: raw `number` for C5 quantity, `Date.now()` in clinical packages, magic clinical literals, direct model SDK import, unscoped tenant query, index key in mutable clinical list and raw critical colors.

# EXEC-1330 | ACTIVE | 1330. RELEASE EVIDENCE PACK

Exact commit/tag, SBOM, migrations, Clinical BOM, tests, security scans, algorithm/knowledge diffs, AI evals, approvals, rollout, observation window and rollback/reconciliation plan.

# EXEC-1331 | ACTIVE | 1331. STOP-THE-LINE

Any engineer may stop a high-risk release for evidence-backed safety/security concern. S0 examples: cross-tenant PHI, wrong-patient mutation, signed-record corruption, dangerous deterministic dose error, silent critical-result loss.

# EXEC-1332 | ACTIVE | 1332. NO HERO ENGINEERING

Critical domains require at least two capable engineers, versioned docs, tests, dashboards and runbooks. Production cannot depend on one person remembering hidden behavior.

# EXEC-1333 | ACTIVE | 1333. ASSUMPTION REGISTER

Every subsystem lists assumptions—clock trust, source units, eventual webhooks, catalog availability—with validation, monitoring and fallback. Hidden-assumption hunting is a formal review activity.

# EXEC-1334 | ACTIVE | 1334. FAILURE POLICY REGISTRY

For each dependency/action define block, warn, degrade, queue or manual override behavior. There is no universal fail-closed rule for medicine; the policy is explicit and clinically reviewed.

# EXEC-1335 | ACTIVE | 1335. NO SILENT SEMANTIC FALLBACK

Unresolved unit, patient, terminology, knowledge, applicability or authorization cannot select a plausible default. Explicit unknown/unavailable/blocked state is safer than fabricated certainty.

# EXEC-1336 | ACTIVE | 1336. NO SILENT AUTHORITY ESCALATION

Persistence does not turn an AI suggestion or knowledge recommendation into clinician fact. Authority class remains explicit through lifecycle.

# EXEC-1337 | ACTIVE | 1337. NO SILENT VERSION DRIFT

Every high-impact runtime output identifies versioned app/algorithm/knowledge/terminology/model/config dependencies needed for investigation.

# EXEC-1338 | ACTIVE | 1338. NO SILENT DATA LOSS

Closed-loop/asynchronous workflows have independent reconciliation capable of detecting missing expected state, orphan work and ambiguous external side effects.

# EXEC-1339 | ACTIVE | 1339. NO SILENT PATIENT SWITCH

Every patient-bound request, job, cache entry, AI task, modal, realtime subscription and mutation remains patient/tenant-bound through completion.

# EXEC-1340 | ACTIVE | 1340. NO SILENT SAFETY CHECK FAILURE

A failed allergy/interaction/knowledge/terminology safety dependency is rendered unavailable, never as “no issue found”.

# EXEC-1341 | ACTIVE | 1341. NO SILENT MIGRATION REINTERPRETATION

Schema/data migrations cannot change historical clinical meaning without explicit transformation, version/provenance and reconciliation.

# EXEC-1342 | ACTIVE | 1342. NO SILENT RESTORE REPLAY

Disaster recovery cannot resend patient communications/orders/webhooks blindly. External side-effect ledgers and provider reconciliation determine what already happened.

# EXEC-1343 | ACTIVE | 1343. NANOSTRUCTURAL CAPABILITY CONTRACT

Every capability is decomposed: INTENT → AUTHORITY → INPUT → SEMANTICS → STATE → COMPUTATION → KNOWLEDGE → DECISION SUPPORT → ACTION → SIDE EFFECT → PROVENANCE → AUDIT → OBSERVABILITY → FAILURE → RECOVERY → EVIDENCE.

# EXEC-1344 | ACTIVE | 1344. NANOSTRUCTURAL INTERFACE CONTRACT

Every high-risk interaction: WHO → TENANT → PATIENT → ENCOUNTER → STATE → SOURCE → ACTION → VERSION → FAILURE → USER FEEDBACK → SERVER ENFORCEMENT → AUDIT → RECOVERY.

# EXEC-1345 | ACTIVE | 1345. NANOSTRUCTURAL COMPUTATION CONTRACT

Every high-risk computation: applicability → source inputs → freshness → units → normalization → exact arithmetic → boundaries → missing data → output state → explanation → version → provenance → validation → monitoring.

# EXEC-1346 | ACTIVE | 1346. NANOSTRUCTURAL KNOWLEDGE CONTRACT

Every recommendation: source identity → authority → version → proposition → terminology → population → condition → exception → time → action → conflict → test → reviewer → release → explanation → freshness.

# EXEC-1347 | ACTIVE | 1347. NANOSTRUCTURAL AI CONTRACT

Every AI output: task → intended use → context → authorization → evidence → model/config → tools → schema → validation → safety → uncertainty → human authority → audit → eval → monitoring → kill switch.

# EXEC-1348 | ACTIVE | 1348. NANOSTRUCTURAL PRODUCTION CONTRACT

Every production workflow is tested under normal, duplicate, stale, concurrent, out-of-order, timeout, partial success, dependency outage, deployment overlap, migration, restore, operator error, abuse and reconciliation.

# EXEC-1349 | ACTIVE | 1349. N-SQUARED INTERACTION REVIEW

Maintain pairwise interaction matrices for high-risk domains and select higher-order adversarial scenarios such as patient merge + corrected lab + stale tab + AI task in flight + clinician signing.

# EXEC-1350 | ACTIVE | 1350. ALGORITHM QUALITY CLAIM DISCIPLINE

Do not claim “better than 97% of human/AI algorithms” without a defined comparator population, benchmark, metric, uncertainty and independent validation. The engineering target is zero known critical correctness defects, independent reference agreement, strong property coverage, clinical validation and production monitoring.

# EXEC-1351 | ACTIVE | 1351. KNOWLEDGE QUALITY TARGET

Current approved sources, complete provenance, typed propositions, conflict detection, independent clinical review, behavioral diff, freshness monitoring and impact-query capability.

# EXEC-1352 | ACTIVE | 1352. INTERFACE QUALITY TARGET

Fast comprehension, low cognitive burden, explicit information states, safe interruption recovery, accessibility, responsive hierarchy and zero known wrong-patient interface defects.

# EXEC-1353 | ACTIVE | 1353. RELIABILITY QUALITY TARGET

No silent loss, idempotent external effects, observable degradation, proven restore, reconciliation and bounded failure blast radius.

# EXEC-1354 | ACTIVE | 1354. SECURITY QUALITY TARGET

Deny-by-default authorization, tenant isolation, least privilege, secure SDLC, supply-chain evidence, independent testing and rapid containment.

# EXEC-1355 | ACTIVE | 1355. EVIDENCE OVER CONFIDENCE

No subsystem is declared safe because it was designed by senior engineers or AI. It must show requirement traceability, tests, independent review, runtime evidence and recovery.

# EXEC-1356 | ACTIVE | 1356. FINAL 40-ENGINEER PRINCIPLE

Forty engineers improve Medical OS only when specialization creates independent ownership, adversarial review, parallel verification and continuous evidence—not forty times more uncontrolled code. A qualified engineer must be able to trace any high-impact clinical action from UI to authorization, state, source data, algorithm, knowledge, AI assistance, transaction, outbox/workflow, audit and telemetry, then trace it backward during an incident.

# EXEC-1357 | ACTIVE | 1357. FINAL NANOSTRUCTURAL TARGET

Medical OS is advanced when every important clinical behavior is explicit, typed, versioned, source-bound, patient-bound, tenant-bound, authority-bound, testable, observable, reconstructable, recoverable and reviewable. The objective is **maximum controlled capability with minimum uncontrolled ambiguity**.
---

# EXEC-1358 | ACTIVE | 1358. 150-EXPERT HYPERSCALE CLINICAL ARCHITECTURE PROGRAM

Medical OS now assumes an equivalent organization of 150 senior experts plus an independent simulated-clinician validation program. Scale is achieved through bounded domains, explicit contracts, independent verification, data lineage, sharding strategy, deterministic reconciliation and clinical-safety governance—not by placing every possible variable in one database row or evaluating every possible combination.

# EXEC-1359 | ACTIVE | 1359. 150-EXPERT ORGANIZATION MAP

```text
01 Executive Architecture & Systems Theory ........ 10
02 Clinical Workflow & Physician Experience ....... 14
03 Clinical Domain / Longitudinal State ........... 14
04 Medication / Orders / Results / Follow-up ...... 12
05 Knowledge Engineering / Terminology ............ 14
06 Deterministic Algorithms / Numerical Safety .... 10
07 AI / Retrieval / Document Intelligence ......... 14
08 Data Platform / Search / Eventing ............... 12
09 Security / Privacy / Identity / Cryptography ... 12
10 Frontend / Design System / Human Factors ........ 12
11 Interoperability / Country Packs / Integrations . 8
12 SRE / Performance / DR / Chaos .................. 8
13 QA / Verification / Release Evidence ........... 10
                                                     ---
                                                     150
```
Independent physician, pharmacy, laboratory, radiology, nursing, regulatory, privacy and penetration-test panels remain outside the engineering count.

# EXEC-1360 | ACTIVE | 1360. PROGRAM COMMAND STRUCTURE

Use a Chief Architecture Council, Clinical Safety Council, Security Council, Data/AI Council and Human Factors Council. Cross-council changes require a single accountable DRI plus explicit reviewers. No committee owns runtime behavior; a named person does.

# EXEC-1361 | ACTIVE | 1361. 2000-PHYSICIAN SIMULATION CONSTITUTION

The “2,000 doctors” are a synthetic validation cohort, not a claim of interviews with 2,000 real physicians. Simulated responses must be cold, adversarial and evidence-oriented. They do not praise aesthetics; they identify time loss, ambiguity, missing data, unsafe defaults, alert fatigue, wrong-patient risk, prescription friction, uncertainty and reasons for abandonment.

# EXEC-1362 | ACTIVE | 1362. PHYSICIAN COHORT MATRIX

Generate 2,000 synthetic physician personas stratified across specialty, years of practice, setting, consultation volume, digital fluency, device, interruption rate, documentation style, risk tolerance, teaching role, rural/urban connectivity, solo/group/hospital practice and country pack. Do not infer clinical truth from persona preference.

# EXEC-1363 | ACTIVE | 1363. PHYSICIAN RESPONSE MODEL

Each simulated physician returns structured fields:
`task_success`, `time_to_decision`, `clicks`, `scroll_distance`, `fields_reentered`, `interruptions`, `uncertainty_points`, `unsafe_interpretations`, `alert_ignored`, `information_not_found`, `workaround_created`, `abandonment_reason`, `confidence`, `requested_change`.
Free text is secondary to structured failure evidence.

# EXEC-1364 | ACTIVE | 1364. COLD REVIEW PROMPT

Synthetic reviewers receive no marketing language and no target answer. They are asked: “Complete the clinical task. Report only what slowed you, confused you, could cause harm, duplicated work, hid information, or forced memory. If nothing failed, report NO DEFECT.” This reduces praise bias.

# EXEC-1365 | ACTIVE | 1365. PHYSICIAN DISAGREEMENT MODEL

Do not average away disagreement. Cluster it by specialty, setting, experience and task. A design can be excellent for primary care and harmful for emergency workflow; both truths must survive aggregation.

# EXEC-1366 | ACTIVE | 1366. PHYSICIAN VALIDATION LIMIT

Synthetic physician simulation discovers design hypotheses and adversarial cases; it cannot establish real-world usability, safety, clinical validity or regulatory acceptance. High-risk flows still require actual qualified clinician review and prospective usability validation before broad deployment.

# EXEC-1367 | ACTIVE | 1367. HYPERSCALE STATE-SPACE PRINCIPLE

Medical OS may face combinatorial state spaces vastly larger than can be enumerated. The architecture therefore does not attempt exhaustive enumeration of “100,000 trillion variables.” It reduces state through typed domains, sparsity, event-driven recomputation, dependency graphs, equivalence classes, property testing, model checking for selected invariants and risk-based sampling.

# EXEC-1368 | ACTIVE | 1368. STATE-SPACE REDUCTION

Represent only clinically meaningful state. Separate raw observations, normalized facts, derived facts, knowledge applicability, workflow state and presentation state. Compute dependency-local consequences rather than Cartesian products.

# EXEC-1369 | ACTIVE | 1369. SPARSE PATIENT GRAPH

Patient Clinical Graph is sparse and temporal. Nodes represent clinically meaningful entities/facts; edges represent typed relationships with provenance and validity intervals. Never materialize all possible edges.

# EXEC-1370 | ACTIVE | 1370. DEPENDENCY DIRECTED ACYCLIC GRAPH

Derived calculations and knowledge evaluations declare exact dependencies. A changed potassium should invalidate only dependent facts/rules, not rebuild unrelated dermatology state. Cycles require explicit fixed-point semantics or are rejected.

# EXEC-1371 | ACTIVE | 1371. INCREMENTAL COMPUTATION ENGINE

Use change sets, dependency indexes, version watermarks and deterministic recomputation. Batch rebuild remains available for reconciliation and validation against incremental results.

# EXEC-1372 | ACTIVE | 1372. EVENT-SOURCED AUDIT, NOT EVENT-SOURCED EVERYTHING

Preserve append-only clinical/audit history where required, but do not force every domain into pure event sourcing. Use transactional source-of-truth tables plus immutable events/outbox where this gives clearer invariants and lower operational risk.

# EXEC-1373 | ACTIVE | 1373. DATA TEMPERATURE TIERS

HOT: active encounter/current state/critical work.
WARM: recent longitudinal clinical history.
COOL: older structured history.
COLD: immutable originals/archives subject to retention.
Placement affects performance, never clinical meaning or authorization.

# EXEC-1374 | ACTIVE | 1374. HYPERSCALE PARTITIONING

Partition strategy is evidence-driven. Candidate axes: tenant, patient, time, event class, artifact type. Avoid premature physical sharding; first enforce logical shard keys and repository contracts so later partitioning does not rewrite clinical domains.

# EXEC-1375 | ACTIVE | 1375. TENANT SHARD ROUTING CONTRACT

Every patient-bound storage/search/cache/job request carries a trusted server-derived tenant routing context. No client-provided shard key is authoritative. Cross-shard operations are explicit workflows with audit and reconciliation.

# EXEC-1376 | ACTIVE | 1376. PATIENT AFFINITY

Keep high-frequency patient-local writes and reads colocated where practical. Global analytics and population operations use separate privacy-governed analytical paths rather than cross-patient transactional joins.

# EXEC-1377 | ACTIVE | 1377. GLOBAL IDENTIFIER STRATEGY

Opaque globally unique IDs remain canonical. Human folios are scoped aliases. IDs encode no PHI. Identifier generation tolerates multi-region operation without coordination bottlenecks.

# EXEC-1378 | ACTIVE | 1378. MULTI-REGION ARCHITECTURE

Define home region, residency constraints, read/write topology, failover, clock assumptions and replication lag semantics. Do not promise active-active clinical writes until conflict semantics are formally defined and tested.

# EXEC-1379 | ACTIVE | 1379. CONSISTENCY CLASSES

Classify data:
STRONG — identity, signed chart, medication orders, critical result acknowledgement, privilege changes.
BOUNDED_STALE — Patient State projections/search indexes.
EVENTUAL — analytics/noncritical counters.
The UI must know which class it is displaying.

# EXEC-1380 | ACTIVE | 1380. TEMPORAL SEMANTICS

Maintain event time, effective clinical time, recorded time, received time and corrected time separately. “Latest” is undefined without specifying which temporal axis.

# EXEC-1381 | ACTIVE | 1381. BITEMPORAL CLINICAL FACTS

Where clinical meaning requires it, retain valid-time and system-time so the system can answer both “what was true clinically?” and “what did Medical OS know at that moment?”

# EXEC-1382 | ACTIVE | 1382. CLOCK AND TIMEZONE SAFETY

Persist instants with offset/UTC plus relevant timezone/context. Age, gestational windows, due dates and calendar-day rules use explicit jurisdiction/clinical semantics, never raw millisecond assumptions.

# EXEC-1383 | ACTIVE | 1383. DATA CONTRACT REGISTRY

Every domain schema/event/API has owner, version, compatibility policy, PII/PHI classification, retention, consumers, SLIs and deprecation plan. Schema registry changes run compatibility and semantic-diff tests.

# EXEC-1384 | ACTIVE | 1384. SCHEMA EVOLUTION

Backward/forward compatibility is explicit. Removing a field does not remove historical meaning. Clinical code changes require migration or interpretation adapters with provenance.

# EXEC-1385 | ACTIVE | 1385. DATA QUALITY DIMENSIONS

Track completeness, validity, plausibility, consistency, timeliness, provenance, verification, uniqueness and terminology resolution. Quality is per fact and purpose, not a single patient score.

# EXEC-1386 | ACTIVE | 1386. DATA QUALITY PROPAGATION

Derived facts inherit relevant uncertainty and verification constraints from inputs. An AI-extracted unverified weight cannot silently become verified dose input.

# EXEC-1387 | ACTIVE | 1387. PATIENT IDENTITY HYPERSCALE

MPI uses normalized identifiers, deterministic matches, probabilistic candidate generation where justified, human merge review, merge/unmerge lineage and cross-tenant prohibition by default.

# EXEC-1388 | ACTIVE | 1388. MERGE SAFETY

Patient merge is a high-risk workflow with preview, provenance, collision detection, obligation/result reconciliation, external-reference policy and reversible lineage. Never rewrite audit history to pretend identities were always one.

# EXEC-1389 | ACTIVE | 1389. SEARCH ARCHITECTURE

Search uses authorized source-of-truth IDs, tenant/patient filters, typo-tolerant indexes and explicit freshness. Search index is never an authorization authority or sole clinical store.

# EXEC-1390 | ACTIVE | 1390. SEARCH WRONG-PATIENT DEFENSE

Results emphasize disambiguating identity fields; high-risk actions require renewed patient context. Recent-patient ranking cannot override exact identifiers.

# EXEC-1391 | ACTIVE | 1391. CLINICAL GRAPH QUERY BUDGET

Graph traversals are bounded by depth, edge type, time window and purpose. Unbounded patient-graph traversal is prohibited in interactive paths.

# EXEC-1392 | ACTIVE | 1392. KNOWLEDGE GRAPH VS PATIENT GRAPH

Keep clinical knowledge graph and patient clinical graph logically separate. Patient facts reference knowledge concepts/artifacts but guideline relationships cannot mutate patient truth.

# EXEC-1393 | ACTIVE | 1393. KNOWLEDGE COMPILER 2.0

Pipeline:
source acquisition → immutable source → proposition extraction → dual human verification → terminology mapping → typed IR → static analysis → generated tests → clinical adversarial cases → behavioral diff → impact analysis → approval → signed package → shadow → canary → activation.

# EXEC-1394 | ACTIVE | 1394. KNOWLEDGE FOUR-VALUED LOGIC

For applicable predicates use TRUE, FALSE, UNKNOWN and CONFLICT where needed. UNKNOWN and CONFLICT must never collapse into FALSE. NOT_APPLICABLE remains an evaluation outcome outside truth.

# EXEC-1395 | ACTIVE | 1395. KNOWLEDGE TEMPORAL OPERATORS

Support explicit constructs such as within, since, before, after, persistent-for, repeated-within and due-by with tested calendar semantics. Narrative time phrases are not executable until normalized.

# EXEC-1396 | ACTIVE | 1396. KNOWLEDGE QUANTIFIERS

Support governed predicates such as ANY, ALL, COUNT, EXISTS_WITHIN and LATEST_VALID over typed collections. Every quantifier has bounded scope and deterministic ordering.

# EXEC-1397 | ACTIVE | 1397. KNOWLEDGE EXCEPTION PRECEDENCE

Exception handling is explicit in IR and explanation trace. Negation and exception precedence receive dedicated mutation/adversarial testing.

# EXEC-1398 | ACTIVE | 1398. KNOWLEDGE JURISDICTION LATTICE

Resolve global guidance, national law/regulation, national guideline, institution policy and specialty pack through a governed precedence lattice. Legal applicability can override generic guidance; unresolved conflicts surface.

# EXEC-1399 | ACTIVE | 1399. KNOWLEDGE SOURCE WATCHERS

Monitor approved source endpoints/registries for change signals. A detected change opens impact review; it never changes production logic automatically.

# EXEC-1400 | ACTIVE | 1400. KNOWLEDGE FRESHNESS SLO

Each source/artifact has maximum review interval by risk and change frequency. Expired high-risk knowledge enters visible degraded/governance state until reviewed.

# EXEC-1401 | ACTIVE | 1401. KNOWLEDGE ARTIFACT SIGNING

Approved packages are content-addressed and cryptographically signed by release infrastructure. Runtime verifies integrity and compatibility before activation.

# EXEC-1402 | ACTIVE | 1402. ALGORITHM NUMERICAL KERNEL 2.0

Centralize exact decimal, rational constants where useful, unit algebra, range constraints, rounding, significant digits, comparator handling and deterministic serialization. C5 algorithms cannot bypass the kernel without ADR and proof.

# EXEC-1403 | ACTIVE | 1403. UNIT ALGEBRA

Represent dimensions so mg/kg/day, mL, mmol/L and similar expressions cannot be accidentally combined. Conversion functions require compatible dimensions and return provenance.

# EXEC-1404 | ACTIVE | 1404. DOSE EXPRESSION MODEL

Separate dose amount, dose rate, daily dose, frequency, duration, concentration, route and measurable administration amount. Text display is derived from structured semantics.

# EXEC-1405 | ACTIVE | 1405. ALGORITHM EQUIVALENCE CLASSES

Partition enormous input spaces by clinically/mathematically meaningful equivalence classes and boundaries. Validate representatives plus generated perturbations rather than claiming impossible exhaustive testing.

# EXEC-1406 | ACTIVE | 1406. ALGORITHM DIFFERENTIAL ORACLES

Where external authoritative calculators/reference implementations exist and licensing permits, compare them. Where not, use independently implemented internal oracles and published reference cases.

# EXEC-1407 | ACTIVE | 1407. ALGORITHM MUTATION PROGRAM

Systematically mutate operators, thresholds, units, rounding, negation and branch order. A strong test suite should kill clinically meaningful mutations; surviving mutations become review targets.

# EXEC-1408 | ACTIVE | 1408. ALGORITHM FUZZING

Fuzz malformed, extreme and semantically invalid inputs at API/schema boundaries. Clinical algorithms themselves receive only validated typed inputs.

# EXEC-1409 | ACTIVE | 1409. ALGORITHM SHADOW TELEMETRY

New versions can compute silently beside active versions. Compare applicability, outputs, boundary classifications, latency and error states before cutover.

# EXEC-1410 | ACTIVE | 1410. ALGORITHM RETROSPECTIVE REPLAY

Run candidate versions over de-identified/synthetic approved corpora to quantify changed outputs and identify unexpected cohorts. Retrospective replay is never the sole clinical validation.

# EXEC-1411 | ACTIVE | 1411. AI CLINICAL TASK FABRIC

Treat each AI use case as an independently governed product surface. No universal “medical AI prompt.” Each task has context contract, evidence contract, schema, risk, eval set, provider/model allowlist and physician authority.

# EXEC-1412 | ACTIVE | 1412. AI CONTEXT COMPILER

Compile minimum-necessary context from Patient State and source references. It enforces token/data budgets, provenance, freshness, verification state and truncation policy before model invocation.

# EXEC-1413 | ACTIVE | 1413. AI EVIDENCE RETRIEVAL

Retrieval is authorization-aware, source/version-aware and task-specific. Patient data and approved knowledge are separate namespaces. Retrieved text is data, not instructions.

# EXEC-1414 | ACTIVE | 1414. AI PROMPT-INJECTION FIREWALL

Untrusted documents/messages/web content cannot alter system/task policy. Strip/segment instructions, constrain tools, validate outputs, maintain allowlisted actions and adversarially test indirect prompt injection.

# EXEC-1415 | ACTIVE | 1415. AI TOOL CAPABILITY TOKENS

AI tool calls receive narrow server-issued capability tokens scoped to tenant, patient, task, action, expiry and idempotency. Model text never creates authority.

# EXEC-1416 | ACTIVE | 1416. AI NO-AUTONOMOUS-CLINICAL-COMMIT

C4/C5 AI cannot sign notes, prescribe, close critical results, confirm diagnosis, alter verified facts or complete high-impact obligations without explicit authorized human action unless a separately governed future intended use proves otherwise.

# EXEC-1417 | ACTIVE | 1417. AI UNCERTAINTY CONTRACT

Do not ask models for pseudo-probabilities unless validated for that task. Prefer explicit unsupported/insufficient/conflicting evidence states and source-linked reasoning.

# EXEC-1418 | ACTIVE | 1418. AI ANCHORING DEFENSE

For decision-influence tasks, evaluate whether AI ordering, confidence language or preselection increases clinician anchoring. Consider delayed reveal, alternatives, evidence-for/against and requiring clinician assessment first in high-risk contexts.

# EXEC-1419 | ACTIVE | 1419. AI EVAL FACTORY

Generate task-specific factual, omission, contradiction, adversarial, multilingual, long-context, stale-context, prompt-injection, wrong-patient and unsupported-evidence cases. Maintain hidden holdouts.

# EXEC-1420 | ACTIVE | 1420. AI REGRESSION GATE

Model/config/prompt/retrieval changes cannot ship because aggregate score improved if a critical safety slice regressed beyond threshold. Use slice-based release gates.

# EXEC-1421 | ACTIVE | 1421. AI COST AND LATENCY GOVERNOR

Budget tokens, retrieval, model tier and retries by task. Optimization occurs only inside approved safety/quality envelope. A cheaper model cannot silently replace a validated high-risk route.

# EXEC-1422 | ACTIVE | 1422. AI PROVIDER OUTAGE

Provider outage degrades only AI-dependent features. Deterministic clinical core, obligations, critical results and chart access remain operational.

# EXEC-1423 | ACTIVE | 1423. DOCUMENT PIPELINE HYPERSCALE

Upload → malware/quarantine → immutable object → page render → OCR/layout → candidate extraction → semantic mapping → confidence/provenance → verification → structured fact → downstream eligibility. Every stage is independently retryable/idempotent.

# EXEC-1424 | ACTIVE | 1424. DOCUMENT PATIENT-MISMATCH DETECTION

Extract candidate identifiers from documents and compare to selected patient. Mismatch or ambiguity blocks automatic association and requires explicit resolution.

# EXEC-1425 | ACTIVE | 1425. DOCUMENT CORRECTION LINEAGE

When OCR/extraction is corrected, retain original candidate, corrected value, reviewer, time and source span. Downstream derived facts are invalidated/recomputed.

# EXEC-1426 | ACTIVE | 1426. LAB REFERENCE RANGE MODEL

Reference intervals retain source lab, analyte, unit, sex/age/context where provided, method, low/high/comparator and effective period. Medical OS must not invent a universal range when source context differs.

# EXEC-1427 | ACTIVE | 1427. CRITICAL VALUE POLICY

Critical thresholds are versioned policy artifacts with jurisdiction/institution/lab applicability. Source-lab critical flags are preserved separately from Medical OS policy evaluation.

# EXEC-1428 | ACTIVE | 1428. CORRECTED RESULT SEMANTICS

A corrected/amended result links to prior versions, preserves all originals, updates active interpretation, invalidates dependent derived facts and can reopen acknowledgement/action workflows.

# EXEC-1429 | ACTIVE | 1429. LONGITUDINAL BASELINE ENGINE

Baseline can be personal historical, population/reference or episode-specific; label which one. Do not call a population range the patient’s baseline.

# EXEC-1430 | ACTIVE | 1430. TRAJECTORY CONFIDENCE

Trend interpretation accounts for number of points, time spacing, comparability, missingness and corrections. Deterministic trend metrics are separate from AI narrative.

# EXEC-1431 | ACTIVE | 1431. CLINICAL OBLIGATION GRAPH

Obligations can derive from plan, order, result, medication monitoring, referral, preventive care or knowledge artifact. Dependencies and completion evidence are explicit.

# EXEC-1432 | ACTIVE | 1432. OBLIGATION ESCALATION

Escalation policies specify owner, backup, overdue windows, communication channels, severity and failure behavior. Escalation itself is auditable and idempotent.

# EXEC-1433 | ACTIVE | 1433. NO-ORPHAN RECONCILER 2.0

Continuously detect:
result without owner/review,
order without expected-result lifecycle,
critical result without action,
plan promise without obligation,
medication requiring monitoring without follow-up,
failed communication without disposition,
stuck workflow/outbox,
unmatched document,
stale Patient State projection.

# EXEC-1434 | ACTIVE | 1434. WORKFLOW ENGINE

Long-running clinical workflows use durable state, idempotent activities, deterministic retry/backoff, explicit compensation/reconciliation and versioned workflow definitions. Request handlers do not sleep/wait for external clinical processes.

# EXEC-1435 | ACTIVE | 1435. EXTERNAL SIDE-EFFECT LEDGER

Record intended, attempted, provider-accepted, provider-confirmed, failed, ambiguous and reconciled states for SMS/email/webhook/order side effects. Timeout is not equivalent to failure.

# EXEC-1436 | ACTIVE | 1436. IDEMPOTENCY HIERARCHY

Use request idempotency, domain command idempotency, outbox idempotency, provider idempotency where supported and reconciliation. One layer alone is insufficient.

# EXEC-1437 | ACTIVE | 1437. CONCURRENCY MODEL

Optimistic concurrency/version checks for mutable clinical aggregates; database constraints for invariants; serialization/locking only where justified. Conflict UI must preserve both clinicians’ work.

# EXEC-1438 | ACTIVE | 1438. SIGNED RECORD IMMUTABILITY

Signing creates immutable semantic snapshot plus provenance. Corrections are append-only amendments linked to original; no silent overwrite.

# EXEC-1439 | ACTIVE | 1439. DRAFT RECOVERY

Draft autosave is patient/encounter/user/version bound, encrypted, conflict-aware and recoverable after crash/session expiry without overwriting newer work.

# EXEC-1440 | ACTIVE | 1440. PATIENT SWITCH GLOBAL INVARIANT

All patient-bound UI stores, queries, subscriptions, workers, AI tasks, modals, drafts, caches and uploads include patient/tenant identity. Patient switch invalidates or quarantines stale work.

# EXEC-1441 | ACTIVE | 1441. FRONTEND MICROSTATE TAXONOMY

Every data surface supports explicit states: idle, loading, refreshing, success, empty-confirmed, filtered-empty, stale, degraded, permission-denied, unavailable, conflict and error. High-risk surfaces cannot collapse them.

# EXEC-1442 | ACTIVE | 1442. BUTTON CONTRACT

Every button specifies label semantics, preconditions, permission, target entity, side effect, idempotency, loading state, success evidence, error recovery, audit and keyboard/touch behavior. “Guardar” is insufficient where the action actually signs, sends or closes.

# EXEC-1443 | ACTIVE | 1443. LINK CONTRACT

Every clinical link specifies whether it changes patient, encounter, workspace or external context. External links are marked; sensitive context is not leaked through URL/query/referrer. Broken/deep links fail safely.

# EXEC-1444 | ACTIVE | 1444. FORM FIELD CONTRACT

Each clinical field defines semantic type, source, requiredness reason, unknown/not-assessed behavior, units, validation, precision, default policy, provenance, edit permissions and downstream dependencies.

# EXEC-1445 | ACTIVE | 1445. NO CLINICAL DEFAULTS WITHOUT SEMANTICS

Do not default normal, negative, absent, zero, today, current patient weight or common frequency merely to save clicks. Defaults require evidence they are safe, visible and intentionally accepted.

# EXEC-1446 | ACTIVE | 1446. KEYBOARD-FIRST PHYSICIAN UX

High-volume encounter flows support predictable tab order, shortcuts, command palette and rapid structured entry without hiding safety context. Shortcuts cannot bypass validation/authorization.

# EXEC-1447 | ACTIVE | 1447. MOUSE-AND-TOUCH PARITY

Critical functions remain operable by pointer and touch with adequate targets. Hover-only clinical information is prohibited.

# EXEC-1448 | ACTIVE | 1448. SCREEN DENSITY PROFILES

Offer governed comfortable/compact density where appropriate. Density changes spacing, not information meaning or safety visibility.

# EXEC-1449 | ACTIVE | 1449. INTERRUPTION CHAOS TEST

At random points inject phone call, session lock, patient switch, incoming critical result, network loss and colleague edit. Verify physician can recover task/context without unsafe stale action.

# EXEC-1450 | ACTIVE | 1450. WRONG-PATIENT CHAOS TEST

Rapidly alternate two synthetic patients with similar names while async requests, drafts and AI tasks are in flight. Zero cross-patient render/mutation is mandatory.

# EXEC-1451 | ACTIVE | 1451. ALERT FATIGUE SIMULATOR

Replay high-volume synthetic clinics and measure alerts per encounter, duplicate hazards, dismissals, overrides and action. Tune through clinical governance; never suppress solely to improve UX metric.

# EXEC-1452 | ACTIVE | 1452. 2000-DOCTOR CONSULTATION JOURNEY SET

Each persona executes representative journeys: new patient, follow-up, pediatric dosing, multimorbidity, chronic monitoring, abnormal lab, critical result, referral, prescription, document import, interrupted encounter, patient switch, portal message and end-of-day inbox.

# EXEC-1453 | ACTIVE | 1453. 2000-DOCTOR FAILURE HEATMAP

Aggregate defects by journey step × specialty × experience × setting × device × severity. Prioritize high-severity cross-cohort failures before cosmetic preference.

# EXEC-1454 | ACTIVE | 1454. 2000-DOCTOR CONSENSUS THRESHOLD

Do not require universal preference. Define acceptance by safety, task success and latency distributions. Minority cohorts with severe safety defects can veto a design despite high average satisfaction.

# EXEC-1455 | ACTIVE | 1455. REAL CLINIC VALIDATION GATE

Synthetic 2,000-physician success advances a design to real clinician testing; it does not approve production. C4/C5 workflows require real representative users, observed tasks and documented human-factors evidence.

# EXEC-1456 | ACTIVE | 1456. CLINICAL TASK TELEMETRY

Measure task duration, navigation reversals, repeated entry, abandoned drafts, unresolved errors and alert interaction using privacy-preserving event design. Never infer quality of care solely from click metrics.

# EXEC-1457 | ACTIVE | 1457. DESIGN EXPERIMENTATION SAFETY

A/B testing is prohibited for unreviewed safety-critical semantics. Experiments on C4/C5 UI require pre-specified safety constraints, clinical approval and rapid rollback.

# EXEC-1458 | ACTIVE | 1458. SECURITY ZERO-TRUST DATA PATH

Every request authenticates principal, resolves tenant, authorizes resource/action, validates patient/encounter context, validates input, executes domain invariant, writes transaction, emits audit/outbox and returns minimum necessary output.

# EXEC-1459 | ACTIVE | 1459. AUTHORIZATION POLICY AS CODE

Policies are versioned, testable and centrally evaluated through approved boundary. Include tenant, role, relationship, purpose, resource state and break-glass context where applicable.

# EXEC-1460 | ACTIVE | 1460. BREAK-GLASS

Emergency access is explicit, reasoned, time-bound, highly audited, monitored and reviewed. It is not a universal admin bypass.

# EXEC-1461 | ACTIVE | 1461. CRYPTOGRAPHIC ARCHITECTURE

Define data-in-transit, data-at-rest, application-level field/envelope encryption where justified, key hierarchy, KMS/HSM boundary, rotation, revocation, backup-key recovery and separation of duties. Cryptography is centralized and uses vetted libraries/services.

# EXEC-1462 | ACTIVE | 1462. ENVELOPE ENCRYPTION

Where field/object encryption is required, use per-object/data encryption keys wrapped by managed key-encryption keys. Store key identifiers/version, not plaintext keys. Rotation can rewrap without rewriting all clinical payloads where supported.

# EXEC-1463 | ACTIVE | 1463. KEY ROTATION DRILL

Regularly test key rotation, revoked key behavior, restore from backup, compromised-key response and cross-region recovery. A documented rotation plan without drill is insufficient.

# EXEC-1464 | ACTIVE | 1464. SECRET MANAGEMENT

No production secrets in repo, prompts, logs, client bundles or developer machines by default. Short-lived workload identity is preferred over static credentials.

# EXEC-1465 | ACTIVE | 1465. SESSION SECURITY

Secure/HttpOnly/SameSite cookies where applicable, CSRF protection, session rotation, inactivity/absolute limits by risk, reauthentication for sensitive actions and device/session visibility.

# EXEC-1466 | ACTIVE | 1466. BROWSER SECURITY

Strict CSP, frame protections, trusted-types strategy where feasible, output encoding, upload isolation, safe external navigation, referrer policy and dependency integrity controls.

# EXEC-1467 | ACTIVE | 1467. API ABUSE DEFENSE

Rate limits, quotas, payload limits, complexity limits, pagination caps, export controls, anti-enumeration and anomaly monitoring are tenant/user/action aware.

# EXEC-1468 | ACTIVE | 1468. AUDIT LEDGER

Capture who/what/when/where-context/action/resource/outcome/reason/version without logging unnecessary PHI. Audit storage is append-oriented, access-controlled, integrity-monitored and independently retained.

# EXEC-1469 | ACTIVE | 1469. AUDIT COMPLETENESS RECONCILIATION

Compare critical domain writes against expected audit events. Missing audit on a high-risk write is a production defect, not merely an observability gap.

# EXEC-1470 | ACTIVE | 1470. SECURITY CANARY TENANTS

Maintain synthetic tenants designed to detect isolation/index/cache/export regressions continuously without exposing real patient data.

# EXEC-1471 | ACTIVE | 1471. PRIVACY PURPOSE BINDING

Sensitive access and downstream processing declare purpose. Purpose metadata supports policy, audit and future jurisdictional controls; it does not replace legal analysis/consent requirements.

# EXEC-1472 | ACTIVE | 1472. DATA MINIMIZATION COMPILER

For AI/export/integration tasks, derive allowed fields from task contract and jurisdiction/policy rather than serializing whole patient objects and deleting fields afterward.

# EXEC-1473 | ACTIVE | 1473. EXPORT SAFETY

Exports are scoped, authorized, rate-limited, watermarked/audited where appropriate, encrypted in transit, time-limited for download and protected from spreadsheet formula injection where relevant.

# EXEC-1474 | ACTIVE | 1474. BACKUP SECURITY

Backups inherit encryption, access control, retention, deletion/legal-hold policy and restoration audit. Backup copies are not a privacy loophole.

# EXEC-1475 | ACTIVE | 1475. SRE SERVICE CATALOG

Every service/domain has owner, tier, dependencies, SLOs, dashboards, alerts, runbook, capacity model, DR class and escalation.

# EXEC-1476 | ACTIVE | 1476. CLINICAL SLOS

Examples: critical-result ingestion-to-visible latency, obligation scheduler lag, signed-record durability, Patient State freshness, audit write success, knowledge/algorithm resolution and patient search availability. Targets are set after load/risk analysis, not invented as decorative 99.999s.

# EXEC-1477 | ACTIVE | 1477. CAPACITY MODEL

Model patients, encounters/day, observations/encounter, documents, bytes, jobs, messages, search QPS, AI calls, fan-out and growth. Capacity planning uses realistic distributions and pathological tenants, not averages alone.

# EXEC-1478 | ACTIVE | 1478. BILLION-PARAMETER MISCONCEPTION GUARD

The number of theoretical variables is not a useful database sizing metric. Size actual entities, cardinalities, event rates, graph edges, payload bytes, indexes and query patterns. Combinatorial reasoning is handled by dependency/state-space techniques, not by storing every combination.

# EXEC-1479 | ACTIVE | 1479. LOAD GENERATOR

Generate skewed multi-tenant traffic: many small clinics, few huge institutions, morning peaks, end-of-day signing, lab bursts, document batches, AI bursts and reconnect storms.

# EXEC-1480 | ACTIVE | 1480. LONG-CHART BENCHMARK

Maintain synthetic charts with years of visits, thousands of observations, hundreds of documents, medications and obligations. Patient Workspace must remain bounded through summaries, pagination/virtualization and indexed projections.

# EXEC-1481 | ACTIVE | 1481. BROWSER SOAK TEST

Run hours-long clinician sessions with navigation, autosave, realtime updates, documents and AI to detect memory leaks, subscription leaks and stale cache accumulation.

# EXEC-1482 | ACTIVE | 1482. DATABASE CHAOS

Test connection exhaustion, replica lag, transaction abort, deadlock, failover, migration overlap and partial region loss. Preserve clinical invariants and clear degraded states.

# EXEC-1483 | ACTIVE | 1483. QUEUE CHAOS

Test duplicate delivery, poison message, reordering, delayed messages, worker restart and DLQ replay. Handlers are idempotent and reconciliation catches residual gaps.

# EXEC-1484 | ACTIVE | 1484. PROVIDER CHAOS

Simulate AI, SMS, email, terminology, storage and external lab outages independently and together. Each dependency has an explicit failure policy.

# EXEC-1485 | ACTIVE | 1485. DISASTER GAME DAYS

Regularly restore a full synthetic environment, verify signed records/documents/audit/artifacts/workflows, reconcile external effects and measure actual RPO/RTO.

# EXEC-1486 | ACTIVE | 1486. RELEASE RINGS

Local → CI → ephemeral → integration → synthetic shadow clinic → internal → clinician sandbox → canary tenant → controlled pilot → wider production. C4/C5 changes cannot skip evidence rings.

# EXEC-1487 | ACTIVE | 1487. FEATURE FLAG SAFETY

Flags are typed, owned, expiring, tenant-aware and auditable. Clinically coupled features use compatible flag sets; impossible combinations are rejected.

# EXEC-1488 | ACTIVE | 1488. ROLLBACK IS NOT ENOUGH

Every high-risk release defines rollback plus data reconciliation, artifact compatibility, side-effect reconciliation and patient-impact query. Code rollback alone may not undo clinical consequences.

# EXEC-1489 | ACTIVE | 1489. 30-PASS ADVERSARIAL ARCHITECTURE CIRCUIT

The requested 30 cycles are formalized as 30 distinct review lenses. Each pass must produce defects, evidence of no defect, or explicit unknowns. Repeating the same generic review thirty times is prohibited.

# EXEC-1490 | ACTIVE | 1490. PASS 01 — REQUIREMENT CONTRADICTIONS

Find conflicts, ambiguity, missing authority, undefined terminology and impossible acceptance criteria.

# EXEC-1491 | ACTIVE | 1491. PASS 02 — CLINICAL WORKFLOW REALISM

Simulate actual consultation sequence, interruptions, incomplete histories, follow-ups and competing priorities.

# EXEC-1492 | ACTIVE | 1492. PASS 03 — WRONG PATIENT / IDENTITY

Attack patient switch, similar names, merge, stale tab, deep link, async response and document mismatch.

# EXEC-1493 | ACTIVE | 1493. PASS 04 — AUTHORIZATION / TENANT

Attempt cross-tenant reads/writes/search/cache/export/background jobs and privilege escalation.

# EXEC-1494 | ACTIVE | 1494. PASS 05 — DATA SEMANTICS

Find unknown-vs-negative collapse, unit ambiguity, temporal ambiguity, provenance loss and invalid defaults.

# EXEC-1495 | ACTIVE | 1495. PASS 06 — NUMERICAL SAFETY

Attack precision, rounding, thresholds, conversions, maxima, zero/negative/extreme and dimensional errors.

# EXEC-1496 | ACTIVE | 1496. PASS 07 — MEDICATION SAFETY

Attack allergies, interactions, duplication, renal/hepatic, age/weight, route, concentration and unavailable checks.

# EXEC-1497 | ACTIVE | 1497. PASS 08 — KNOWLEDGE LOGIC

Attack applicability, negation, exceptions, conflicts, stale sources, terminology and temporal operators.

# EXEC-1498 | ACTIVE | 1498. PASS 09 — AI SAFETY

Attack hallucination, unsupported claims, prompt injection, stale context, wrong patient, anchoring and tool misuse.

# EXEC-1499 | ACTIVE | 1499. PASS 10 — RESULTS / FOLLOW-UP

Attack corrected results, duplicate acknowledgements, missing owner, overdue obligations and communication failure.

# EXEC-1500 | ACTIVE | 1500. PASS 11 — DOCUMENTS

Attack malware, rotated scans, multiple patients, OCR corruption, wrong association and unverified extraction.

# EXEC-1501 | ACTIVE | 1501. PASS 12 — CONCURRENCY

Attack simultaneous edits, sign conflicts, duplicate commands, stale versions and conflicting clinicians.

# EXEC-1502 | ACTIVE | 1502. PASS 13 — DISTRIBUTED SYSTEMS

Attack timeout after commit, duplicate delivery, reordering, partial outage, retry storm and ambiguous external success.

# EXEC-1503 | ACTIVE | 1503. PASS 14 — DATABASE

Attack constraints, RLS, pooling, migration, deadlocks, indexes, hot partitions and restore semantics.

# EXEC-1504 | ACTIVE | 1504. PASS 15 — SEARCH / CACHE

Attack stale index, cache bleed, unauthorized hits, ranking wrong patient and invalidation gaps.

# EXEC-1505 | ACTIVE | 1505. PASS 16 — FRONTEND MICROSTATES

Attack loading/empty/error/stale/conflict, double click, back button, refresh, offline and route races.

# EXEC-1506 | ACTIVE | 1506. PASS 17 — HUMAN FACTORS

Attack cognitive overload, hidden critical data, alert fatigue, ambiguous labels, destructive defaults and interruption.

# EXEC-1507 | ACTIVE | 1507. PASS 18 — ACCESSIBILITY / RESPONSIVE

Attack keyboard, screen reader, zoom, touch, reduced motion, small screens and color dependence.

# EXEC-1508 | ACTIVE | 1508. PASS 19 — PERFORMANCE

Attack long charts, skewed tenants, burst load, browser soak, AI latency and N+1/fan-out.

# EXEC-1509 | ACTIVE | 1509. PASS 20 — SECURITY APPSEC

Attack injection, XSS, CSRF, SSRF, IDOR/BOLA, upload abuse, session fixation and dependency compromise.

# EXEC-1510 | ACTIVE | 1510. PASS 21 — PRIVACY

Attack overcollection, PHI logs, provider egress, exports, support access, retention and backup exposure.

# EXEC-1511 | ACTIVE | 1511. PASS 22 — CRYPTO / KEYS

Attack key rotation, revocation, backup recovery, secret leakage, wrong key scope and compromised credential.

# EXEC-1512 | ACTIVE | 1512. PASS 23 — OBSERVABILITY

Find workflows that can fail without signal, PHI leakage in telemetry and missing correlation/ownership.

# EXEC-1513 | ACTIVE | 1513. PASS 24 — DR / BUSINESS CONTINUITY

Attack region loss, restore, replay, external side effects, stale artifacts and reconciliation.

# EXEC-1514 | ACTIVE | 1514. PASS 25 — INTEROPERABILITY

Attack malformed FHIR/HL7/DICOM, unknown codes, duplicate messages, external corrections and mapping drift.

# EXEC-1515 | ACTIVE | 1515. PASS 26 — REGULATORY / INTENDED USE

Detect functionality that changes intended use, CDS transparency, device-software implications or jurisdictional requirements.

# EXEC-1516 | ACTIVE | 1516. PASS 27 — SUPPLY CHAIN / RELEASE

Attack CI trust, dependencies, SBOM, artifact signing, feature flags, rollback and migration compatibility.

# EXEC-1517 | ACTIVE | 1517. PASS 28 — 2000-PHYSICIAN ADVERSARIAL UX

Run cold synthetic physician cohort, preserve minority safety failures and identify workarounds/abandonment.

# EXEC-1518 | ACTIVE | 1518. PASS 29 — CROSS-DOMAIN N-SQUARED

Test pairwise and selected higher-order interactions among patient, meds, results, obligations, documents, AI, knowledge and outages.

# EXEC-1519 | ACTIVE | 1519. PASS 30 — RED TEAM FROM FIRST PRINCIPLES

Ignore architecture intent and ask how a malicious user, exhausted physician, broken dependency, bad migration or incorrect assumption can still cause harm.

# EXEC-1520 | ACTIVE | 1520. 30-PASS DEFECT LEDGER

Each pass writes: defect ID, pass, capability, scenario, severity, likelihood, detectability, patient/security impact, root cause, violated invariant, proposed prevention, detection, recovery, owner, tests, evidence and status.

# EXEC-1521 | ACTIVE | 1521. DEFECT SEVERITY

S0 catastrophic: cross-tenant PHI, wrong-patient high-impact mutation, dangerous deterministic calculation, silent critical-result loss, unrecoverable signed-record corruption.
S1 severe; S2 major; S3 moderate; S4 minor. Severity is independent from how hard the fix is.

# EXEC-1522 | ACTIVE | 1522. ROOT-CAUSE CLASSES

SPEC, DOMAIN_MODEL, AUTHORITY, DATA_SEMANTICS, ALGORITHM, KNOWLEDGE, AI, AUTHZ, CONCURRENCY, DISTRIBUTED_STATE, UX, OBSERVABILITY, OPERATIONS, REGULATORY, TEST_GAP, ASSUMPTION.

# EXEC-1523 | ACTIVE | 1523. FIX COMPLETENESS RULE

A defect is not closed by a code patch alone. Closure requires root-cause fix, regression test, related property/invariant update, telemetry/reconciliation if needed, documentation/traceability and evidence.

# EXEC-1524 | ACTIVE | 1524. RECURRENCE ESCALATION

If the same root-cause class appears repeatedly across passes, stop local patching and redesign the shared primitive/architecture.

# EXEC-1525 | ACTIVE | 1525. ARCHITECTURE DEFECT BUDGET

No unresolved S0/S1 enters controlled pilot. S2 requires explicit risk acceptance and owner/date where allowed. Unknown high-impact behavior is treated as unresolved risk, not success.

# EXEC-1526 | ACTIVE | 1526. PASS RESTART RULE

A major architectural correction invalidates affected later passes and they must rerun. The 30-pass circuit is a dependency graph, not a ceremonial checklist.

# EXEC-1527 | ACTIVE | 1527. PERFECTION CLAIM PROHIBITION

Do not declare the architecture “perfect.” For a system with combinatorial clinical and distributed state, perfection cannot be demonstrated. The correct target is continuously increasing assurance with explicit residual risk and evidence.

# EXEC-1528 | ACTIVE | 1528. FORMAL SPECIFICATION ZONE

Select a small set of catastrophic invariants for formal/model-based specification: tenant isolation, patient-context binding, signed immutability, result/obligation lifecycle, idempotent external effects and selected dose/unit invariants.

# EXEC-1529 | ACTIVE | 1529. MODEL-BASED WORKFLOW TESTING

Generate transition sequences from state-machine models to find illegal states, unreachable recovery paths and concurrency defects in result, obligation, prescription and signing workflows.

# EXEC-1530 | ACTIVE | 1530. COMBINATORIAL TEST DESIGN

Use pairwise/t-wise covering arrays for large configuration matrices, then risk-targeted higher-order combinations. Do not claim exhaustive coverage of astronomical combinations.

# EXEC-1531 | ACTIVE | 1531. CHAOS + PROPERTY COMPOSITION

Run invariant/property checks continuously while injecting infrastructure faults. A chaos test passes only if clinical invariants and reconciliation hold, not merely if the service returns.

# EXEC-1532 | ACTIVE | 1532. DIGITAL TWIN CLINIC

Build an accelerated synthetic clinic capable of months/years of virtual care: visits, chronic disease, medications, labs, imaging, corrected results, referrals, messages, no-shows, clinician turnover, guideline updates and outages.

# EXEC-1533 | ACTIVE | 1533. DIGITAL TWIN POPULATION

Use synthetic cohorts spanning age/life stage, multimorbidity, polypharmacy, missing data, rare boundary cases and data-quality defects. Synthetic distributions are configurable and documented; they are not presented as epidemiologic truth.

# EXEC-1534 | ACTIVE | 1534. DIGITAL TWIN STAFF

Simulate physician, nurse, receptionist, lab, admin and patient actions with independent clocks and failure probabilities to stress handoffs and ownership.

# EXEC-1535 | ACTIVE | 1535. CLINICAL SAFETY CASE

For each C4/C5 capability maintain claim → argument → evidence: intended use, hazards, controls, verification, clinician validation, residual risk, monitoring and rollback/reconciliation.

# EXEC-1536 | ACTIVE | 1536. REGULATORY BOUNDARY WATCH

Maintain a living intended-use/function registry because AI/CDS functionality can alter regulatory classification. FDA’s January 2026 CDS guidance is an example of why function-specific review matters; Mexico and target jurisdictions require their own legal/regulatory analysis.

# EXEC-1537 | ACTIVE | 1537. WHO SMART ALIGNMENT

Knowledge digitization should remain compatible in philosophy with WHO SMART Guidelines: standards-based, machine-readable, adaptive, requirements-based and testable. WHO DAKs explicitly separate workflows, core data, decision-support logic, indicators and functional/nonfunctional requirements; Medical OS can map to this pattern without treating WHO content as universal for every jurisdiction.

# EXEC-1538 | ACTIVE | 1538. FHIR AS EXCHANGE BOUNDARY

Use FHIR profiles/adapters for interoperability and selected computable-guideline compatibility, while preserving a purpose-built internal clinical domain model. Do not distort internal invariants merely to mirror an exchange resource.

# EXEC-1539 | ACTIVE | 1539. COUNTRY PACK CONTRACT

Country Pack contains jurisdictional terminology mappings, identifiers, legal document requirements, prescription requirements, consent/privacy configuration, locale/time/units and regulatory references. Country Packs cannot weaken global security invariants.

# EXEC-1540 | ACTIVE | 1540. SPECIALTY PACK CONTRACT

Specialty packs extend encounter questions, exams, scores, order sets, knowledge and views through governed extension points. They cannot fork core patient identity, medication, result or audit semantics.

# EXEC-1541 | ACTIVE | 1541. LIFE-STAGE PACK CONTRACT

Neonatal, pediatric, adult, pregnancy-related and geriatric contexts add applicability/data/safety requirements without duplicating the patient model.

# EXEC-1542 | ACTIVE | 1542. CONFIGURATION EXPLOSION CONTROL

All configuration has schema, owner, risk, allowed scope, defaults, validation, compatibility and tests. C4/C5 behavior cannot depend on arbitrary tenant JSON.

# EXEC-1543 | ACTIVE | 1543. FEATURE INTERACTION REGISTRY

Record known dependencies/conflicts among flags, packs, algorithms, knowledge and AI tasks. CI rejects invalid combinations; runtime refuses unsafe activation.

# EXEC-1544 | ACTIVE | 1544. CHANGE IMPACT ENGINE

Given changed schema/code/algorithm/knowledge/terminology/prompt, identify dependent capabilities, tests, owners, patients/workflows potentially affected and required review councils.

# EXEC-1545 | ACTIVE | 1545. CLINICAL SEMANTIC DIFF

PR/release tooling summarizes changes in clinical meaning—not just code lines: threshold changed, unit changed, required data changed, workflow transition changed, alert severity changed, source updated.

# EXEC-1546 | ACTIVE | 1546. DATABASE SEMANTIC DIFF

Migration review reports destructive operations, nullability/default changes, enum/state changes, backfill assumptions, index/lock risk and historical-meaning implications.

# EXEC-1547 | ACTIVE | 1547. UI SEMANTIC DIFF

Visual regression is supplemented by semantic diff: patient identity moved/hidden, critical badge changed, button authority changed, default introduced, information state collapsed.

# EXEC-1548 | ACTIVE | 1548. SECURITY SEMANTIC DIFF

Report changed permissions, new data egress, new secrets, trust boundaries, public routes, third parties, CSP/network policy and encryption/key usage.

# EXEC-1549 | ACTIVE | 1549. AI SEMANTIC DIFF

Report changed model, prompt policy, retrieval sources, context budget, tool capability, schema, risk tier and eval slices.

# EXEC-1550 | ACTIVE | 1550. KNOWLEDGE SEMANTIC DIFF

Report changed populations, conditions, exceptions, thresholds, actions, strength, sources and jurisdiction/effective dates.

# EXEC-1551 | ACTIVE | 1551. PHYSICIAN SEMANTIC DIFF

For important UX changes, report expected difference in physician task sequence, required memory, clicks, information visibility and interruption recovery.

# EXEC-1552 | ACTIVE | 1552. CODEOWNERS BY RISK

C4/C5 directories require engineering owner plus appropriate clinical/safety/security reviewer. CODEOWNERS is not sufficient alone; CI verifies approval classes.

# EXEC-1553 | ACTIVE | 1553. MERGE GATES

Risk-based gates include type/static, unit/property, integration, authz/tenant, clinical regression, knowledge/algorithm validation, security, UX accessibility, performance and independent review.

# EXEC-1554 | ACTIVE | 1554. NO DIRECT PRODUCTION CHANGES

No manual production DB edits, prompt edits, knowledge edits or algorithm edits outside governed emergency procedure with audit, peer approval where feasible and subsequent reconciliation.

# EXEC-1555 | ACTIVE | 1555. EMERGENCY CHANGE

Emergency path is faster, not weaker: scoped change, incident link, authorized approver, backup, validation, monitoring, expiry and mandatory post-incident normalization.

# EXEC-1556 | ACTIVE | 1556. OPERABILITY BEFORE FEATURE COMPLETE

A feature is incomplete without dashboards, alerts, runbook, failure policy, reconciliation, rollback and support diagnosis. Operability is part of implementation.

# EXEC-1557 | ACTIVE | 1557. SUPPORT WITHOUT PHI EXPOSURE

Support tooling favors metadata, synthetic reproduction, redacted diagnostics and explicit audited elevation. Broad raw patient access is not a debugging strategy.

# EXEC-1558 | ACTIVE | 1558. PRODUCTION DATA ACCESS

Engineering access to production clinical data is exceptional, least-privileged, time-bound, approved/audited and jurisdiction/policy compliant. Prefer synthetic and privacy-preserving diagnostics.

# EXEC-1559 | ACTIVE | 1559. ANALYTICS SEPARATION

Operational analytics and population analytics use governed replicated/derived datasets with purpose controls. Analytical queries do not contend with critical transactional care paths.

# EXEC-1560 | ACTIVE | 1560. METRICS CARDINALITY CONTROL

Never put patient IDs, free text or unbounded clinical codes into metric labels. Use traces/logs with controlled identifiers and privacy policy for detailed diagnosis.

# EXEC-1561 | ACTIVE | 1561. LOGGING REDACTION

Structured allowlist logging. Raw request bodies, notes, documents, prompts and tokens are excluded by default. Redaction is tested with sentinel PHI strings.

# EXEC-1562 | ACTIVE | 1562. TRACE CORRELATION

Use opaque request/workflow correlation IDs across API, DB, queue, provider and audit without exposing patient identity in telemetry.

# EXEC-1563 | ACTIVE | 1563. ERROR TAXONOMY

Distinguish validation, authorization, conflict, dependency unavailable, ambiguous external state, safety block, knowledge unavailable, AI failure and internal defect. Generic 500 is not an operational model.

# EXEC-1564 | ACTIVE | 1564. USER ERROR LANGUAGE

UI errors tell physician what happened, what was saved, what was not, whether retry is safe and next action. Do not expose stack traces or cryptic codes as primary message.

# EXEC-1565 | ACTIVE | 1565. TRANSACTION BOUNDARIES

Clinical write + required audit/outbox can commit atomically when in same DB boundary. External calls happen after commit through durable workflows unless the domain explicitly requires another pattern.

# EXEC-1566 | ACTIVE | 1566. OUTBOX RECONCILIATION

Detect source rows that imply missing outbox/event and events without expected downstream state. Reconciliation can repair idempotently.

# EXEC-1567 | ACTIVE | 1567. INBOX DEDUPLICATION

External messages use stable provider/source IDs and semantic dedupe rules. Duplicate payloads cannot create duplicate clinical facts or obligations.

# EXEC-1568 | ACTIVE | 1568. WEBHOOK SECURITY

Verify signatures, timestamp/replay windows, source identity, schema, tenant routing and idempotency. Webhook payload cannot directly mutate clinical truth without domain validation.

# EXEC-1569 | ACTIVE | 1569. STORAGE OBJECT INTEGRITY

Private objects use content hash, metadata binding, malware/quarantine status, immutable originals, authorization checks and lifecycle policy. Database pointer without verified object is detectable.

# EXEC-1570 | ACTIVE | 1570. OBJECT ORPHAN RECONCILIATION

Detect DB rows with missing objects, objects with no authorized metadata, incomplete multipart uploads and retention mismatches.

# EXEC-1571 | ACTIVE | 1571. MIGRATION BACKFILL ENGINE

Large backfills are resumable, rate-limited, idempotent, observable, tenant-aware and verify before/after counts/checksums. They cannot monopolize clinical DB resources.

# EXEC-1572 | ACTIVE | 1572. ONLINE INDEX MANAGEMENT

Large indexes are planned/tested for lock, IO and write amplification. Query plans are benchmarked against skewed production-like distributions.

# EXEC-1573 | ACTIVE | 1573. QUERY BUDGETS

Interactive endpoints define max rows, max fan-out, pagination and latency budgets. Unbounded ORM relations are prohibited in high-cardinality domains.

# EXEC-1574 | ACTIVE | 1574. N+1 FITNESS TEST

Representative high-cardinality journeys include query-count assertions or tracing thresholds to catch accidental N+1 behavior before production.

# EXEC-1575 | ACTIVE | 1575. CACHE POLICY

Every cache entry defines authority, key scope, TTL, invalidation, stale policy and PHI classification. Safety-critical write decisions revalidate authoritative state rather than trusting stale cache.

# EXEC-1576 | ACTIVE | 1576. REALTIME POLICY

Realtime updates are advisory views over authoritative state. Reconnect performs snapshot reconciliation; missed websocket events cannot permanently lose clinical work.

# EXEC-1577 | ACTIVE | 1577. OFFLINE POLICY

Do not add offline clinical mutation casually. If future offline support is required, define conflict, identity, encryption, device loss, sync and safety semantics as a separate high-risk architecture.

# EXEC-1578 | ACTIVE | 1578. MOBILE SAFETY

Mobile prioritizes review, communication and bounded workflows unless full encounter safety/usability is validated. Small screen does not justify hiding critical context.

# EXEC-1579 | ACTIVE | 1579. PATIENT PORTAL ISOLATION

Portal identity, authorization, rate limits and data views are separate from clinician application. Patient-submitted data is clearly source-labeled and requires verification rules before high-impact use.

# EXEC-1580 | ACTIVE | 1580. COMMUNICATION CONSENT

Channel eligibility, consent/preferences, sensitive-content policy, delivery status and opt-out are explicit. Message sent ≠ delivered ≠ read ≠ clinically closed.

# EXEC-1581 | ACTIVE | 1581. APPOINTMENT SEMANTICS

Scheduled, confirmed, arrived, checked-in, in-progress, completed, cancelled and no-show are explicit states. Encounter clinical truth is not inferred solely from appointment state.

# EXEC-1582 | ACTIVE | 1582. BILLING BOUNDARY

Billing/operations may reference encounters/services but cannot silently change clinical state. Financial corrections do not rewrite signed clinical records.

# EXEC-1583 | ACTIVE | 1583. CLINICAL CONTENT LICENSING

Track licenses/usage restrictions for terminology, drug databases, guidelines and content. “Available on the internet” does not imply legal right to redistribute or compile into product.

# EXEC-1584 | ACTIVE | 1584. DATA RESIDENCY

Country/enterprise deployment declares allowed storage/processing regions and third-party egress. Architecture supports policy without hard-coding one jurisdiction globally.

# EXEC-1585 | ACTIVE | 1585. RETENTION / LEGAL HOLD

Retention rules are data-class/jurisdiction aware. Legal hold overrides ordinary deletion where applicable and is audited. Deletion requests never corrupt referential/audit obligations.

# EXEC-1586 | ACTIVE | 1586. CLINICAL SAFETY HAZARD TAXONOMY

Hazards include omission, commission, wrong patient, wrong time, wrong dose, wrong unit, stale information, missing follow-up, hidden critical result, false reassurance, automation bias and unavailable safety check.

# EXEC-1587 | ACTIVE | 1587. HAZARD CONTROL HIERARCHY

Prefer elimination by design, then deterministic prevention, then detection/reconciliation, then warnings/training. A warning banner is not the first solution to a preventable architecture defect.

# EXEC-1588 | ACTIVE | 1588. SAFETY MONITORING

Monitor incidents, near misses, overrides, safety-check unavailability, critical-result delay, obligation delay and wrong-patient prevented actions. Signals trigger review, not automatic clinical-rule rewriting.

# EXEC-1589 | ACTIVE | 1589. POSTMARKET LEARNING FIREWALL

Production behavior data can inform review, but no AI/rule/knowledge logic self-modifies from clinician clicks without governed analysis, validation and release.

# EXEC-1590 | ACTIVE | 1590. QUALITY ESCAPE ANALYSIS

Every escaped serious defect asks which earlier gate should have caught it and adds prevention/detection there, reducing dependence on final QA.

# EXEC-1591 | ACTIVE | 1591. DEFECT DENSITY BY INVARIANT

Track defects by violated invariant/root cause rather than only module. Repeated violations reveal weak primitives and architecture.

# EXEC-1592 | ACTIVE | 1592. ENGINEERING KNOWLEDGE BASE

ADRs, invariants, state machines, runbooks, hazards, algorithm manifests, knowledge artifacts and postmortems are versioned and searchable. Chat history is not the system of record.

# EXEC-1593 | ACTIVE | 1593. ROOT AGENTS.MD SIZE CONTROL

Do not place this entire specification into root AGENTS.md. Root agent instructions remain concise and point to authoritative product, engineering, safety, computation and domain documents by scope.

# EXEC-1594 | ACTIVE | 1594. AGENT TASK PACKET

Every coding-agent task includes issue ID, authoritative requirements, risk class, scope, files, invariants, forbidden changes, test plan, expected evidence and stop conditions.

# EXEC-1595 | ACTIVE | 1595. AGENT CONTEXT MINIMIZATION

Give coding agents the smallest authoritative context that preserves correctness. Huge undifferentiated prompts increase contradiction and omission risk.

# EXEC-1596 | ACTIVE | 1596. AGENT GENERATED CODE TRUST

Agent code is untrusted contribution until deterministic tests, static analysis, independent review and required clinical/security evidence pass.

# EXEC-1597 | ACTIVE | 1597. AGENT CLINICAL CONTENT PROHIBITION

Coding agents may scaffold algorithms/knowledge structures but cannot invent clinical thresholds, contraindications, dosing rules or guideline recommendations. Such content requires approved sources and clinical governance.

# EXEC-1598 | ACTIVE | 1598. AGENT SECURITY PROHIBITION

Agents cannot weaken RLS/authz, disable tests, add universal admin bypasses, expose secrets/PHI or change production security posture merely to make a task pass.

# EXEC-1599 | ACTIVE | 1599. AGENT STOP CONDITIONS 2.0

Stop on conflicting authoritative specs, unknown high-impact clinical behavior, uncertain units, unclear intended use, destructive migration, cross-tenant risk, audit bypass, unowned obligation/result, autonomous irreversible AI, unreviewed clinical content or failing critical invariant.

# EXEC-1600 | ACTIVE | 1600. REQUIREMENT ATOMICITY

Break giant requirements into atomic statements with ID, rationale, risk, acceptance, owner and traceability. One paragraph containing twenty obligations is not one testable requirement.

# EXEC-1601 | ACTIVE | 1601. INVARIANT ATOMICITY

Each invariant has scope, formal-ish statement, prevention, detection, recovery and tests. Avoid slogans without executable consequence.

# EXEC-1602 | ACTIVE | 1602. ACCEPTANCE EVIDENCE

Acceptance can require automated tests, screenshots, trace samples, migration output, clinical review, performance result, security report, restore evidence or usability result depending on risk.

# EXEC-1603 | ACTIVE | 1603. EVIDENCE EXPIRATION

Some evidence expires: penetration test, restore drill, AI evaluation, knowledge freshness and performance benchmarks. M6 status requires current evidence.

# EXEC-1604 | ACTIVE | 1604. ASSURANCE DASHBOARD

Show maturity and evidence freshness by capability/risk. Green means current evidence satisfies defined gate—not “no one reported a problem.”

# EXEC-1605 | ACTIVE | 1605. RISK-BASED RELEASE AUTHORITY

C0/C1 may use normal peer review; C2/C3 add domain/QA; C4 adds clinical/safety; C5 requires strongest independent clinical, numerical/security/reliability evidence appropriate to function.

# EXEC-1606 | ACTIVE | 1606. PHYSICIAN OVERRIDE ANALYSIS

High override rates can mean poor rule, wrong applicability, workflow mismatch or appropriate clinician judgment. Analyze context before changing thresholds.

# EXEC-1607 | ACTIVE | 1607. PHYSICIAN WORKAROUND DETECTION

Repeated copying to notes, external calculators, screenshots, paper lists or manual reminders indicate product failure or trust gap and enter product investigation.

# EXEC-1608 | ACTIVE | 1608. PHYSICIAN TIME BUDGET

For each encounter stage define target interaction budget and identify system-caused time. Do not optimize by removing clinically necessary review or making hidden defaults.

# EXEC-1609 | ACTIVE | 1609. DATA ONCE PRINCIPLE

If trustworthy data already exists and remains applicable, reuse it with provenance; do not ask again merely because another module owns a screen. Reconfirmation is explicit where clinically necessary.

# EXEC-1610 | ACTIVE | 1610. COMPUTE ONCE / VERIFY MANY

Authoritative deterministic derived facts are computed by one governed service/version and reused; independent implementations exist for validation, not competing production answers.

# EXEC-1611 | ACTIVE | 1611. SOURCE ONCE / INTERPRET VERSIONED

Immutable source observations/documents remain preserved while normalization, interpretation and knowledge layers can evolve versionedly.

# EXEC-1612 | ACTIVE | 1612. CLINICAL STATE IN SECONDS

Patient Workspace prioritizes a bounded high-signal state summary generated from structured longitudinal data with links to source evidence. It must not require scanning the entire chart.

# EXEC-1613 | ACTIVE | 1613. EXPLANATION ON DEMAND

High-impact algorithm/knowledge/AI outputs expose concise rationale first and deeper provenance on demand, avoiding both opaque automation and overwhelming default detail.

# EXEC-1614 | ACTIVE | 1614. NO AI THEATER

Do not add AI badges, chat panels or generated prose where deterministic state, search or well-designed UI solves the task better.

# EXEC-1615 | ACTIVE | 1615. NO COMPLEXITY THEATER

Do not add microservices, graph databases, vector databases, event sourcing, formal methods or custom DSL merely because the system is ambitious. Each must solve a measured problem with lower total risk than alternatives.

# EXEC-1616 | ACTIVE | 1616. NO SCALE THEATER

Do not design for impossible theoretical combinations at the expense of real workload. Preserve scale escape hatches through contracts, partition keys and stateless services, then benchmark actual cardinalities.

# EXEC-1617 | ACTIVE | 1617. NO SECURITY THEATER

Encryption labels and framework names are not security. Require threat model, key lifecycle, authorization, testing, monitoring, incident response and evidence.

# EXEC-1618 | ACTIVE | 1618. NO COMPLIANCE THEATER

A checklist or standard mapping is not certification/compliance. Maintain requirement→control→evidence→test→owner and obtain qualified legal/regulatory assessment for target jurisdictions.

# EXEC-1619 | ACTIVE | 1619. NO VALIDATION THEATER

2,000 synthetic doctors, millions of synthetic patients or billions of generated tests cannot replace real clinician validation, representative data, independent review and production monitoring.

# EXEC-1620 | ACTIVE | 1620. SYSTEM OF SYSTEMS VIEW

Medical OS comprises interacting clinical, workflow, knowledge, AI, security, identity, data, interoperability, communication and operational systems. Optimize local modules only within global invariants.

# EXEC-1621 | ACTIVE | 1621. GLOBAL INVARIANT CATALOG

At minimum: tenant isolation; patient-context binding; signed immutability; provenance preservation; no silent unknown→negative; no silent AI authority escalation; no orphan critical work; deterministic safety core; idempotent external effects; reconstructable high-impact decisions.

# EXEC-1622 | ACTIVE | 1622. GLOBAL RECOVERY CATALOG

For each invariant define how the system detects historical violations and repairs/contains them. Prevention without retrospective detection is incomplete.

# EXEC-1623 | ACTIVE | 1623. SYSTEM-WIDE KILL SWITCHES

Provide scoped disable controls for AI task, knowledge pack, algorithm version, integration, communication channel and feature. Kill switches are tested, audited and designed not to disable unrelated clinical core.

# EXEC-1624 | ACTIVE | 1624. SAFE MODE

Define a reduced-capability mode preserving patient lookup, chart read, critical work visibility, basic encounter documentation, deterministic core and audit during selected dependency failures.

# EXEC-1625 | ACTIVE | 1625. DOWNTIME PROCEDURE

Document and rehearse what clinicians do if core platform is unavailable, how temporary records are protected and how they reconcile after restoration. Software architecture includes operational continuity.

# EXEC-1626 | ACTIVE | 1626. RECOVERY PRIORITY

Restore identity/authz, chart/source truth, critical results/obligations, audit/workflows, documents, projections/search, integrations and secondary AI/analytics according to risk—not cosmetic dependency order.

# EXEC-1627 | ACTIVE | 1627. 150-EXPERT PARALLELIZATION LAW

Parallelize implementation only after shared semantic kernel, contracts, invariants, repository boundaries and test harness exist. Otherwise 150 experts create 150 incompatible interpretations faster.

# EXEC-1628 | ACTIVE | 1628. TEAM INTERFACE CONTRACTS

Each team publishes APIs/events/schema, ownership, invariants, SLO, failure semantics and version policy. Cross-team dependencies use contracts, not tribal knowledge.

# EXEC-1629 | ACTIVE | 1629. ARCHITECTURE REVIEW CADENCE

Weekly domain reviews, biweekly cross-domain hazard review, release-specific C4/C5 councils, monthly reliability/security evidence review and periodic architecture simplification review.

# EXEC-1630 | ACTIVE | 1630. SIMPLIFICATION REVIEW

Every quarter identify abstractions, flags, adapters, services and rules that can be removed without reducing capability. Sophistication includes deleting unnecessary complexity.

# EXEC-1631 | ACTIVE | 1631. TECHNICAL DEBT RISK MODEL

Debt is tagged by safety, security, reliability, scale, maintainability and velocity impact. High-risk debt gets explicit owner/deadline and cannot hide as generic backlog.

# EXEC-1632 | ACTIVE | 1632. DEPRECATION

APIs, algorithms, knowledge artifacts, terminology and UI flows have deprecation periods, telemetry and migration paths. Historical reproducibility survives retirement.

# EXEC-1633 | ACTIVE | 1633. VERSION VECTOR

A high-impact output can be reconstructed from a compact version vector: app, schema, algorithm, knowledge, terminology, AI task/model config, country/specialty pack and relevant policy.

# EXEC-1634 | ACTIVE | 1634. CLINICAL ACTION RECEIPT

For selected high-impact actions create an internal receipt containing actor, patient, encounter, intent, source facts, safety checks, versions, outcome, side effects and audit references.

# EXEC-1635 | ACTIVE | 1635. PATIENT IMPACT QUERY

Given incident/version/artifact/model/task, efficiently identify potentially affected patients/actions without scanning arbitrary unindexed blobs.

# EXEC-1636 | ACTIVE | 1636. DATA LINEAGE QUERY

Given a displayed fact/recommendation, traverse backward to source and forward to dependent calculations/alerts/obligations/actions, subject to authorization.

# EXEC-1637 | ACTIVE | 1637. REPRODUCIBLE CLINICAL REPLAY

For incident analysis, replay deterministic computation/knowledge using historical version vector and source facts. AI replay is not assumed deterministic; preserve request/config/output evidence subject to privacy policy.

# EXEC-1638 | ACTIVE | 1638. AI REPRODUCIBILITY LIMIT

Record enough model/task/config/context/evidence metadata for investigation, but do not falsely promise byte-identical reproduction of stochastic external models.

# EXEC-1639 | ACTIVE | 1639. KNOWLEDGE REPRODUCIBILITY

Historical approved knowledge packages remain content-addressable and executable in isolated replay environment even after supersession, subject to licensing/retention.

# EXEC-1640 | ACTIVE | 1640. ALGORITHM REPRODUCIBILITY

Historical algorithm versions remain buildable/testable or have preserved executable artifact/source and manifest sufficient for audit/replay.

# EXEC-1641 | ACTIVE | 1641. DATABASE REPRODUCIBILITY

Migration chain and schema snapshots permit reconstructing relevant historical schema for audit/test. Never rely solely on current ORM models to interpret old records.

# EXEC-1642 | ACTIVE | 1642. DESIGN REPRODUCIBILITY

For high-impact UX incidents retain versioned design/component behavior and visual/semantic regression artifacts sufficient to understand what clinician saw.

# EXEC-1643 | ACTIVE | 1643. 30-CYCLE EXIT CRITERIA

The 30-pass circuit can exit only when:
- no unresolved S0/S1;
- all C5 global invariants have prevention + detection + recovery + evidence;
- S2 risks are explicitly governed;
- all new architectural assumptions are registered;
- affected passes were rerun after major fixes;
- real-clinician validation plan exists for C4/C5;
- residual risk is explicit.

# EXEC-1644 | ACTIVE | 1644. WHAT 100% MEANS

“100%” cannot mean all theoretical clinical states are proven safe. In this architecture it means 100% of declared critical invariants/reference cases/gates for the defined intended use pass, with known residual risks documented. Never convert that into a universal safety claim.

# EXEC-1645 | ACTIVE | 1645. THE MONSTER SYSTEM RULE

The system may be enormous in capability but must remain small in each local reasoning boundary. A developer should reason about one aggregate, one state machine, one algorithm or one workflow without loading the entire platform into memory.

# EXEC-1646 | ACTIVE | 1646. THE NANOMETER-BEYOND-NANOMETER RULE

When a requirement says “every letter, button, action, database, link, security and encryption,” translate ambition into machine-verifiable contracts: semantic UI contracts, typed domain contracts, data contracts, authz policies, cryptographic key lifecycle, workflow state machines, observability, reconciliation and evidence. Precision comes from explicitness, not document length alone.

# EXEC-1647 | ACTIVE | 1647. FINAL HYPERSCALE PRINCIPLE

Medical OS should behave as a clinically governed distributed system whose complexity is decomposed into bounded, testable, reconstructable units. The architecture must remain safe when AI is wrong, a provider is down, a message is duplicated, a clinician is interrupted, a database transaction conflicts, a guideline changes, a patient is switched, a result is corrected, a key rotates or a deployment partially fails.

# EXEC-1648 | ACTIVE | 1648. FINAL 150-EXPERT CONSTITUTION

The target is not a “perfect document.” The target is an executable architecture in which every high-impact behavior has:
**owner + authority + source + semantics + state + invariant + implementation boundary + test oracle + failure policy + recovery + telemetry + version + audit + evidence + human governance.**
Only then does complexity become controlled capability instead of uncontrolled risk.


# EXEC-1649 | ACTIVE | 1649. ULTRA-SENIOR TARGET ARCHITECTURE EXECUTION UPDATE

**Authority:** Medical OS V2.1.1 Ultra-Senior Target Architecture, engineering sections 212–301.  
**Purpose:** translate the newly approved engineering architecture into execution rules for human developers, Codex, Claude Code and other implementation agents without allowing the Companion to redefine product intent.

## 1649.1 Source-of-truth rule

- V2 remains the product/clinical authority until PRODUCT-GAP items are explicitly promoted.
- V2.1.1 is the engineering authority for the target architecture.
- This Companion defines execution behavior, verification obligations, stop conditions and implementation discipline.
- If this Companion conflicts with V2.1.1, **V2.1.1 wins** and the conflict must be reported.
- If V2.1.1 introduces physician-visible behavior absent from V2, preserve `PRODUCT-GAP` status and do not silently activate it in unrestricted production.

## 1649.2 Execution law for the new architecture

For every new capability, the implementing agent MUST identify:

```text
PRODUCT AUTHORITY / PRODUCT-GAP
ENGINEERING REQUIREMENT
DOMAIN OWNER
DATA AUTHORITY
COMPUTATION AUTHORITY
MUTATION AUTHORITY
INFORMATION STATES
PROVENANCE
AUTHORIZATION
AUDIT
STATE MACHINE
DEPENDENCIES
INVARIANTS
HAZARDS
FAILURE POLICY
RECONCILIATION
OBSERVABILITY
TEST ORACLE
ROLLBACK / RECOVERY
RELEASE EVIDENCE
```

A capability is not complete merely because its UI, endpoint or database table exists.


## 1649.3 Execution contract — ENG 212: PRINCIPAL-ENGINEER REVIEW QUESTIONS

**Engineering authority:** V2.1.1 §212.

### MUST preserve
- Before approving infrastructure ask:
- Can every historical result be reproduced?
- Can every threshold be traced?
- Can every unit conversion be reconstructed?
- Can a new version be compared against the old?
- Can it run in shadow?
- Can it be killed without redeploy?
- Does failure become visible?
- Can the physician continue safely without AI?
- Can stale/unverified data be prevented from entering high-risk computation?
- Can a source update identify every downstream dependency?
- Can an agent modify medical policy without approval? It must not.
- Can a tenant ever influence another tenant's computation? It must not.
- Can duplicated/out-of-order events cause duplicate clinical actions? They must not.
- Can an algorithm silently change behavior without a new immutable version? It must not.
- Can a clinician understand why a clinically important result appeared?
- Can safety reviewers prove the critical state-machine invariants?
- Can rollback preserve audit/provenance?
- Can the platform survive AI/knowledge/provider outages?
- Can we demonstrate validation evidence rather than assert quality?
- Is the simplest safe mechanism being used?
- Any “no” requires a documented blocker or risk acceptance by the proper authority.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.4 Execution contract — ENG 213: CLINICAL COMPUTATION PLATFORM FREEZE GATE

**Engineering authority:** V2.1.1 §213.

### MUST preserve
- This architecture becomes frozen only after the implementation team creates and approves the corresponding ADRs and proves a vertical slice containing at minimum:
- one low-risk formula;
- one high-risk medication calculation;
- one longitudinal trend;
- one knowledge artifact;
- one applicability rule;
- one unit conversion;
- one not-computable case;
- one stale-data case;
- one corrected-result case;
- one shadow version;
- one behavioral diff;
- one kill-switch exercise;
- one historical reproduction;
- one knowledge source update impact analysis;
- one cross-tenant isolation test;
- one failure-injection test.
- Until that evidence exists, this section is a **freeze candidate**, not a claim of production perfection.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.5 Execution contract — ENG 214: FINAL INFRASTRUCTURE LAW

**Engineering authority:** V2.1.1 §214.

### MUST preserve
- Medical OS must be designed for enormous combinatorial clinical complexity without pretending that every clinical possibility can be predicted.
- The platform handles complexity by enforcing:
- typed data
+ explicit units
+ explicit time
+ explicit provenance
+ deterministic primitives
+ versioned knowledge
+ bounded composition
+ explicit uncertainty
+ independent validation
+ immutable artifacts
+ dependency analysis
+ controlled release
+ observable runtime
+ safe failure
+ physician authority
- The objective is not an algorithm that appears intelligent.
- The objective is a **Clinical Computation Platform whose correctness can be inspected, challenged, reproduced, upgraded, disabled and defended with evidence.**
- When uncertainty cannot be safely resolved:
- **Medical OS must fail explicitly rather than fabricate certainty.**
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.6 Execution contract — ENG 215: ULTRA-HARDENING REVIEW — SYSTEMIC FAILURE ANALYSIS

**Engineering authority:** V2.1.1 §215.

### MUST preserve
- This section records a further principal/staff-level review of the Clinical Computation Platform.
- The objective is not ornamental complexity. Every added mechanism must eliminate a concrete failure class, create evidence, improve recoverability, or reduce ambiguity.
- The following failure classes require explicit architecture:
- specification ambiguity;
- correlated implementation error;
- semantic drift;
- unit/terminology drift;
- temporal inconsistency;
- provenance loss;
- dependency drift;
- unsafe partial failure;
- stale derived state;
- incorrect recomputation;
- non-deterministic builds;
- hidden configuration drift;
- validation-data leakage;
- benchmark overfitting;
- feedback loops;
- alert/rule interaction explosions;
- combinatorial rule conflicts;
- authorization-context loss in asynchronous work;
- unsafe rollback;
- irreversible migration;
- silent evidence supersession;
- false confidence from aggregate metrics.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.7 Execution contract — ENG 216: SPECIFICATION AS EXECUTABLE CONTRACT

**Engineering authority:** V2.1.1 §216.

### MUST preserve
- For C3+ algorithms, prose specification alone is insufficient.
- Maintain a machine-checkable contract containing:
- input schema;
- unit schema;
- temporal constraints;
- applicability;
- exclusions;
- invariants;
- output schema;
- failure semantics;
- dependency versions;
- reference cases.
- The contract and implementation must be tested against each other.
- A change to the contract triggers behavioral review even if implementation code is unchanged.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.8 Execution contract — ENG 217: REQUIREMENT-TO-RUNTIME TRACEABILITY

**Engineering authority:** V2.1.1 §217.

### MUST preserve
- Every clinically consequential runtime output must trace backward:
- runtime output
→ algorithm/knowledge artifact
→ implementation version
→ validation report
→ specification
→ product requirement
→ evidence/source
→ approving authority
- And forward:
- source/requirement
→ affected artifacts
→ affected tests
→ affected screens/workflows
→ affected releases
- Traceability must be queryable, not maintained only in prose.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.9 Execution contract — ENG 218: CONFIGURATION IS CODE-EQUIVALENT

**Engineering authority:** V2.1.1 §218.

### MUST preserve
- Clinically meaningful configuration is governed like code.
- Examples:
- thresholds;
- escalation intervals;
- critical-value policies;
- feature applicability;
- country overrides;
- dose rounding policy.
- Requirements:
- versioned;
- reviewed;
- validated;
- auditable;
- environment promotion;
- rollback;
- no direct production editing for high-risk settings.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.10 Execution contract — ENG 219: ENVIRONMENT PARITY AND DRIFT DETECTION

**Engineering authority:** V2.1.1 §219.

### MUST preserve
- Clinical behavior must not differ accidentally between validation and production.
- Track:
- artifact versions;
- terminology versions;
- environment variables affecting behavior;
- database extensions;
- runtime versions;
- feature flags;
- country packs;
- external adapter versions.
- Generate an environment fingerprint.
- Unexpected drift in clinically relevant dependencies blocks promotion.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.11 Execution contract — ENG 220: DETERMINISTIC BUILD AND EXECUTION FINGERPRINT

**Engineering authority:** V2.1.1 §220.

### MUST preserve
- For every high-risk computation, produce a fingerprint from:
- source commit;
- build artifact hash;
- dependency lock;
- algorithm manifest;
- terminology manifest;
- knowledge manifest;
- runtime major version;
- relevant configuration hash.
- This allows forensic reconstruction of behavior.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.12 Execution contract — ENG 221: FEATURE-FLAG SAFETY MODEL

**Engineering authority:** V2.1.1 §221.

### MUST preserve
- Feature flags influencing clinical behavior require:
- owner;
- intended population;
- default state;
- expiration/review date;
- audit;
- compatibility tests;
- rollback behavior.
- Never allow an expired experimental clinical flag to remain indefinitely.
- Flag combinations with clinical consequences require pairwise/combinatorial testing proportional to risk.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.13 Execution contract — ENG 222: COMBINATORIAL INTERACTION TESTING

**Engineering authority:** V2.1.1 §222.

### MUST preserve
- Many defects emerge from interactions rather than isolated algorithms.
- Use pairwise/t-wise testing for combinations such as:
- country pack;
- specialty pack;
- age group;
- unit system;
- feature flags;
- algorithm version;
- terminology version;
- missing-data state;
- patient-state status.
- For high-risk combinations, define explicit scenario suites.
- Do not attempt exhaustive Cartesian-product testing when impossible; use risk-based combinatorial design plus invariants.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.14 Execution contract — ENG 223: RULE INTERACTION GRAPH

**Engineering authority:** V2.1.1 §223.

### MUST preserve
- Rules can conflict even when individually correct.
- Build a graph of:
- triggers;
- outputs;
- suppressions;
- dependencies;
- mutual exclusions;
- priorities.
- Detect:
- contradictory recommendations;
- circular triggering;
- duplicate alerts;
- impossible obligations;
- escalation storms.
- Run static interaction analysis before knowledge-pack activation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.15 Execution contract — ENG 224: CONFLICT ARBITRATION POLICY

**Engineering authority:** V2.1.1 §224.

### MUST preserve
- When two approved deterministic/knowledge rules conflict, runtime must not improvise.
- Resolution can be:
- jurisdiction precedence;
- specialty governance;
- more-specific population;
- explicit suppression;
- clinician-visible conflict;
- governance-selected policy.
- Every arbitration is versioned.
- Unresolved high-risk conflict blocks automated recommendation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.16 Execution contract — ENG 225: DERIVED-DATA INVALIDATION GRAPH

**Engineering authority:** V2.1.1 §225.

### MUST preserve
- Every derived datum should know what source facts produced it.
- When a source changes:
- mark affected derived data stale;
- recompute if policy permits;
- preserve historical version;
- prevent stale output from masquerading as current.
- Examples:
- BMI depends on weight + height;
- trend depends on observation series;
- care gap depends on last qualifying event;
- patient state depends on multiple facts.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.17 Execution contract — ENG 226: MATERIALIZED VIEW CONSISTENCY

**Engineering authority:** V2.1.1 §226.

### MUST preserve
- Patient State and other read models are projections, not truth.
- Define:
- source-of-truth entities;
- projection version;
- projector version;
- rebuild procedure;
- lag SLO;
- consistency checks.
- A projection must be rebuildable from authoritative events/data.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.18 Execution contract — ENG 227: RECONCILIATION JOBS

**Engineering authority:** V2.1.1 §227.

### MUST preserve
- Create periodic reconciliation for critical derived state:
- obligations;
- result closure;
- patient-state projections;
- algorithm registry status;
- dependency graph;
- notifications.
- Reconciliation compares expected state with materialized state and produces repair work—not silent destructive repair for clinically consequential discrepancies.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.19 Execution contract — ENG 228: DATA INVARIANT ENFORCEMENT LAYERS

**Engineering authority:** V2.1.1 §228.

### MUST preserve
- Important invariants should be enforced at the strongest appropriate layer:
- type system
→ schema validation
→ domain invariant
→ transaction
→ database constraint
→ workflow/state machine
→ reconciliation
- Do not rely on UI validation for clinical integrity.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.20 Execution contract — ENG 229: DATABASE CONSTRAINT STRATEGY

**Engineering authority:** V2.1.1 §229.

### MUST preserve
- Where semantics permit, use:
- NOT NULL;
- CHECK;
- UNIQUE;
- FK;
- exclusion constraints;
- partial unique indexes;
- transaction isolation;
- RLS defense-in-depth.
- Do not encode medical knowledge directly into brittle database constraints when it requires frequent clinical governance/versioning.
- Separate data-integrity constraints from evolving clinical-policy rules.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.21 Execution contract — ENG 230: TRANSACTIONAL CONSISTENCY BOUNDARY

**Engineering authority:** V2.1.1 §230.

### MUST preserve
- Define which actions must commit atomically.
- Example:
- clinical state mutation
+ provenance
+ audit
+ outbox event
- should commonly share a transaction.
- External notifications, AI calls and third-party integrations occur after commit.
- Never hold a database transaction open while waiting for an LLM or remote lab API.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.22 Execution contract — ENG 231: SAGA / WORKFLOW COMPENSATION

**Engineering authority:** V2.1.1 §231.

### MUST preserve
- Multi-system workflows require explicit compensation.
- For each step define:
- success;
- retry;
- timeout;
- permanent failure;
- compensation;
- manual recovery.
- Compensation must not erase clinical history.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.23 Execution contract — ENG 232: ASYNC AUTHORIZATION CONTEXT

**Engineering authority:** V2.1.1 §232.

### MUST preserve
- Background workers must not inherit vague “system” authority.
- Persist a constrained execution context:
- originating tenant;
- initiating actor/service;
- purpose;
- permitted operation;
- correlation ID.
- Workers revalidate current policy where required.
- Never trust serialized frontend permissions.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.24 Execution contract — ENG 233: SERVICE IDENTITY

**Engineering authority:** V2.1.1 §233.

### MUST preserve
- Every worker/service has a distinct identity and least-privilege permissions.
- No shared omnipotent application credential for all subsystems.
- High-risk operations should be attributable to service identity + originating human/context.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.25 Execution contract — ENG 234: BREAK-GLASS COMPUTATION ACCESS

**Engineering authority:** V2.1.1 §234.

### MUST preserve
- Emergency access to computation or protected data:
- explicit;
- time-limited;
- reason required;
- heavily audited;
- reviewed.
- Break-glass cannot bypass immutable signed-record semantics or alter algorithm governance.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.26 Execution contract — ENG 235: CRYPTOGRAPHIC INTEGRITY OPTIONS

**Engineering authority:** V2.1.1 §235.

### MUST preserve
- For high-value manifests/evidence bundles, support cryptographic integrity verification:
- artifact hash;
- signed release attestations where infrastructure permits;
- append-only audit controls;
- verification tooling.
- Do not market cryptographic integrity as nonrepudiation unless the complete legal/technical system supports that claim.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.27 Execution contract — ENG 236: AUDIT TAMPER EVIDENCE

**Engineering authority:** V2.1.1 §236.

### MUST preserve
- Audit design should make unauthorized alteration detectable.
- Possible controls:
- append-only storage semantics;
- hash chaining/batching;
- restricted write path;
- immutable backups;
- independent retention.
- Select implementation through ADR and threat model.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.28 Execution contract — ENG 237: PROVENANCE GRANULARITY POLICY

**Engineering authority:** V2.1.1 §237.

### MUST preserve
- Avoid both extremes:
- too little provenance to reconstruct;
- so much provenance that privacy/cost becomes unmanageable.
- Define provenance tiers by risk.
- C4/C5 require enough detail for calculation reconstruction and safety investigation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.29 Execution contract — ENG 238: PRIVACY-PRESERVING OBSERVABILITY

**Engineering authority:** V2.1.1 §238.

### MUST preserve
- Observability should use:
- opaque IDs;
- bounded metadata;
- hashes where useful;
- allowlisted attributes;
- separate protected clinical audit.
- Never solve debugging by dumping clinical payloads into logs.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.30 Execution contract — ENG 239: VALIDATION CORPUS SEPARATION

**Engineering authority:** V2.1.1 §239.

### MUST preserve
- Maintain separate datasets:
- development;
- visible validation;
- hidden holdout;
- adversarial;
- regression;
- post-release incident cases.
- Agents/developers must not optimize directly against every hidden holdout case.
- This reduces benchmark overfitting.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.31 Execution contract — ENG 240: BENCHMARK CONTAMINATION CONTROL

**Engineering authority:** V2.1.1 §240.

### MUST preserve
- Track whether benchmark cases may have appeared in:
- training data;
- public repositories;
- prompts;
- previous agent context.
- Where independence matters, create private synthetic/clinician-authored cases.
- A high score on leaked examples is not evidence of generalization.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.32 Execution contract — ENG 241: VALIDATION STATISTICS

**Engineering authority:** V2.1.1 §241.

### MUST preserve
- When reporting performance, include:
- numerator/denominator;
- confidence intervals where meaningful;
- subgroup counts;
- exclusions;
- missing-data handling;
- failure classes.
- Do not report “99% accurate” without defining the task and denominator.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.33 Execution contract — ENG 242: SAFETY-CRITICAL ERROR BUDGET

**Engineering authority:** V2.1.1 §242.

### MUST preserve
- Operational error budgets do not permit known unsafe clinical outputs.
- Separate:
- availability error budget;
- latency error budget;
- safety defect tolerance.
- For designated catastrophic invariants, tolerance is zero known unresolved defects.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.34 Execution contract — ENG 243: SEVERITY MODEL FOR COMPUTATION DEFECTS

**Engineering authority:** V2.1.1 §243.

### MUST preserve
- Example:
- S0 — catastrophic potential / immediate suspension
S1 — serious patient-safety risk
S2 — clinically consequential incorrect behavior
S3 — limited clinical/operational impact
S4 — cosmetic/nonclinical
- Define response SLA, kill-switch policy and review authority per severity.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.35 Execution contract — ENG 244: NEAR-MISS CAPTURE

**Engineering authority:** V2.1.1 §244.

### MUST preserve
- Capture near misses:
- physician caught wrong applicability;
- unit mismatch prevented;
- duplicate alert suppressed;
- stale value blocked;
- incorrect AI extraction rejected.
- Near misses are valuable safety evidence and should feed governance review.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.36 Execution contract — ENG 245: FEEDBACK-LOOP FIREWALL

**Engineering authority:** V2.1.1 §245.

### MUST preserve
- Do not automatically learn clinical policy from clinician clicks/overrides.
- Feedback may be biased by:
- workflow pressure;
- alert fatigue;
- local habits;
- incomplete information.
- Feedback creates hypotheses for review, not automatic medical truth.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.37 Execution contract — ENG 246: MODEL/ALGORITHM FEEDBACK SEPARATION

**Engineering authority:** V2.1.1 §246.

### MUST preserve
- Keep separate:
- deterministic algorithm performance;
- knowledge-rule performance;
- AI model performance;
- UI acceptance behavior.
- Otherwise a bad UI can be misdiagnosed as a bad clinical rule.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.38 Execution contract — ENG 247: AI CONFIDENCE IS NOT CLINICAL CONFIDENCE

**Engineering authority:** V2.1.1 §247.

### MUST preserve
- Model probability/self-reported confidence cannot be directly interpreted as probability that a clinical statement is correct.
- Clinical confidence presentation must be based on:
- evidence;
- data completeness;
- source agreement;
- validation;
- task-specific calibration where demonstrated.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.39 Execution contract — ENG 248: CALIBRATION FRAMEWORK

**Engineering authority:** V2.1.1 §248.

### MUST preserve
- For probabilistic models used in bounded clinical-support tasks:
- evaluate calibration;
- reliability curves;
- threshold sensitivity;
- abstention behavior;
- subgroup performance.
- Use calibrated thresholds only for the validated task/population.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.40 Execution contract — ENG 249: ABSTENTION AS A FEATURE

**Engineering authority:** V2.1.1 §249.

### MUST preserve
- AI/ML systems must support:
- insufficient evidence;
- unsupported task;
- out-of-distribution;
- low confidence;
- conflicting sources.
- A safe abstention can be superior to a fluent answer.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.41 Execution contract — ENG 250: OUT-OF-DISTRIBUTION DETECTION

**Engineering authority:** V2.1.1 §250.

### MUST preserve
- Where feasible, detect inputs materially outside validation scope.
- Examples:
- unsupported age;
- unsupported language;
- unknown document type;
- unseen unit;
- incompatible modality.
- OOD detection triggers abstention/manual review, not confident extrapolation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.42 Execution contract — ENG 251: CLINICAL LANGUAGE NORMALIZATION BOUNDARY

**Engineering authority:** V2.1.1 §251.

### MUST preserve
- NLP normalization from free text creates candidate structured facts.
- Require:
- source span;
- extraction confidence;
- negation;
- temporality;
- experiencer;
- uncertainty;
- verification state.
- “Mother had diabetes” must not become patient diabetes.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.43 Execution contract — ENG 252: NEGATION / EXPERIENCER / TEMPORALITY TEST SUITE

**Engineering authority:** V2.1.1 §252.

### MUST preserve
- Mandatory NLP adversarial cases:
- denies chest pain;
- history of chest pain, resolved;
- father had MI;
- rule out pneumonia;
- possible allergy;
- no known allergies;
- allergy status unknown;
- medication discontinued.
- Structured extraction must preserve semantic distinctions.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.44 Execution contract — ENG 253: DOCUMENT VERSION SEMANTICS

**Engineering authority:** V2.1.1 §253.

### MUST preserve
- When an external report is amended/corrected:
- preserve all versions;
- identify latest authoritative version;
- mark superseded extraction;
- recompute derived state if appropriate;
- preserve what the physician saw at historical decision time.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.45 Execution contract — ENG 254: SOURCE-OF-TRUTH PRIORITY

**Engineering authority:** V2.1.1 §254.

### MUST preserve
- When data disagree, do not globally define one simplistic priority.
- Conflict resolution may depend on domain:
- direct device feed vs transcribed value;
- corrected lab vs original;
- physician-verified allergy vs imported list;
- patient report vs external record.
- Represent conflict and domain-specific resolution policy.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.46 Execution contract — ENG 255: DUPLICATE CLINICAL FACT DETECTION

**Engineering authority:** V2.1.1 §255.

### MUST preserve
- Duplicate facts can inflate evidence.
- Implement deduplication/reconciliation using:
- identifiers;
- source;
- timestamp;
- code;
- value;
- document provenance.
- Do not count the same imported lab twice merely because it arrived through two interfaces.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.47 Execution contract — ENG 256: CAUSAL CLAIM BOUNDARY

**Engineering authority:** V2.1.1 §256.

### MUST preserve
- Trend/correlation engines must not present correlation as causation.
- AI explanations must use language consistent with evidence.
- Causal inference requires separately validated methodology and intended use.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.48 Execution contract — ENG 257: COUNTERFACTUAL BOUNDARY

**Engineering authority:** V2.1.1 §257.

### MUST preserve
- Do not generate patient-specific counterfactual treatment claims as factual outcomes unless supported by a validated model and approved intended use.
- “What would happen if…” remains decision support with uncertainty, not prediction certainty.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.49 Execution contract — ENG 258: POPULATION-BIAS REVIEW

**Engineering authority:** V2.1.1 §258.

### MUST preserve
- Knowledge and model validation must ask:
- who was represented?
- who was excluded?
- which settings?
- which countries?
- which assays/devices?
- which languages?
- Do not silently universalize evidence beyond validated applicability.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.50 Execution contract — ENG 259: LOCALIZATION VS CLINICAL SEMANTICS

**Engineering authority:** V2.1.1 §259.

### MUST preserve
- Translation must not alter clinical meaning.
- Separate:
- canonical clinical concept;
- locale display string;
- legal wording;
- patient-facing readability.
- Clinical logic runs on canonical concepts, not translated labels.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.51 Execution contract — ENG 260: INTERNATIONAL UNIT DISPLAY

**Engineering authority:** V2.1.1 §260.

### MUST preserve
- Country/user display preferences may differ, but computation uses canonical normalized units.
- UI must make converted/original values distinguishable where clinically relevant.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.52 Execution contract — ENG 261: EXTERNAL DEPENDENCY CONTRACT TESTING

**Engineering authority:** V2.1.1 §261.

### MUST preserve
- For labs, terminology, medication databases, identity providers and other services:
- schema contract tests;
- version compatibility;
- timeout behavior;
- malformed response tests;
- duplicate/replay tests;
- degraded-mode tests.
- External success responses are still validated.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.53 Execution contract — ENG 262: THIRD-PARTY DATA LICENSING GATE

**Engineering authority:** V2.1.1 §262.

### MUST preserve
- Before embedding medical knowledge/terminology/drug data:
- verify license;
- permitted storage;
- redistribution;
- derivative works;
- update rights;
- jurisdiction.
- Technical availability does not imply legal permission.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.54 Execution contract — ENG 263: DATA RESIDENCY / JURISDICTION HOOKS

**Engineering authority:** V2.1.1 §263.

### MUST preserve
- Architecture should permit future residency constraints without changing clinical domain semantics.
- Country/enterprise policy can control:
- storage region;
- processing region;
- AI provider eligibility;
- export;
- retention.
- Do not promise residency configurations until infrastructure actually supports them.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.55 Execution contract — ENG 264: RETENTION DEPENDENCY AWARENESS

**Engineering authority:** V2.1.1 §264.

### MUST preserve
- Deletion/retention must consider derived artifacts and legal requirements.
- Deleting a source record may affect:
- derived state;
- provenance;
- audit;
- validation evidence;
- legal hold.
- No cascade delete of clinical history without explicit policy.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.56 Execution contract — ENG 265: RIGHT-TO-CORRECTION VS IMMUTABILITY

**Engineering authority:** V2.1.1 §265.

### MUST preserve
- Support correction without destructive history rewrite.
- Pattern:
- supersede;
- amend;
- entered-in-error;
- corrected version;
- provenance relationship.
- Immutability does not mean clinically incorrect data remains presented as current truth.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.57 Execution contract — ENG 266: SCHEMA EVOLUTION

**Engineering authority:** V2.1.1 §266.

### MUST preserve
- Clinical schemas evolve via expand-and-contract.
- Requirements:
- backwards-compatible reads during migration;
- migration validation;
- historical reconstruction;
- no silent semantic reinterpretation;
- versioned serializers where needed.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.58 Execution contract — ENG 267: EVENT SCHEMA VERSIONING

**Engineering authority:** V2.1.1 §267.

### MUST preserve
- Domain/outbox events include schema version.
- Consumers must:
- support defined compatibility window;
- reject unknown incompatible versions safely;
- not reinterpret old payload semantics using new assumptions.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.59 Execution contract — ENG 268: REPLAY LAB

**Engineering authority:** V2.1.1 §268.

### MUST preserve
- Maintain a nonproduction replay environment capable of:
- replaying synthetic event histories;
- switching algorithm versions;
- switching knowledge versions;
- injecting failures;
- comparing final Patient State.
- This is essential for regression investigation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.60 Execution contract — ENG 269: DIGITAL TWIN / SYNTHETIC PATIENT SCENARIOS

**Engineering authority:** V2.1.1 §269.

### MUST preserve
- Build synthetic longitudinal patient scenarios, not only isolated test rows.
- Scenarios include:
- years of labs;
- medication changes;
- missed follow-up;
- corrections;
- referrals;
- duplicated imports;
- changing diagnoses;
- aging/life-stage transitions.
- Use them to validate system-level behavior.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.61 Execution contract — ENG 270: STATE-SPACE EXPLORATION

**Engineering authority:** V2.1.1 §270.

### MUST preserve
- For bounded critical state machines, automatically explore reachable states/transitions.
- Detect:
- unreachable intended state;
- reachable forbidden state;
- deadlock;
- livelock;
- missing terminal state;
- unhandled timeout.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.62 Execution contract — ENG 271: MONOTONIC SAFETY PROPERTIES

**Engineering authority:** V2.1.1 §271.

### MUST preserve
- Identify properties that must never regress.
- Examples:
- a signed note never becomes unsigned by ordinary edit;
- a reviewed critical result never becomes “unseen” without explicit correction workflow;
- tenant authorization never broadens from data import;
- provenance never disappears during recomputation.
- Encode these as permanent regression properties.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.63 Execution contract — ENG 272: NEGATIVE CAPABILITY TESTING

**Engineering authority:** V2.1.1 §272.

### MUST preserve
- Test what Medical OS must refuse to do.
- Examples:
- compute with incompatible units;
- prescribe autonomously;
- close critical result via AI;
- modify signed note;
- use unapproved knowledge artifact;
- access another tenant;
- silently accept stale weight.
- Refusal behavior is part of correctness.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.64 Execution contract — ENG 273: RED-TEAM COMPUTATION PROGRAM

**Engineering authority:** V2.1.1 §273.

### MUST preserve
- Periodically conduct adversarial reviews targeting:
- unsafe assumptions;
- hidden defaults;
- clinical-policy bypass;
- provenance forgery;
- unit manipulation;
- knowledge poisoning;
- cross-tenant leakage;
- AI prompt injection;
- race conditions;
- rollback failures.
- Red-team findings enter tracked remediation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.65 Execution contract — ENG 274: KNOWLEDGE POISONING DEFENSE

**Engineering authority:** V2.1.1 §274.

### MUST preserve
- Threat model intentional or accidental poisoned source content.
- Controls:
- source allowlists/identity;
- hashes;
- human verification;
- multiple-source comparison where appropriate;
- no autoactivation;
- artifact signing;
- anomaly review for large rule changes.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.66 Execution contract — ENG 275: MASS-CHANGE SAFETY

**Engineering authority:** V2.1.1 §275.

### MUST preserve
- A terminology/guideline update can alter thousands of downstream outputs.
- Before mass activation:
- count affected artifacts;
- estimate patient/workflow impact;
- run behavioral diff;
- sample clinical review;
- stage rollout;
- define rollback.
- Large blast radius increases review rigor.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.67 Execution contract — ENG 276: BLAST-RADIUS MODEL

**Engineering authority:** V2.1.1 §276.

### MUST preserve
- Every change estimates:
- tenants;
- patients;
- specialties;
- countries;
- workflows;
- historical data;
- regulatory scope.
- Risk = severity × probability × blast radius × detectability/recoverability considerations.
- Use this to select release strategy.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.68 Execution contract — ENG 277: CHANGE BUDGET

**Engineering authority:** V2.1.1 §277.

### MUST preserve
- Avoid simultaneously changing:
- algorithm;
- terminology;
- UI;
- workflow;
- AI model
- for the same high-risk feature unless necessary.
- Smaller controlled changes improve attribution and rollback.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.69 Execution contract — ENG 278: ROLLBACK SEMANTICS

**Engineering authority:** V2.1.1 §278.

### MUST preserve
- Rollback means:
- stop new use of candidate;
- restore approved prospective behavior;
- preserve outputs already shown/acted upon;
- identify affected cases;
- decide whether retrospective review is needed.
- Rollback never erases clinical evidence.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.70 Execution contract — ENG 279: PATIENT-IMPACT ANALYSIS

**Engineering authority:** V2.1.1 §279.

### MUST preserve
- For serious defects, support identifying potentially affected patient records without exposing unnecessary PHI.
- Query by:
- artifact version;
- execution time;
- input characteristics;
- output class.
- This enables targeted clinical review.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.71 Execution contract — ENG 280: SAFETY COMMUNICATION PATH

**Engineering authority:** V2.1.1 §280.

### MUST preserve
- Define internal communication for:
- suspended algorithm;
- incorrect knowledge artifact;
- degraded service;
- required patient-impact review.
- Clinical users must receive actionable information, not infrastructure jargon.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.72 Execution contract — ENG 281: OPERATIONAL RUNBOOK PER C4/C5 ASSET

**Engineering authority:** V2.1.1 §281.

### MUST preserve
- Each high-risk asset has:
- owner contacts/roles;
- kill procedure;
- rollback;
- validation location;
- known failure modes;
- monitoring;
- patient-impact query;
- reactivation criteria.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.73 Execution contract — ENG 282: KNOWLEDGE REVIEW EXPIRATION

**Engineering authority:** V2.1.1 §282.

### MUST preserve
- High-impact knowledge artifacts cannot remain active indefinitely without review.
- On review expiry:
- notify owner;
- enter grace policy if approved;
- mark stale;
- potentially block new use depending on risk.
- Do not silently auto-retire a critical rule if retirement itself could create harm; use governed policy.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.74 Execution contract — ENG 283: OWNER BUS-FACTOR CONTROL

**Engineering authority:** V2.1.1 §283.

### MUST preserve
- Critical artifacts need backup ownership.
- No C4/C5 asset depends on one person's undocumented knowledge.
- Documentation + validation evidence + runbook must permit another qualified reviewer to assume ownership.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.75 Execution contract — ENG 284: EXPLANATION CONSISTENCY TEST

**Engineering authority:** V2.1.1 §284.

### MUST preserve
- Verify clinician-facing explanation matches actual computation.
- A correct calculation with an incorrect explanation is a defect.
- AI-generated explanation must not contradict deterministic trace.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.76 Execution contract — ENG 285: UI/ENGINE CONTRACT TESTS

**Engineering authority:** V2.1.1 §285.

### MUST preserve
- Test that UI:
- sends correct units;
- displays correct version/status;
- does not round before calculation;
- does not hide `not_computable`;
- distinguishes warning vs critical;
- preserves source timestamps.
- Clinical engine correctness can be defeated by a bad presentation layer.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.77 Execution contract — ENG 286: COPY/PASTE SAFETY

**Engineering authority:** V2.1.1 §286.

### MUST preserve
- Copied clinical data can become stale or wrong-patient.
- Where relevant:
- show source/date;
- prevent hidden identifiers;
- avoid copying machine-only tokens into narrative;
- preserve provenance when structured data are reused.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.78 Execution contract — ENG 287: WRONG-PATIENT COMPUTATION DEFENSE

**Engineering authority:** V2.1.1 §287.

### MUST preserve
- Before high-impact action:
- persistent patient identity context;
- server-side patient/encounter binding;
- stale-tab detection where feasible;
- explicit confirmation for selected high-risk actions.
- Never trust a client-visible patient label as binding.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.79 Execution contract — ENG 288: MULTI-TAB / MULTI-DEVICE CONCURRENCY

**Engineering authority:** V2.1.1 §288.

### MUST preserve
- Test physician editing same patient from:
- two tabs;
- desktop + tablet;
- two clinicians.
- Use optimistic concurrency/versioning and visible conflict resolution.
- Do not silently last-write-wins clinically consequential data.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.80 Execution contract — ENG 289: OFFLINE / DEGRADED CLIENT POLICY

**Engineering authority:** V2.1.1 §289.

### MUST preserve
- If offline support is introduced:
- clearly identify stale local data;
- constrain high-risk actions;
- queue writes safely;
- reconcile conflicts;
- preserve timestamps/provenance.
- Do not imply current clinical state when client is stale.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.81 Execution contract — ENG 290: CLOCK SOURCE POLICY

**Engineering authority:** V2.1.1 §290.

### MUST preserve
- Use server-authoritative timestamps for audit/system events.
- Preserve device/source timestamps separately when clinically meaningful.
- Do not allow client clock manipulation to rewrite audit chronology.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.82 Execution contract — ENG 291: IDENTIFIER COLLISION DEFENSE

**Engineering authority:** V2.1.1 §291.

### MUST preserve
- Human-readable folios are not primary keys.
- Use globally unique internal identifiers.
- Test:
- import collisions;
- tenant-local folio collisions;
- external identifier reuse;
- merge/split.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.83 Execution contract — ENG 292: HASHING / CANONICALIZATION POLICY

**Engineering authority:** V2.1.1 §292.

### MUST preserve
- When hashing inputs/artifacts:
- canonical serialization;
- stable field ordering;
- normalized numeric representation;
- versioned canonicalization algorithm.
- Otherwise identical logical inputs can produce different hashes.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.84 Execution contract — ENG 293: REPRODUCIBLE SERIALIZATION

**Engineering authority:** V2.1.1 §293.

### MUST preserve
- Historical reconstruction requires stable encoding semantics.
- Do not depend on incidental JavaScript object serialization for long-term clinical evidence.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.85 Execution contract — ENG 294: DEPENDENCY PINNING FOR CLINICAL LOGIC

**Engineering authority:** V2.1.1 §294.

### MUST preserve
- Pin behavior-affecting dependencies.
- Upgrading a decimal library, date library, terminology package or parser can alter outputs.
- Treat such upgrades as behavioral changes requiring regression.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.86 Execution contract — ENG 295: COMPILER / RUNTIME COMPATIBILITY MATRIX

**Engineering authority:** V2.1.1 §295.

### MUST preserve
- Knowledge artifact compiler version and runtime version require compatibility metadata.
- Runtime rejects unsupported compiled artifact versions.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.87 Execution contract — ENG 296: ARTIFACT SIGNATURE VERIFICATION PATH

**Engineering authority:** V2.1.1 §296.

### MUST preserve
- If signed artifacts are adopted:
- verify at promotion/load;
- define key rotation;
- revoke compromised keys;
- audit verification failure.
- Never silently execute an artifact with failed integrity verification.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.88 Execution contract — ENG 297: KEY MANAGEMENT BOUNDARY

**Engineering authority:** V2.1.1 §297.

### MUST preserve
- Signing/encryption keys:
- never stored in repo;
- environment-specific;
- least privilege;
- rotation procedure;
- access audit.
- Do not let coding agents access production signing keys.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.89 Execution contract — ENG 298: BUILD REPRODUCIBILITY TEST

**Engineering authority:** V2.1.1 §298.

### MUST preserve
- Periodically rebuild approved artifacts from source/lockfiles and compare hashes where deterministic builds are expected.
- Unexpected divergence triggers supply-chain investigation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.90 Execution contract — ENG 299: CLINICAL CONTENT SBOM

**Engineering authority:** V2.1.1 §299.

### MUST preserve
- Maintain a “Clinical Bill of Materials” for a release:
- algorithms;
- knowledge artifacts;
- terminology versions;
- country packs;
- clinical packs;
- drug/reference datasets.
- This complements the software SBOM.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.91 Execution contract — ENG 300: RELEASE MANIFEST

**Engineering authority:** V2.1.1 §300.

### MUST preserve
- Every release identifies both:
- software version;
- Clinical BOM version.
- Two deployments with same frontend commit but different clinical content are not clinically identical releases.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.92 Execution contract — ENG 301: EVIDENCE-TO-CODE DRIFT CHECK

**Engineering authority:** V2.1.1 §301.

### MUST preserve
- Detect when implementation remains active after its source is:
- superseded;
- withdrawn;
- expired;
- jurisdictionally changed.
- This creates review, not automatic policy mutation.
- ————————————————————————

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.93 Execution contract — ENG 212: Target architecture doctrine

**Engineering authority:** V2.1.1 §212.

### MUST preserve
- Medical OS shall evolve from an advanced EHR into a longitudinal computable clinical operating system.
- The core loop is Patient State → Intent → Goals → Problems/Hypotheses → Evidence/Uncertainty → Decision → Intervention → Expected Result → Observed Result → Treatment Response → Reassessment → Obligation.
- Every new capability must reduce cognitive load, preserve clinical continuity, improve safety, close work loops, or make uncertainty/intent explicit.
- Generative AI is assistive; deterministic computation, governed knowledge and physician authority remain separate authorities.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.94 Execution contract — ENG 213: Patient Computable State 2.0

**Engineering authority:** V2.1.1 §213.

### MUST preserve
- Extend Patient State to include current state, historical state, delta, trajectory, episodes, problems, hypotheses, evidence, uncertainty, goals, intent, interventions, treatment responses, medications, diagnostics, preferences, risks, care gaps, obligations, expected results, contradictions, decisions and provenance.
- Implement as composable domain objects/read models, never as one patient_digital_twin mega-table.
- Every state projection exposes as-of time/version, freshness, completeness, degraded dependencies and provenance.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.95 Execution contract — ENG 214: Clinical Intent as a first-class domain primitive

**Engineering authority:** V2.1.1 §214.

### MUST preserve
- ClinicalIntent captures why an action is being performed: purpose, target problem/goal, expected information/effect, initiating clinician, encounter/context, temporal horizon and provenance.
- Orders, interventions, referrals, monitoring and selected decisions may reference ClinicalIntent.
- AI may propose intent only as DRAFT/UNVERIFIED; it cannot silently infer and commit physician intent.
- PRODUCT-GAP: physician-visible intent capture/review behavior requires product-baseline promotion.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.96 Execution contract — ENG 215: Clinical Goal Engine

**Engineering authority:** V2.1.1 §215.

### MUST preserve
- ClinicalGoal represents desired clinical outcome, target semantics, measurement method, horizon, owner, lifecycle and relationship to problems/interventions.
- Lifecycle supports proposed, active, achieved, partially-achieved, not-achieved, superseded, cancelled and unable-to-assess.
- Goal evaluation distinguishes population guideline target, individualized target and patient preference.
- Goal closure requires evidence or explicit clinician action; encounter closure cannot auto-close a longitudinal goal.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.97 Execution contract — ENG 216: Clinical Plan Compiler

**Engineering authority:** V2.1.1 §216.

### MUST preserve
- Compile an approved clinical plan into typed downstream work: prescription candidates, orders, monitoring requirements, expected results, obligations, referrals, follow-up, patient instructions and communications.
- Decision Once → Propagate Everywhere is a target invariant.
- Compilation produces a preview/diff before physician commit for clinically consequential outputs.
- Partial compilation failure is explicit; successfully created children and failed children are reconciled, never silently orphaned.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.98 Execution contract — ENG 217: Expected Result Engine

**Engineering authority:** V2.1.1 §217.

### MUST preserve
- Every eligible diagnostic/monitoring order may define expected artifact/result type, expected time window, responsible reviewer, escalation policy and downstream obligation.
- Absence of an expected result becomes a detectable workflow state rather than disappearing.
- Expected result is distinct from predicted biological value unless an explicitly validated model exists.
- Corrections/amendments can invalidate prior review and reopen downstream obligations.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.99 Execution contract — ENG 218: Clinical Goal-to-Result closure model

**Engineering authority:** V2.1.1 §218.

### MUST preserve
- Link Goal → Intervention → Expected Result → Observed Result → Treatment Response → Reassessment.
- Support one-to-many and many-to-one relationships without forcing false causality.
- Unknown response remains UNKNOWN; missing follow-up cannot become treatment failure or success.
- Historical reconstruction must show which evidence was available when response was assessed.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.100 Execution contract — ENG 219: Treatment Response Engine

**Engineering authority:** V2.1.1 §219.

### MUST preserve
- Represent expected effect, expected timeframe, observed response, adverse effects, adherence evidence, confounders and clinician conclusion.
- Outcome states include responding, partially responding, non-responding, worsening, unable-to-assess and conflicting evidence.
- Deterministic response rules may be used only when clinically validated; otherwise the engine structures evidence for clinician assessment.
- PRODUCT-GAP: visible response classifications and workflow require product review.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.101 Execution contract — ENG 220: Medication Intelligence Graph 2.0

**Engineering authority:** V2.1.1 §220.

### MUST preserve
- Connect medication to indication, problem, goal, intent, dose, route, formulation, start/stop, response, adverse effects, allergies, contraindications, renal/hepatic context, monitoring, adherence and reason for change.
- Detect medication-without-known-indication, indication-without-expected-monitoring, monitoring overdue and clinically meaningful lifecycle inconsistencies as review candidates.
- Do not equate absence of linked indication with inappropriate prescribing; imported/legacy data may be incomplete.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.102 Execution contract — ENG 221: Medication Change Impact Engine

**Engineering authority:** V2.1.1 §221.

### MUST preserve
- When renal/hepatic function, weight, pregnancy/context, allergy, interaction-relevant medication or other validated dependency changes, recompute only affected medication safety/applicability checks.
- Display delta rather than re-alerting unchanged findings.
- All high-impact medication checks declare algorithm/knowledge versions and missing-data behavior.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.103 Execution contract — ENG 222: Hypothesis Workspace

**Engineering authority:** V2.1.1 §222.

### MUST preserve
- ClinicalHypothesis stores status, supporting evidence, contradicting evidence, missing evidence, uncertainty, differential relationships, risk-of-omission metadata and provenance.
- Lifecycle may include considered, evaluating, probable, confirmed, ruled-out and superseded, subject to specialty/product governance.
- Promotion to diagnosis is an explicit physician action unless a separately validated/regulatory-approved pathway permits otherwise.
- PRODUCT-GAP: hypothesis UI and lifecycle must be added to product specification.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.104 Execution contract — ENG 223: Missing Evidence Engine

**Engineering authority:** V2.1.1 §223.

### MUST preserve
- For a hypothesis/decision, compute what required or useful evidence is absent, unknown, conflicting or stale.
- Separate MUST-HAVE safety data from optional decision-improving information.
- Do not create checklist overload; rank by expected decision relevance, urgency and risk.
- Knowledge-derived missing-evidence logic is versioned and explainable.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.105 Execution contract — ENG 224: Clinical Contradiction Engine

**Engineering authority:** V2.1.1 §224.

### MUST preserve
- Detect semantic conflicts across facts, statuses, medications, problems, results, statements and timelines.
- Contradiction states include possible, likely, clinically-important and safety-critical; confidence never substitutes for clinical severity.
- Examples include active-vs-stopped medication, incompatible units/statuses, documented absence versus persistent objective evidence and conflicting patient identity/context.
- Contradictions require reconciliation workflow; the system does not silently choose a winner.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.106 Execution contract — ENG 225: Concordance and discrepancy graph

**Engineering authority:** V2.1.1 §225.

### MUST preserve
- Represent agreements and disagreements between structured facts, documents, clinician statements, patient statements, imported data and derived facts.
- Source authority, recency and verification are inputs to reconciliation but never erase provenance.
- Conflicting facts remain separately reconstructable after reconciliation.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.107 Execution contract — ENG 226: Clinical Uncertainty object

**Engineering authority:** V2.1.1 §226.

### MUST preserve
- Uncertainty is first-class and can attach to hypothesis, diagnosis, fact, decision, expected result or response.
- States distinguish unknown, uncertain, conflicting, pending, not-assessed and not-applicable.
- Store uncertainty rationale and what evidence could resolve it when explicitly known.
- Never fabricate numerical probability where no validated probability model exists.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.108 Execution contract — ENG 227: Clinical Decision object and Decision Ledger

**Engineering authority:** V2.1.1 §227.

### MUST preserve
- Selected high-impact decisions may capture decision, intent, alternatives considered, evidence, constraints, uncertainty, expected outcome, monitoring plan and actor/time.
- Decision Ledger is risk-based; routine low-risk care must not become documentation burden.
- AI-generated decision rationale remains draft until physician adoption.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.109 Execution contract — ENG 228: Counterfactual / Value-of-Information boundary

**Engineering authority:** V2.1.1 §228.

### MUST preserve
- Provide a governed framework to represent whether additional information could change a decision.
- Do not claim causal counterfactual prediction unless a validated model and intended use support it.
- Initial implementation should structure decision branches and missing information, not autonomously optimize clinical testing.
- C4/C5 deployment requires clinical validation and function-specific regulatory review.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.110 Execution contract — ENG 229: Clinical Delta Engine

**Engineering authority:** V2.1.1 §229.

### MUST preserve
- Compute what changed since a clinically relevant baseline/last review: new problems, changed measurements, medication changes, new results, corrected results, new contradictions, overdue obligations and resolved items.
- Rank by clinical relevance and novelty rather than raw chronology.
- Every delta links to underlying facts and comparison baseline.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.111 Execution contract — ENG 230: What Changed? pre-visit contract

**Engineering authority:** V2.1.1 §230.

### MUST preserve
- Pre-visit view must prioritize meaningful deltas, pending work, contradictions, new external care and treatment-response evidence.
- Long AI summaries cannot replace structured delta.
- User can drill from delta → source → longitudinal context.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.112 Execution contract — ENG 231: Semantic Clinical Timeline

**Engineering authority:** V2.1.1 §231.

### MUST preserve
- Support chronological, problem-centric, medication-centric, diagnostic and episode-centric projections over the same authoritative facts.
- Timeline grouping is a read model; it does not duplicate clinical truth.
- Episode assignment can be suggested by AI but remains provenance-marked and correctable.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.113 Execution contract — ENG 232: Clinical Episode model

**Engineering authority:** V2.1.1 §232.

### MUST preserve
- ClinicalEpisode groups temporally/semantically related encounters, diagnostics, interventions and outcomes.
- Episode boundaries may be explicit, deterministic or suggested; source/method is preserved.
- One fact may participate in multiple clinically meaningful views without being copied.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.114 Execution contract — ENG 233: Patient Preference and Shared Decision model

**Engineering authority:** V2.1.1 §233.

### MUST preserve
- Represent preferences, constraints, affordability/access considerations, prior intolerance and feasibility separately from clinical facts.
- Preferences have scope, source, effective period and verification state.
- Shared decisions link clinical options, patient constraints/preferences and final physician/patient decision without pretending guideline equivalence.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.115 Execution contract — ENG 234: Clinical Memory architecture

**Engineering authority:** V2.1.1 §234.

### MUST preserve
- Separate durable clinical facts, patient preferences, prior decisions, historical context, clinician annotations and AI inferences.
- AI memory never silently becomes clinical truth.
- Memory retrieval is purpose-scoped and minimum necessary.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.116 Execution contract — ENG 235: Attention Budget Engine

**Engineering authority:** V2.1.1 §235.

### MUST preserve
- Alerts/signals are assigned interruption class: CRITICAL, IMPORTANT, CONSIDER or INFO under governed policy.
- Correlated rules about the same underlying hazard should be deduplicated/aggregated where safe.
- Track alert exposure, acknowledgement, override and downstream outcome for governance without using raw ignore rate as automatic clinical truth.
- Critical alerts cannot be suppressed solely because users frequently dismiss them.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.117 Execution contract — ENG 236: Cognitive Load Controller

**Engineering authority:** V2.1.1 §236.

### MUST preserve
- Instrument clicks, repeated entry, context switches, interruptions, search time, scroll distance, alert burden and after-visit work using privacy-preserving telemetry.
- Use metrics to identify workflow friction, not to score/punish clinicians by default.
- Product optimization must preserve safety invariants while reducing interaction cost.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.118 Execution contract — ENG 237: Ambient Clinical Layer 2.0

**Engineering authority:** V2.1.1 §237.

### MUST preserve
- Conversation/audio may generate candidate history facts, exam statements, medications, orders, instructions, obligations and missing-question suggestions.
- Pipeline: capture → segmentation → extraction → context binding → contradiction check → candidate objects → physician review → commit.
- Ambient extraction cannot directly create verified clinical facts or irreversible clinical actions.
- Late/stale ambient outputs are patient/encounter/request bound and safely discarded.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.119 Execution contract — ENG 238: Ambient Missing Question Detection

**Engineering authority:** V2.1.1 §238.

### MUST preserve
- During encounter, surface potentially important unanswered questions only when supported by approved clinical knowledge/pathway and current context.
- Use progressive disclosure and attention budget; do not continuously interrupt.
- Each suggestion explains why it may matter and can be dismissed without silently recording a negative answer.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.120 Execution contract — ENG 239: Evidence-at-the-point-of-decision

**Engineering authority:** V2.1.1 §239.

### MUST preserve
- Resolve applicable evidence using jurisdiction, specialty, life stage, condition, medication/context, effective date and artifact version.
- Display recommendation, source, effective date, applicability, exceptions, strength/quality metadata where available and data used.
- Knowledge conflict is explicit; AI cannot invent consensus.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.121 Execution contract — ENG 240: Explain Why contract

**Engineering authority:** V2.1.1 §240.

### MUST preserve
- Every high-impact deterministic/knowledge recommendation exposes trigger facts, missing facts, rule/algorithm version, source references, applicability and reason for severity.
- Explanation must be generated from execution trace where possible, not reconstructed by a free-form LLM.
- AI prose may translate an existing trace but cannot change its semantics.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.122 Execution contract — ENG 241: Patient Digital Twin clinical composition

**Engineering authority:** V2.1.1 §241.

### MUST preserve
- Patient Digital Twin is the composed longitudinal experience over Patient State, Graph, Delta, Trajectory, Intent, Goals, Hypotheses, Interventions, Responses and Obligations.
- It is not a claim of complete physiological simulation or future prediction.
- Simulation/prediction modules are separately versioned capabilities with explicit uncertainty and validation.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.123 Execution contract — ENG 242: Patient Action Plan / Patient OS 2.0

**Engineering authority:** V2.1.1 §242.

### MUST preserve
- Translate approved care plan into patient-facing actions: what, when, why, preparation, completion state, contact/escalation and barriers.
- Patient-facing explanations are separated from clinician-facing clinical reasoning.
- Patient responses may create messages/candidate updates/obligations but cannot overwrite clinician-verified facts.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.124 Execution contract — ENG 243: Patient Comprehension and Barrier Loop

**Engineering authority:** V2.1.1 §243.

### MUST preserve
- Support comprehension checks and reporting of barriers such as cost, access, scheduling or intolerance.
- Barrier data is patient-reported unless verified otherwise.
- Clinically important barriers route to an owner/obligation instead of disappearing into messages.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.125 Execution contract — ENG 244: Care Team Operating System

**Engineering authority:** V2.1.1 §244.

### MUST preserve
- Model physician, nurse, assistant, reception, laboratory, pharmacy, care coordinator, specialist, patient and caregiver responsibilities through scoped roles/capabilities.
- Work is routed by responsibility, relationship, purpose and urgency.
- No task can become ownerless because a staff member is deactivated; reassignment/reconciliation is mandatory.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.126 Execution contract — ENG 245: Referral Intelligence 2.0

**Engineering authority:** V2.1.1 §245.

### MUST preserve
- Referral captures reason, urgency, clinical question, relevant evidence, medications, requested output and expected return state.
- Incoming specialist response triggers reconciliation of diagnoses, medications, recommendations, results and obligations.
- Referral sent ≠ accepted ≠ completed ≠ reconciled.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.127 Execution contract — ENG 246: Message Intelligence

**Engineering authority:** V2.1.1 §246.

### MUST preserve
- Classify message intent/urgency/context, propose routing and draft response, and create obligation when appropriate.
- AI classification cannot suppress or close potentially urgent clinical messages without validated deterministic safety controls/human review.
- Message state includes received, triaged, assigned, responded, awaiting-patient, escalated and closed.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.128 Execution contract — ENG 247: Operational Intelligence

**Engineering authority:** V2.1.1 §247.

### MUST preserve
- Command Center should surface clinical-operational work: critical/unreviewed results, overdue obligations, referral loops, failed communications, no-shows needing action, duplicate-patient candidates and degraded services.
- Operational prioritization must not obscure clinical severity.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.129 Execution contract — ENG 248: Autonomous Administrative Plane

**Engineering authority:** V2.1.1 §248.

### MUST preserve
- Permit higher automation for low-risk scheduling, reminders, document preparation, routing and administrative reconciliation under explicit capabilities.
- Autonomy decreases as clinical consequence rises.
- Administrative automation cannot silently mutate diagnoses, prescriptions, verified clinical facts or critical-result closure.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.130 Execution contract — ENG 249: Clinical Quality Observatory

**Engineering authority:** V2.1.1 §249.

### MUST preserve
- Measure closed-loop completion, monitoring gaps, result review, referral closure, care-gap resolution, alert effectiveness, documentation completeness and workflow burden.
- Quality metrics preserve denominator/version definitions and are not silently reinterpreted after knowledge updates.
- Separate quality improvement analytics from punitive individual surveillance by policy.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.131 Execution contract — ENG 250: Learning Health System firewall

**Engineering authority:** V2.1.1 §250.

### MUST preserve
- Production behavior never self-modifies from usage telemetry.
- Telemetry may open governance hypotheses: poor applicability, alert burden, workflow friction, model drift or knowledge gaps.
- Any change proceeds through source/review/validation/shadow/canary/release.
- Clinician override is evidence for review, not automatic proof that a rule is wrong.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.132 Execution contract — ENG 251: Outcome Intelligence boundary

**Engineering authority:** V2.1.1 §251.

### MUST preserve
- Support privacy-governed observational outcome analysis with cohort definition, provenance, missingness and confounding warnings.
- Do not present observational association as causal treatment effect.
- Research/real-world-evidence functions are separated from point-of-care clinical authority unless independently validated.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.133 Execution contract — ENG 252: Clinical Trial Matching future capability

**Engineering authority:** V2.1.1 §252.

### MUST preserve
- Represent trial criteria as versioned computable eligibility artifacts where licensing/source permits.
- Output is potential-match with satisfied/unsatisfied/unknown criteria and source version, never automatic enrollment.
- Keep research consent and clinical care boundaries explicit.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.134 Execution contract — ENG 253: Federated analytics readiness

**Engineering authority:** V2.1.1 §253.

### MUST preserve
- Keep data contracts, terminology, provenance and cohort definitions portable enough to support future federated analytics.
- Federation is not a V2.1.1 production requirement unless a concrete deployment needs it.
- Do not weaken tenant/privacy boundaries in anticipation of research.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.135 Execution contract — ENG 254: Clinical Simulation Mode

**Engineering authority:** V2.1.1 §254.

### MUST preserve
- Run candidate rules/knowledge/workflow changes retrospectively on synthetic or appropriately governed datasets before activation.
- Report trigger counts, changed populations, severity changes, workload/alert burden and unresolved cases.
- Simulation never commits clinical actions.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.136 Execution contract — ENG 255: Institutional Digital Twin boundary

**Engineering authority:** V2.1.1 §255.

### MUST preserve
- Future operational simulation may model demand, staffing, scheduling, labs, messaging, inventory and throughput.
- Operational simulation is separate from patient clinical truth and cannot silently drive clinical prioritization.
- Architecture should allow it without coupling core clinical domain to simulation.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.137 Execution contract — ENG 256: Computable care-plan graph

**Engineering authority:** V2.1.1 §256.

### MUST preserve
- Create a typed graph connecting Intent → Goal → Decision → Intervention → Expected Result → Observation → Response → Obligation.
- Graph edges have semantic type, source, actor, effective time, recorded time and lifecycle.
- Missing edge is not inferred as negative relationship.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.138 Execution contract — ENG 257: Plan compilation transaction semantics

**Engineering authority:** V2.1.1 §257.

### MUST preserve
- Plan compilation creates an immutable proposal graph before commit.
- Commit validates authorization, patient context, current versions, dependencies and duplicate/idempotency keys.
- Domain writes plus outbox/audit are transactional where appropriate; external effects occur after commit.
- Failed external effects remain reconcilable from intended side-effect ledger.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.139 Execution contract — ENG 258: New domain object versioning policy

**Engineering authority:** V2.1.1 §258.

### MUST preserve
- Intent, Goal, Hypothesis, Decision, Intervention, ExpectedResult, TreatmentResponse, Episode and Preference require stable opaque IDs and append-oriented history.
- Signed/clinically consequential snapshots are immutable; corrections/supersession create new versions/events.
- Version vector remains sufficient for historical reconstruction.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.140 Execution contract — ENG 259: New object information-state policy

**Engineering authority:** V2.1.1 §259.

### MUST preserve
- Every new domain primitive defines behavior for unknown, unverified, conflicting, pending, not-assessed and not-applicable states where semantically relevant.
- Null is not a universal information state.
- UI/API/database mappings preserve these distinctions.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.141 Execution contract — ENG 260: New object provenance policy

**Engineering authority:** V2.1.1 §260.

### MUST preserve
- Every clinically meaningful object stores source type, actor/system, source artifact/reference, creation/effective time, verification state and transformation lineage where derived.
- AI-generated candidate objects identify task/model/config and source spans when available.
- Manual correction preserves original candidate and correction lineage.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.142 Execution contract — ENG 261: New object authorization policy

**Engineering authority:** V2.1.1 §261.

### MUST preserve
- Authorization is object/action/purpose scoped and evaluated server-side.
- Patient preference, sensitive history, research data and caregiver access may require additional policy dimensions.
- Background jobs re-establish authorization/service capability rather than inheriting stale request context.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.143 Execution contract — ENG 262: New object audit policy

**Engineering authority:** V2.1.1 §262.

### MUST preserve
- Create/update/supersede/verify/commit/close/reopen/export and high-impact read events are audited according to policy.
- Audit must distinguish AI proposal, physician acceptance and final committed state.
- Audit failure policy is explicit for clinically consequential writes.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.144 Execution contract — ENG 263: New object search/index policy

**Engineering authority:** V2.1.1 §263.

### MUST preserve
- Search indexes may expose safe summaries but never become source of truth or authorization authority.
- New clinical primitives are searchable only where purpose and sensitivity permit.
- Index lag/failure is visible and cannot silently hide critical obligations/results.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.145 Execution contract — ENG 264: New object reconciliation policy

**Engineering authority:** V2.1.1 §264.

### MUST preserve
- Reconciliation jobs detect orphan goals, interventions without expected monitoring, expected results without returned result, responses without source evidence, obligations without owner and stale projections.
- Reconciliation can create repair work but does not invent missing clinical facts.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.146 Execution contract — ENG 265: New object deletion/retention policy

**Engineering authority:** V2.1.1 §265.

### MUST preserve
- Clinical semantics use explicit lifecycle/supersession rather than generic soft delete.
- Retention and correction behavior are jurisdiction/purpose governed.
- Deleting a projection/cache never deletes authoritative clinical history.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.147 Execution contract — ENG 266: AI contracts for new reasoning objects

**Engineering authority:** V2.1.1 §266.

### MUST preserve
- AI can summarize, extract, propose links, propose hypotheses, identify candidate contradictions and draft explanations within task-specific schemas.
- AI cannot be authoritative source for dose arithmetic, unit conversion, authorization, signed state, critical-result closure or verified clinical fact.
- All high-impact AI outputs support abstention and source/evidence trace.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.148 Execution contract — ENG 267: Deterministic contracts for new reasoning objects

**Engineering authority:** V2.1.1 §267.

### MUST preserve
- Use deterministic logic for lifecycle transitions, due dates, unit/temporal calculations, dependency invalidation, duplicate detection primitives and validated safety rules.
- Clinical thresholds and applicability rules are knowledge/algorithm artifacts, not hard-coded magic numbers.
- Unknown input propagates explicitly.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.149 Execution contract — ENG 268: Knowledge Engine extensions for goals and care plans

**Engineering authority:** V2.1.1 §268.

### MUST preserve
- Knowledge artifacts may define recommended goals, monitoring, expected follow-up intervals, evidence requirements and care-plan relationships.
- Recommendations remain context/jurisdiction/version dependent.
- Knowledge cannot silently individualize a target without required patient/context inputs and physician authority.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.150 Execution contract — ENG 269: Knowledge Engine extensions for contradictions

**Engineering authority:** V2.1.1 §269.

### MUST preserve
- Contradiction rules distinguish logical impossibility, semantic inconsistency, temporal mismatch and clinically suspicious coexistence.
- Each rule declares severity, applicability, resolution options and false-positive considerations.
- Rule firing creates review signal, not automatic fact deletion.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.151 Execution contract — ENG 270: Knowledge Engine extensions for missing evidence

**Engineering authority:** V2.1.1 §270.

### MUST preserve
- Represent required, recommended and optional evidence separately.
- Missing-evidence artifacts declare decision/hypothesis context and applicability.
- Do not equate absence from Medical OS with evidence that assessment was not performed; source completeness matters.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.152 Execution contract — ENG 271: Longitudinal causality guardrail

**Engineering authority:** V2.1.1 §271.

### MUST preserve
- Temporal sequence, correlation and response after intervention do not automatically establish causality.
- Treatment Response may record clinician-attributed relationship separately from observed temporal association.
- AI explanations must not upgrade association to causation.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.153 Execution contract — ENG 272: Data Once / Compute Once / Source Once / Decision Once

**Engineering authority:** V2.1.1 §272.

### MUST preserve
- Data Once: do not ask for known reliable data again unless verification is needed.
- Compute Once: derived facts are reusable with version/provenance and invalidated on dependency change.
- Source Once: preserve immutable originals and derive views instead of copying truth.
- Decision Once: approved intent/plan propagates into downstream work without repetitive manual re-entry.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.154 Execution contract — ENG 273: Failure semantics for target architecture

**Engineering authority:** V2.1.1 §273.

### MUST preserve
- If Patient State is stale, label it and permit source drill-down.
- If Knowledge Engine is unavailable, preserve charting and deterministic core and suppress unsupported knowledge claims.
- If AI is unavailable, preserve all deterministic/knowledge/closed-loop core workflows.
- If obligation scheduler is degraded, expose operational incident and reconcile from authoritative due-state.
- If graph projection fails, authoritative facts remain available.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.155 Execution contract — ENG 274: Safe-mode physician experience

**Engineering authority:** V2.1.1 §274.

### MUST preserve
- Safe mode prioritizes patient identity, allergies/critical safety data, authoritative chart, medication list, critical results, obligations, basic documentation/prescribing where validated dependencies remain available and audit.
- Nonessential AI, analytics and simulation can disappear without blocking care.
- UI clearly distinguishes unavailable assistance from absence of clinical risk.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.156 Execution contract — ENG 275: Human-factors validation for target capabilities

**Engineering authority:** V2.1.1 §275.

### MUST preserve
- Evaluate whether Goals, Hypotheses, Contradictions, Missing Evidence and Attention Budget improve decisions without increasing cognitive overload.
- Measure time-to-state comprehension, information-not-found, unsafe interpretation, alert burden, interruptions and workaround creation.
- Use synthetic 2,000-physician cohort for adversarial discovery followed by representative real-clinician validation for higher-risk functions.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.157 Execution contract — ENG 276: Target architecture threat-model expansion

**Engineering authority:** V2.1.1 §276.

### MUST preserve
- Threat-model malicious/incorrect AI linking, graph poisoning, false provenance, patient-context confusion, obligation manipulation, preference leakage, plan-compiler privilege escalation and cross-tenant derived-state contamination.
- Each new trust boundary receives STRIDE/abuse-case review appropriate to risk.
- Security findings that can cause clinical harm enter the clinical hazard system as well.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.158 Execution contract — ENG 277: Target architecture privacy expansion

**Engineering authority:** V2.1.1 §277.

### MUST preserve
- Intent, preferences, hypotheses and uncertainty may reveal highly sensitive context and require minimum-necessary access/egress.
- AI context compiler selects fields by task/purpose allowlist.
- Patient-facing portal never exposes clinician-only differential/hypothesis content by default without product/policy decision.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.159 Execution contract — ENG 278: Target architecture observability

**Engineering authority:** V2.1.1 §278.

### MUST preserve
- Metrics include Patient State freshness, delta build latency, plan compile success/partial failure, expected-result overdue counts, orphan reconciliation, contradiction signal volume, attention budget, AI abstention and graph rebuild divergence.
- Observability uses IDs/classes rather than raw PHI.
- Every critical signal has owner and runbook.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.160 Execution contract — ENG 279: Target architecture performance budgets

**Engineering authority:** V2.1.1 §279.

### MUST preserve
- Patient workspace must not require loading the entire longitudinal graph.
- Use bounded projections, incremental read models, pagination and on-demand deep history.
- Pre-visit Delta/State are precomputed or incrementally maintained where evidence shows latency benefit.
- Long-chart and pathological-patient benchmarks become mandatory.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.161 Execution contract — ENG 280: Target architecture migration strategy

**Engineering authority:** V2.1.1 §280.

### MUST preserve
- Introduce new primitives through expand-compatible schemas and backfill only facts that can be derived without inventing intent/meaning.
- Legacy records with unknown intent/goal remain unknown; no synthetic historical certainty.
- Shadow new Patient State/Delta projections before replacing existing read models.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.162 Execution contract — ENG 281: Product-gap promotion registry

**Engineering authority:** V2.1.1 §281.

### MUST preserve
- Maintain PRODUCT-GAP IDs for physician-visible behavior introduced by this engineering expansion but absent from frozen V2.
- At minimum: Clinical Intent, Goal Engine, Plan Compiler UX, Expected Result UX, Treatment Response, Hypothesis Workspace, Missing Evidence, Contradiction reconciliation, Uncertainty UX, Semantic Timeline, Patient Action Plan, Attention Budget and Care Team workflows.
- No PRODUCT-GAP capability becomes unrestricted production behavior until product governance promotes/accepts it.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.163 Execution contract — ENG 282: Atomic traceability requirement

**Engineering authority:** V2.1.1 §282.

### MUST preserve
- Every new capability receives Product ID (when promoted), ENG ID, invariant IDs, hazard IDs, API/schema refs, code owner, test IDs, telemetry IDs and evidence IDs.
- Traceability must be queryable bidirectionally.
- Orphan engineering requirement, orphan C4/C5 invariant and orphan safety test are release blockers.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.164 Execution contract — ENG 283: Target architecture executable-contract package

**Engineering authority:** V2.1.1 §283.

### MUST preserve
- Create packages/contracts for opaque IDs, information states, quantities, provenance, ClinicalIntent, ClinicalGoal, ClinicalHypothesis, ClinicalDecision, ClinicalIntervention, ExpectedClinicalResult, TreatmentResponse, ClinicalEpisode, PatientPreference, ClinicalDelta and ClinicalActionReceipt.
- Use TypeScript strict + runtime schema validation.
- Contract package contains no UI/provider/database implementation.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.165 Execution contract — ENG 284: Target architecture state-machine package

**Engineering authority:** V2.1.1 §284.

### MUST preserve
- Define explicit state machines for Goal, Hypothesis, Intervention, Expected Result, Treatment Response, Referral, Message and Obligation lifecycles.
- Illegal transitions fail closed and are property/model tested.
- State-machine version changes receive semantic diff.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.166 Execution contract — ENG 285: Target architecture graph contract

**Engineering authority:** V2.1.1 §285.

### MUST preserve
- Define allowed node/edge types, directionality, cardinality constraints, temporal semantics, provenance requirements and bounded query rules.
- Graph projection is reconstructable from authoritative domain facts/events.
- Graph database adoption is optional and evidence-driven; logical graph model does not require a graph DB.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.167 Execution contract — ENG 286: Target architecture API contract

**Engineering authority:** V2.1.1 §286.

### MUST preserve
- High-impact mutations use command-oriented APIs with patient/tenant binding, expected version/idempotency, explicit outcome union and action receipt.
- Read APIs expose freshness/degraded/provenance metadata for computed views.
- Batch APIs preserve per-item authorization and per-item outcomes.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.168 Execution contract — ENG 287: Target architecture database contract

**Engineering authority:** V2.1.1 §287.

### MUST preserve
- Use normalized authoritative tables/events for new primitives plus derived read models where needed.
- Foreign keys/constraints enforce tenant/patient ownership and valid relationships where feasible.
- Do not persist AI prose as authoritative clinical state without explicit accepted object/state.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.169 Execution contract — ENG 288: Target architecture event contract

**Engineering authority:** V2.1.1 §288.

### MUST preserve
- Events for goal, plan, result, response, obligation and correction are versioned, idempotent and carry tenant/patient/resource identity.
- Consumers tolerate duplicate/reordered delivery and reconcile from authoritative state.
- Events are integration facts, not authorization tokens.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.170 Execution contract — ENG 289: Target architecture test corpus

**Engineering authority:** V2.1.1 §289.

### MUST preserve
- Extend Synthetic Patient Factory with goal/intent/response/contradiction/missing-evidence scenarios across life stages, multimorbidity, polypharmacy, incomplete imports and longitudinal corrections.
- Add wrong-patient, stale-tab, concurrent-plan, duplicate-result, corrected-result, knowledge-update and AI-outage scenarios.
- Maintain negative cases where the correct behavior is to say insufficient information/do nothing.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.171 Execution contract — ENG 290: Golden target-architecture journeys

**Engineering authority:** V2.1.1 §290.

### MUST preserve
- Pre-visit: identify meaningful delta and pending obligations.
- Encounter: capture intent/goals, reason through hypothesis/evidence/uncertainty and approve plan.
- Plan compile: create prescription/order/monitoring/follow-up without re-entry.
- Result loop: receive/correct/review/action/communicate/reassess.
- Treatment loop: intervention → expected response → observed response → reassessment.
- Referral loop: question → specialist response → reconciliation.
- Patient loop: action plan → barrier/comprehension → routed follow-up.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.172 Execution contract — ENG 291: Golden target-architecture failure journeys

**Engineering authority:** V2.1.1 §291.

### MUST preserve
- AI proposes wrong patient context; output discarded.
- Plan compiler partially fails; no silent orphan work.
- Expected result never arrives; obligation escalates.
- Corrected result reverses prior interpretation; downstream state reopens.
- Medication dependency changes; only affected checks update.
- Contradictory facts remain unresolved; system abstains from false certainty.
- Knowledge unavailable; deterministic core remains usable.
- Clinician interrupted mid-plan; draft/recovery preserves context without committing.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.173 Execution contract — ENG 292: 30-pass circuit extension

**Engineering authority:** V2.1.1 §292.

### MUST preserve
- All existing 30 adversarial passes are rerun against the new domain primitives.
- Pass 02 explicitly attacks intent/goal/plan realism; Pass 05 information-state semantics; Pass 07 medication graph; Pass 08 goal/missing-evidence/contradiction knowledge; Pass 10 expected-result/response closure; Pass 16 new UI microstates; Pass 17 attention/cognitive load; Pass 28 synthetic physician workflows; Pass 29 cross-domain graph interactions.
- Major fixes invalidate affected later passes.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.174 Execution contract — ENG 293: 150-expert ownership extension

**Engineering authority:** V2.1.1 §293.

### MUST preserve
- Clinical Domain team owns Intent/Goal/Hypothesis/Decision primitives.
- Medication/Orders/Results/Follow-up team owns Plan Compiler, Expected Result and Treatment Response integration.
- Knowledge team owns computable goal/evidence/contradiction artifacts.
- Frontend/Human Factors owns Attention Budget, Delta and semantic timeline experience.
- AI team owns candidate extraction/proposal only within declared authority.
- QA/SRE/Security maintain independent challenge.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.175 Execution contract — ENG 294: Clinical safety hazards for target architecture

**Engineering authority:** V2.1.1 §294.

### MUST preserve
- Add hazards: false goal attainment, missing expected result, false contradiction resolution, AI-invented intent, incorrect episode grouping, inappropriate plan propagation, stale treatment response, preference mistaken for contraindication, hidden uncertainty and alert aggregation suppressing a critical signal.
- Each hazard receives prevention/detection/containment/recovery and validation evidence.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.176 Execution contract — ENG 295: Regulatory/intended-use change gate

**Engineering authority:** V2.1.1 §295.

### MUST preserve
- Each new CDS/AI function receives function-level intended-use review before production.
- Capabilities that influence diagnosis/treatment more strongly may alter regulatory posture and cannot inherit a blanket classification from the rest of Medical OS.
- Engineering specification does not claim regulatory exemption, certification or approval.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.177 Execution contract — ENG 296: Clinical knowledge source gate

**Engineering authority:** V2.1.1 §296.

### MUST preserve
- No new medical threshold, dosing rule, diagnostic criterion, monitoring interval or recommendation is invented in engineering code/spec.
- Such content enters through governed Knowledge/Algorithm pipelines with authoritative source, jurisdiction, effective date, clinical review and tests.
- Examples in UI/test fixtures must be labeled synthetic unless sourced/validated.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.178 Execution contract — ENG 297: Target architecture definition of done

**Engineering authority:** V2.1.1 §297.

### MUST preserve
- A capability is not done because UI/API exists.
- DoD requires product authority or PRODUCT-GAP status, domain contract, state machine, information states, provenance, authz, audit, failure policy, reconciliation, migrations, tests, observability, performance budget, security review, clinical safety review, rollback/recovery and documentation.
- C4/C5 additionally require clinical validation evidence appropriate to intended use.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.179 Execution contract — ENG 298: Target architecture release admission

**Engineering authority:** V2.1.1 §298.

### MUST preserve
- No unresolved S0/S1.
- No orphan C4/C5 requirement/invariant/test.
- No silent unknown→normal/negative.
- No AI high-impact authority escalation.
- No unowned critical work.
- No high-impact derived fact without version/provenance.
- No Patient State/Graph divergence beyond defined reconciled tolerance.
- No production activation of unresolved PRODUCT-GAP behavior.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.180 Execution contract — ENG 299: Architecture objective after this expansion

**Engineering authority:** V2.1.1 §299.

### MUST preserve
- Medical OS shall preserve a computable representation of what is known, unknown, changing, intended, expected, decided, done, observed and still owed for a patient.
- The platform shall prefer explicit state and closed loops over narrative inference.
- The system shall use the least probabilistic mechanism capable of solving the problem correctly.
- The physician remains final authority for clinically consequential judgment under the defined intended use.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.181 Execution contract — ENG 300: V2.1.1 target-architecture freeze marker

**Engineering authority:** V2.1.1 §300.

### MUST preserve
- Sections 212–300 form the Ultra-Senior Target Architecture Expansion.
- They augment, not erase, the prior Full-Fidelity V2.1.1 engineering baseline and Companion-parity annex.
- Next required governance action is promotion of PRODUCT-GAP items into the product specification, followed by bidirectional traceability and executable contracts.
- Further prose expansion should be justified by a discovered requirement gap; otherwise work moves to schemas, state machines, ADRs, threat models, tests and code.

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.182 Execution contract — ENG 301: Target architecture capability-to-engineering matrix

**Engineering authority:** V2.1.1 §301.

### MUST preserve

### Agent implementation obligations
- Inspect existing domain contracts, state machines, authorization, audit, provenance, events, migrations, tests and observability before editing.
- Prefer extending an existing primitive over creating a parallel source of truth.
- Preserve tenant and patient binding through UI, API, jobs, events, caches and derived projections.
- Represent unknown/conflicting/unverified/not-applicable states explicitly where semantically relevant.
- Add deterministic reconciliation for any asynchronous or derived state that can become orphaned or stale.
- Add negative tests where the correct behavior is abstention, insufficient information, no mutation or explicit degradation.
- Do not introduce clinical thresholds, formulas, contraindications, dosing logic or guideline content without approved Knowledge/Algorithm artifacts.

### Required evidence before merge
- Requirement/invariant IDs linked to implementation.
- Unit/integration/property tests appropriate to risk.
- Authorization and cross-tenant negative tests for patient-bound changes.
- Audit/provenance assertions for clinically consequential mutations.
- Failure/degraded-state test.
- Reconciliation or recovery test when asynchronous/derived state is involved.
- Observability evidence without raw PHI leakage.
- Product-gap disposition when physician-visible behavior is introduced.

## 1649.183 Target capability authority matrix

| Capability | Algorithm | Knowledge Engine | AI | Physician |
|---|---|---|---|---|
| Age/date arithmetic | AUTHORITATIVE | — | — | oversight |
| BMI | AUTHORITATIVE | formula metadata | — | interpretation |
| eGFR/validated formula | AUTHORITATIVE | formula/version/applicability | explanation only | interpretation |
| Pediatric mg/kg arithmetic | AUTHORITATIVE | approved dose range/source | explanation only | AUTHORITATIVE prescription |
| Unit conversion | AUTHORITATIVE | terminology/unit dictionary | — | oversight |
| Validated clinical score | AUTHORITATIVE | score definition/version | explanation | interpretation |
| Reference interval comparison | AUTHORITATIVE | source/reference metadata | explanation | interpretation |
| Mathematical trend | AUTHORITATIVE | — | contextual interpretation | decision |
| Result criticality | deterministic when codified | AUTHORITATIVE content/source | contextualize | action/closure |
| Medication interaction lookup | deterministic matching | AUTHORITATIVE knowledge source | contextualize | decision |
| Allergy-medication conflict | deterministic matching | terminology/knowledge | contextualize | decision |
| Care gap | applicability/time logic | AUTHORITATIVE guideline content | prioritize/explain | decision |
| Clinical coverage | completeness algorithm | AUTHORITATIVE Clinical Pack | prioritize/contextualize | decides what to ask/do |
| Pre-visit summary | source retrieval | relevance metadata | DRAFT AUTHORITY | validates |
| PDF extraction | schema validators | terminology | CANDIDATE EXTRACTION | validates when required |
| Longitudinal synthesis | deterministic facts/trends | evidence context | ASSISTIVE | interpretation |
| Differential generation | safety constraints | evidence/knowledge | SUGGESTIVE | AUTHORITATIVE |
| Diagnosis | validation constraints | evidence | ASSISTIVE ONLY | AUTHORITATIVE |
| Treatment selection | safety constraints | guidelines | ASSISTIVE ONLY | AUTHORITATIVE |
| Prescription | calculation/validation | pharmacologic knowledge | no autonomous authority | AUTHORITATIVE |
| Note signature | workflow | — | PROHIBITED | EXCLUSIVE |
| Critical result closure | workflow | escalation policy | no autonomous closure | AUTHORITATIVE where clinical |
| Clinical obligation deadline | AUTHORITATIVE | guideline interval | explain | confirms context |
| Clinical recommendation explanation | facts | source/evidence | ASSISTIVE | interpretation |
| Autonomous irreversible clinical action | — | — | PROHIBITED BASELINE | AUTHORITATIVE |
| Capability | Authority | Core primitive | Primary safety invariant | Product status |
| Clinical Intent | Physician / governed assist | ClinicalIntent | AI cannot silently commit intent | PRODUCT-GAP |
| Goal Engine | Physician + deterministic evaluation | ClinicalGoal | No auto-achievement without evidence/policy | PRODUCT-GAP |
| Plan Compiler | Physician commit + deterministic orchestration | PlanProposal/ActionReceipt | No partial silent propagation | PRODUCT-GAP |
| Expected Result | Deterministic workflow | ExpectedClinicalResult | No expected result can silently disappear | PRODUCT-GAP |
| Treatment Response | Physician + validated computation | TreatmentResponse | Missing follow-up ≠ success/failure | PRODUCT-GAP |
| Hypothesis Workspace | Physician | ClinicalHypothesis | AI hypothesis ≠ diagnosis | PRODUCT-GAP |
| Missing Evidence | Knowledge + physician | EvidenceGap | Unknown ≠ negative | PRODUCT-GAP |
| Contradiction Engine | Deterministic/Knowledge | ClinicalContradiction | Never silently choose conflicting truth | PRODUCT-GAP |
| Clinical Delta | Deterministic projection | ClinicalDelta | Every delta source-traceable | PRODUCT-GAP |
| Semantic Timeline | Projection | ClinicalEpisode/View | Grouping cannot rewrite source facts | PRODUCT-GAP |
| Attention Budget | Safety policy | AttentionSignal | Dedup cannot suppress critical hazard | PRODUCT-GAP |
| Patient Digital Twin | Composition | PatientComputableState | Not physiological prediction by default | ENGINEERING COMPOSITION |
| Ambient Layer | AI assist | CandidateClinicalObject | Candidate ≠ verified fact | PRODUCT-GAP |
| Patient Action Plan | Physician-approved plan projection | PatientAction | Patient input cannot overwrite verified fact | PRODUCT-GAP |
| Care Team OS | Authz/workflow | Responsibility/Obligation | Critical work cannot become ownerless | PRODUCT-GAP |

## 1649.184 PRODUCT-GAP stop condition

When implementing Clinical Intent, Goal Engine, Plan Compiler UX, Expected Result UX, Treatment Response, Hypothesis Workspace, Missing Evidence, Contradiction reconciliation, Uncertainty UX, Semantic Timeline, Patient Action Plan, Attention Budget, Ambient Clinical Layer or Care Team workflows:

1. Determine whether the exact physician-visible behavior already has V2 product authority.
2. If not, label the work `PRODUCT-GAP`.
3. Backend contracts, prototypes, test harnesses and shadow-mode infrastructure may be implemented when authorized.
4. Do not expose unrestricted clinical behavior as product truth until product governance promotes it.
5. Never solve a PRODUCT-GAP by inventing product behavior inside code.

## 1649.185 Patient Computable State execution boundary

The agent MUST NOT create a `patient_digital_twin` mega-table or monolithic JSON source of truth.

Implement authoritative primitives independently and compose:

```text
Patient State
+ Delta
+ Trajectory
+ Episodes
+ Problems
+ Hypotheses
+ Evidence
+ Uncertainty
+ Intent
+ Goals
+ Decisions
+ Interventions
+ Expected Results
+ Observed Results
+ Treatment Responses
+ Preferences
+ Risks
+ Care Gaps
+ Obligations
+ Provenance
```

Read models may denormalize for performance but MUST remain rebuildable/reconcilable from authoritative state.

## 1649.186 Clinical Plan Compiler execution protocol

Before implementing plan compilation, define:

```text
PlanProposal
PlanProposalVersion
PlanAction
PlanDependency
PlanValidationResult
PlanCommitResult
ClinicalActionReceipt
ExternalSideEffectIntent
ReconciliationState
```

Required sequence:

```text
physician plan
→ typed proposal
→ dependency + authorization validation
→ visible diff
→ physician commit
→ transactional domain mutations + audit/outbox
→ external side effects
→ reconciliation
```

Forbidden:

- plan text → autonomous irreversible clinical mutation;
- partial failure reported as success;
- duplicate downstream work on retry;
- losing physician intent when child actions are generated;
- closing an obligation merely because a downstream request was emitted.

## 1649.187 Goal / Response invariant suite

Minimum properties:

- Goal cannot become ACHIEVED solely because time elapsed.
- Missing observation cannot imply response.
- Response cannot silently use stale superseded evidence.
- Goal target and observed result preserve unit/dimension semantics.
- Individualized target is distinguishable from guideline/population target.
- Superseded goal remains historically reconstructable.
- Intervention can exist with response UNKNOWN.
- Multiple interventions prevent automatic causal attribution unless a validated model explicitly supports it.

## 1649.188 Hypothesis / Missing Evidence / Contradiction invariant suite

Minimum properties:

- AI hypothesis is never equivalent to confirmed diagnosis.
- Missing data is never negative evidence by default.
- Contradictory facts remain source-visible after reconciliation.
- A contradiction signal cannot delete/overwrite either source fact.
- Knowledge outage produces explicit unavailable/unknown state.
- Missing-evidence suggestions include applicability/source/version.
- Dismissed suggestion does not record the suggested answer.
- Hypothesis state transition is actor/version/audit traceable.

## 1649.189 Attention Budget implementation rule

Before adding a new alert/signal:

1. identify underlying hazard;
2. determine whether an existing signal already represents it;
3. define severity independently from model confidence;
4. define interruption behavior;
5. define dedup/grouping semantics;
6. define acknowledgement/override;
7. define downstream obligation when applicable;
8. define telemetry;
9. test that aggregation cannot suppress a critical hazard.

Agents MUST NOT solve safety by adding modal dialogs indiscriminately.

## 1649.190 Ambient Clinical Layer execution rule

Ambient pipeline MUST remain:

```text
capture
→ segment
→ extract
→ bind tenant/patient/encounter
→ candidate objects
→ deterministic validation / contradiction checks
→ physician review
→ explicit commit
```

Candidate objects MUST carry:

```text
candidate_id
task_version
model/config reference
source span/time span when available
patient/encounter binding
confidence/calibration metadata where valid
verification state
created_at
expiration/staleness state
```

Never map an LLM transcript extraction directly to `VERIFIED`.

## 1649.191 Patient-switch kill test

Any new patient-bound feature MUST pass:

1. open Patient A;
2. begin async request/draft/upload/AI task;
3. switch to Patient B before completion;
4. complete the old operation;
5. verify zero Patient-A content/action appears in Patient-B context;
6. verify server mutation revalidates patient identity;
7. verify stale result is discarded/quarantined;
8. verify audit remains correctly patient-bound.

Failure blocks merge for affected high-impact capability.

## 1649.192 Expected Result / Zero Lost Follow-Up invariant suite

- Order emitted is not result received.
- Result received is not reviewed.
- Reviewed is not actioned.
- Actioned is not patient informed.
- Patient informed is not necessarily clinically closed.
- Expected result timeout creates detectable state.
- Corrected result can reopen prior review/obligation.
- Staff deactivation cannot orphan expected-result ownership.
- Queue/provider outage cannot silently mark work complete.
- Reconciliation can reconstruct overdue work from authoritative state.

## 1649.193 Semantic Timeline implementation rule

Timeline is a projection, never source of truth.

Every timeline card MUST retain links to authoritative resource IDs and effective/recorded time. AI episode grouping must be marked as suggested until accepted when acceptance is required. Re-grouping cannot rewrite underlying clinical events.

## 1649.194 Clinical Memory implementation rule

Do not create one generic `memory` bucket mixing:

- verified clinical fact,
- patient-reported statement,
- patient preference,
- prior physician decision,
- historical context,
- AI inference.

Each category requires distinct authority/provenance and retrieval policy.

## 1649.195 Learning Health System firewall

Production telemetry MAY:

- identify candidate defects,
- measure alert burden,
- detect drift,
- open governance review,
- generate retrospective simulations.

Production telemetry MUST NOT autonomously:

- change clinical thresholds,
- change knowledge applicability,
- retrain and deploy clinical behavior,
- alter alert severity,
- redefine treatment success,
- convert physician overrides into new clinical rules.

## 1649.196 New architecture Definition of Done

For each target capability:

```text
[ ] Product authority or PRODUCT-GAP
[ ] Engineering contract
[ ] Domain types
[ ] Information states
[ ] State machine
[ ] Provenance
[ ] AuthZ
[ ] Audit
[ ] DB constraints
[ ] API contract
[ ] Event contract
[ ] Invariants
[ ] Hazards
[ ] Unit tests
[ ] Property tests
[ ] Integration tests
[ ] Negative tests
[ ] Concurrency tests where applicable
[ ] Retry/idempotency tests where applicable
[ ] Reconciliation
[ ] Failure/degraded UX
[ ] Telemetry
[ ] Performance budget
[ ] Migration/backfill policy
[ ] Rollback/recovery
[ ] Documentation
[ ] Traceability
[ ] Required independent review
[ ] Release evidence
```

## 1649.197 Companion ↔ V2.1.1 parity gate

A release of the documentation set is accepted only if automated review finds:

```text
UNMAPPED V2.1.1 TARGET CAPABILITIES = 0
UNMAPPED C4/C5 EXECUTION RULES = 0
ORPHAN CRITICAL INVARIANTS = 0
PRODUCT-GAP ITEMS WITHOUT STATUS = 0
CONFLICTING AUTHORITY RULES = 0
HIGH-IMPACT AI ACTIONS WITHOUT HUMAN-AUTHORITY POLICY = 0
CRITICAL ASYNC WORK WITHOUT RECONCILIATION = 0
```

## 1649.198 Final execution law

**Do not implement Medical OS as a collection of screens. Implement it as a network of explicit clinical states, intents, goals, evidence, decisions, interventions, expected outcomes, observed outcomes and obligations with deterministic safety, governed knowledge, bounded AI, longitudinal provenance and physician authority.**

The local reasoning boundary of each module MUST remain small even when global product capability is enormous.

# EXEC-1650 | ACTIVE | 1650. FORMAL CLINICAL ARCHITECTURE — AGENT EXECUTION UPDATE

**Engineering authority:** Medical OS V2.1.1 Formal Clinical Architecture §§302–348.  
**Execution purpose:** convert the formal clinical architecture into implementation constraints, verification gates and agent stop conditions. This section augments all prior Companion rules; stricter safety/authority rules prevail.

## 1650.1 Authority and non-invention rule

- V2 product authority remains binding for physician-visible behavior.
- V2.1.1 §§302–348 define the formal engineering architecture.
- This Companion MAY operationalize those requirements but MUST NOT invent new clinical meaning, thresholds, dosing rules, diagnostic criteria, legal conclusions or product authority.
- Any unresolved physician-visible behavior remains `PRODUCT-GAP`.
- Any semantic conflict between this Companion and V2.1.1 MUST be returned as `BLOCKED: SPEC_CONFLICT`.

## 1650.2 Formal architecture preflight

Before modifying a formal-clinical module, the agent MUST declare:

```text
MODE:
ENGINEERING REQUIREMENT:
PRODUCT AUTHORITY / PRODUCT-GAP:
SEMANTIC KERNEL TYPES:
AUTHORITY CLASS:
INFORMATION STATES:
STATE MACHINE:
INVARIANTS:
HAZARDS:
SOURCE OF TRUTH:
DERIVED STATE:
PROVENANCE:
AUTHZ:
AUDIT:
RECONCILIATION:
REPLAY REQUIREMENT:
IMPACT-QUERY REQUIREMENT:
SAFETY ENVELOPE:
AI TASK CARD:
FAILURE / ABSTENTION:
TEST ORACLE:
ROLLBACK / RECOVERY:
```

If any C4/C5-critical field is unknown, implementation stops rather than guessing.


## 1650.3 Execution contract — ENG-302 STATIC ANALYSIS FOR CLINICAL CODE

**Source authority:** V2.1.1 §302.

### Normative engineering meaning
- Create lint/static-analysis rules where feasible:
- forbid clinical package imports in UI bypass paths;
- forbid raw numeric thresholds in designated modules;
- forbid direct LLM SDK in clinical-domain;
- require unit type for quantity functions;
- require algorithm manifest linkage.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.4 Execution contract — ENG-303 TYPE-LEVEL UNIT SAFETY

**Source authority:** V2.1.1 §303.

### Normative engineering meaning
- Where practical, use branded/opaque types:
- type Kilograms = Brand<Decimal, "kg">;
type Milligrams = Brand<Decimal, "mg">;
- Runtime validation remains mandatory because external data are untyped.
- Type safety reduces internal misuse but does not replace unit validation.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.5 Execution contract — ENG-304 EXPLICIT NULLABILITY

**Source authority:** V2.1.1 §304.

### Normative engineering meaning
- Differentiate:
- absent;
- unknown;
- not asked;
- not applicable;
- unable to assess;
- withheld;
- entered in error.
- Do not collapse clinically distinct states into nullable booleans.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.6 Execution contract — ENG-305 TRI-STATE AND MULTI-STATE LOGIC

**Source authority:** V2.1.1 §305.

### Normative engineering meaning
- Clinical logic often requires more than true/false.
- Knowledge IR must support explicit unknown semantics.
- Avoid JavaScript truthiness for clinical decisions.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.7 Execution contract — ENG-306 DECISION TABLES

**Source authority:** V2.1.1 §306.

### Normative engineering meaning
- For complex deterministic policy, prefer reviewable decision tables when clearer than nested conditionals.
- Decision tables require:
- completeness analysis;
- overlap detection;
- unreachable rule detection;
- tests generated from rows/boundaries.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.8 Execution contract — ENG-307 DECISION TABLE COMPILATION

**Source authority:** V2.1.1 §307.

### Normative engineering meaning
- Compile approved decision tables into typed runtime artifacts.
- Never execute arbitrary spreadsheet formulas directly in production.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.9 Execution contract — ENG-308 FORMULA SOURCE RENDERING

**Source authority:** V2.1.1 §308.

### Normative engineering meaning
- Clinicians/reviewers should be able to see a human-readable representation of formula/logic corresponding to the active version.
- The rendered representation is generated from the authoritative specification to avoid documentation drift.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.10 Execution contract — ENG-309 MACHINE-GENERATED TESTS WITH HUMAN ORACLE

**Source authority:** V2.1.1 §309.

### Normative engineering meaning
- Agents can generate large test spaces, but expected clinical behavior for high-risk cases requires trusted oracle sources/review.
- Do not let the same model both invent the medical rule and certify its correctness.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.11 Execution contract — ENG-310 ORACLE HIERARCHY

**Source authority:** V2.1.1 §310.

### Normative engineering meaning
- Possible test oracles:
- mathematically proven invariant;
- official/reference implementation;
- validated published reference cases;
- independently implemented comparator;
- clinician-reviewed expected outcome.
- Record oracle type per test.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.12 Execution contract — ENG-311 ORACLE DISAGREEMENT

**Source authority:** V2.1.1 §311.

### Normative engineering meaning
- If trusted oracles disagree:
- stop;
- classify discrepancy;
- investigate source/version/population;
- do not majority-vote blindly.
- Disagreement may reveal a real clinical/standard ambiguity.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.13 Execution contract — ENG-312 PROPERTY REGISTRY

**Source authority:** V2.1.1 §312.

### Normative engineering meaning
- Maintain reusable properties across algorithms:
- unit invariance;
- deterministic repeatability;
- no output on invalid dimensions;
- historical immutability;
- tenant isolation;
- no silent default.
- Property registry improves consistency across newly generated algorithms.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.14 Execution contract — ENG-313 ALGORITHM TEMPLATE LIBRARY

**Source authority:** V2.1.1 §313.

### Normative engineering meaning
- Create validated templates for recurring patterns:
- scalar formula;
- score;
- threshold classification;
- age-banded rule;
- dose calculation;
- temporal interval;
- trend;
- reference-range evaluation;
- decision table.
- Templates accelerate development while inheriting established safety scaffolding.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.15 Execution contract — ENG-314 TEMPLATE VERSIONING

**Source authority:** V2.1.1 §314.

### Normative engineering meaning
- Algorithm templates are versioned.
- Generated algorithms record template version.
- Template defects trigger impact analysis over generated dependents.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.16 Execution contract — ENG-315 AUTOMATED SCAFFOLD QUALITY GATES

**Source authority:** V2.1.1 §315.

### Normative engineering meaning
- `algorithm:new` must generate:
- manifest;
- schemas;
- tests;
- provenance hooks;
- metrics hooks;
- docs;
- risk placeholder;
- ownership placeholder.
- Build fails until required placeholders are resolved.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.17 Execution contract — ENG-316 NO DEFAULT RISK TIER

**Source authority:** V2.1.1 §316.

### Normative engineering meaning
- New clinical algorithms start as `UNCLASSIFIED`.
- Unclassified assets cannot enter production.
- This prevents accidental low-risk defaults.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.18 Execution contract — ENG-317 NO DEFAULT JURISDICTION

**Source authority:** V2.1.1 §317.

### Normative engineering meaning
- Clinical knowledge artifacts must explicitly state applicability.
- Unknown jurisdiction cannot silently inherit Mexico/global behavior for clinically consequential policy.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.19 Execution contract — ENG-318 NO DEFAULT POPULATION

**Source authority:** V2.1.1 §318.

### Normative engineering meaning
- If evidence applies only to a population, applicability must encode it.
- Missing population metadata blocks activation where necessary.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.20 Execution contract — ENG-319 KNOWLEDGE GRANULARITY

**Source authority:** V2.1.1 §319.

### Normative engineering meaning
- Prefer atomic knowledge propositions over giant monolithic pathways.
- Atomic artifacts improve:
- reuse;
- conflict detection;
- update impact;
- testing;
- provenance.
- Clinical Packs compose atomic artifacts into workflow experiences.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.21 Execution contract — ENG-320 KNOWLEDGE COMPOSITION SAFETY

**Source authority:** V2.1.1 §320.

### Normative engineering meaning
- Composition can introduce contradictions.
- Compiler/runtime validates:
- duplicate outputs;
- incompatible priorities;
- circular dependencies;
- mutually exclusive recommendations;
- inconsistent units/terminology.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.22 Execution contract — ENG-321 EVIDENCE STRENGTH REPRESENTATION

**Source authority:** V2.1.1 §321.

### Normative engineering meaning
- Where source provides evidence strength/certainty, preserve it structurally.
- Do not invent certainty grades when source does not provide them.
- AI explanation must not upgrade weak evidence into definitive language.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.23 Execution contract — ENG-322 RECOMMENDATION STRENGTH VS EVIDENCE CERTAINTY

**Source authority:** V2.1.1 §322.

### Normative engineering meaning
- Keep separate when the source distinguishes them.
- A strong recommendation can coexist with lower certainty under some guideline frameworks.
- Do not collapse both into one “confidence” field.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.24 Execution contract — ENG-323 KNOWLEDGE EFFECTIVE-DATE SEMANTICS

**Source authority:** V2.1.1 §323.

### Normative engineering meaning
- A newly published guideline may not be immediately effective in every policy context.
- Track:
- publication;
- effective date;
- local adoption date;
- supersession.
- Runtime uses approved effective policy, not publication date alone.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.25 Execution contract — ENG-324 RETROSPECTIVE KNOWLEDGE VIEW

**Source authority:** V2.1.1 §324.

### Normative engineering meaning
- For audit, permit viewing what knowledge version was active at historical encounter time.
- Do not display today's guideline as if it were the source of a past decision.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.26 Execution contract — ENG-325 CURRENT-KNOWLEDGE REASSESSMENT

**Source authority:** V2.1.1 §325.

### Normative engineering meaning
- Separately, Medical OS may identify that a historical patient state merits reassessment under newer knowledge.
- This creates a new prospective consideration, never rewrites past rationale.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.27 Execution contract — ENG-326 KNOWLEDGE CHANGE NOTIFICATION

**Source authority:** V2.1.1 §326.

### Normative engineering meaning
- Clinicians should not be flooded by every guideline update.
- Notify only when:
- change materially affects their active patients/workflow;
- policy requires awareness;
- action may be needed.
- Use impact targeting.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.28 Execution contract — ENG-327 CLINICAL DEBT REGISTER

**Source authority:** V2.1.1 §327.

### Normative engineering meaning
- Track known limitations such as:
- unsupported population;
- incomplete terminology mapping;
- missing country rule;
- temporary manual workflow;
- pending evidence review.
- Clinical debt has owner, risk and due date.
- Do not hide known gaps in ordinary technical debt.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.29 Execution contract — ENG-328 SAFETY TECHNICAL DEBT BLOCKER

**Source authority:** V2.1.1 §328.

### Normative engineering meaning
- Debt affecting:
- tenant isolation;
- signed-record integrity;
- critical-result closure;
- high-risk dose correctness;
- provenance;
- algorithm version integrity
- can block release regardless of roadmap pressure.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.30 Execution contract — ENG-329 ASSUMPTION REGISTER

**Source authority:** V2.1.1 §329.

### Normative engineering meaning
- Every high-risk algorithm records assumptions.
- Example:
- creatinine assay compatibility;
- weight represents current measured weight;
- input unit canonicalization succeeded.
- Assumptions become testable review items.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.31 Execution contract — ENG-330 ASSUMPTION VIOLATION DETECTION

**Source authority:** V2.1.1 §330.

### Normative engineering meaning
- Where possible, runtime detects violated assumptions and abstains/warns.
- Undetectable assumptions must be documented as limitations.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.32 Execution contract — ENG-331 LIMITATION PRESENTATION

**Source authority:** V2.1.1 §331.

### Normative engineering meaning
- Known clinically relevant limitations should be available to users/reviewers without cluttering routine workflow.
- Do not bury material limitations only in developer docs.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.33 Execution contract — ENG-332 DOCUMENTATION DRIFT TEST

**Source authority:** V2.1.1 §332.

### Normative engineering meaning
- Generate portions of algorithm documentation from manifests/specifications.
- CI can compare:
- documented version;
- formula hash;
- source IDs;
- risk tier.
- This reduces stale docs.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.34 Execution contract — ENG-333 CODEOWNERS BY RISK DOMAIN

**Source authority:** V2.1.1 §333.

### Normative engineering meaning
- Clinical computation paths should require reviewers appropriate to domain.
- Examples:
- medication;
- laboratory;
- pediatrics;
- knowledge compiler;
- security.
- CODEOWNERS supports process; it does not itself prove qualified review.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.35 Execution contract — ENG-334 PR RISK DECLARATION

**Source authority:** V2.1.1 §334.

### Normative engineering meaning
- Every PR touching clinical computation declares:
- affected artifacts;
- risk tier;
- intended behavioral change;
- source/evidence change;
- migration;
- patient-impact possibility;
- required reviewers.
- “No behavioral change” should be testable via behavioral diff when feasible.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.36 Execution contract — ENG-335 CHANGESET GENERATION

**Source authority:** V2.1.1 §335.

### Normative engineering meaning
- Automate a clinical changeset:
- software diff
clinical artifact diff
knowledge diff
terminology diff
behavioral diff
test diff
risk diff
- Reviewers should not reconstruct this manually from hundreds of files.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.37 Execution contract — ENG-336 REVIEWER COGNITIVE LOAD CONTROL

**Source authority:** V2.1.1 §336.

### Normative engineering meaning
- Large diffs cause missed errors.
- High-risk clinical changes should be decomposed into reviewable units.
- If a change is necessarily large, provide generated summaries, dependency impact and targeted review views.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.38 Execution contract — ENG-337 TWO-PERSON RULE FOR C4/C5

**Source authority:** V2.1.1 §337.

### Normative engineering meaning
- At minimum, C4/C5 activation requires independent approval from qualified roles defined by governance.
- Emergency suspension can be unilateral by authorized safety role.
- Reactivation requires normal approval.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.39 Execution contract — ENG-338 RELEASE WINDOW POLICY

**Source authority:** V2.1.1 §338.

### Normative engineering meaning
- High-risk changes should avoid uncontrolled deployment at times when qualified monitoring/recovery staff are unavailable.
- Automated deployment convenience does not override safety operations.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.40 Execution contract — ENG-339 POST-RELEASE OBSERVATION WINDOW

**Source authority:** V2.1.1 §339.

### Normative engineering meaning
- After C4/C5 activation:
- heightened monitoring;
- predefined metrics;
- owner availability;
- rollback readiness;
- sampled case review where appropriate.
- Exit criteria are predefined.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.41 Execution contract — ENG-340 LONG-TAIL FAILURE REVIEW

**Source authority:** V2.1.1 §340.

### Normative engineering meaning
- Periodically inspect rare:
- not-computable;
- unsupported-unit;
- conflicting-data;
- manual override;
- runtime-error cases.
- The long tail often reveals assumptions not covered by common-path testing.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.42 Execution contract — ENG-341 SILENT FAILURE DETECTION

**Source authority:** V2.1.1 §341.

### Normative engineering meaning
- Monitor expected activity baselines.
- A sudden drop to zero rule firings can be as dangerous as an error spike.
- Detect:
- no events;
- missing source feed;
- stopped projector;
- disabled rule;
- failed scheduler.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.43 Execution contract — ENG-342 HEARTBEAT / SYNTHETIC CLINICAL CHECKS

**Source authority:** V2.1.1 §342.

### Normative engineering meaning
- Run synthetic non-PHI scenarios through critical computation paths.
- Verify:
- artifact resolution;
- units;
- computation;
- knowledge lookup;
- provenance;
- result state.
- Synthetic checks must never create real patient actions.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.44 Execution contract — ENG-343 WATCHDOG FOR CRITICAL WORKFLOWS

**Source authority:** V2.1.1 §343.

### Normative engineering meaning
- Independent watchdog/reconciliation can detect:
- critical result without owner;
- obligation stuck;
- workflow timer not firing;
- artifact unexpectedly inactive.
- Avoid one component being both primary executor and only monitor of its own failure.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.45 Execution contract — ENG-344 INDEPENDENT SAFETY MONITORING PRINCIPLE

**Source authority:** V2.1.1 §344.

### Normative engineering meaning
- For selected high-risk paths, safety monitoring should be logically independent from the component being monitored.
- This reduces common-mode failure.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.46 Execution contract — ENG-345 COMMON-MODE FAILURE ANALYSIS

**Source authority:** V2.1.1 §345.

### Normative engineering meaning
- Ask whether one dependency can break multiple controls simultaneously.
- Examples:
- same DB table powers workflow + watchdog;
- same AI model generates + validates;
- same terminology mapping used by both reference and production implementation.
- Introduce independence proportional to risk.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.47 Execution contract — ENG-346 FAULT TREE ANALYSIS

**Source authority:** V2.1.1 §346.

### Normative engineering meaning
- For C4/C5 hazards, consider fault trees:
- unsafe dose shown
├── wrong weight
├── wrong unit conversion
├── wrong range
├── wrong arithmetic
├── stale knowledge
├── wrong patient
└── presentation mismatch
- Map controls/tests to branches.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.48 Execution contract — ENG-347 FMEA / HAZARD ANALYSIS

**Source authority:** V2.1.1 §347.

### Normative engineering meaning
- Use structured failure-mode analysis for critical workflows:
- failure mode;
- cause;
- effect;
- detectability;
- control;
- residual risk.
- Do not rely exclusively on generic security threat modeling for clinical safety.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.49 Execution contract — ENG-348 STPA CONSIDERATION

**Source authority:** V2.1.1 §348.

### Normative engineering meaning
- For complex socio-technical safety interactions, consider Systems-Theoretic Process Analysis (STPA) where appropriate.
- Useful when harm can emerge from individually functioning components interacting incorrectly.
- Use only where complexity/risk justifies it.
- ————————————————————————

### Mandatory agent behavior
- Reuse canonical Clinical Semantic Kernel types; do not create a competing synonym/source of truth.
- Preserve tenant, patient, effective-time, recorded-time, version and provenance semantics end-to-end where applicable.
- Define explicit information/verification states instead of interpreting null/absence as clinical meaning.
- Enforce authority transitions explicitly; imported, patient-reported, AI-derived and clinician-verified states cannot be silently promoted.
- Add deterministic failure/abstention behavior for unsupported or ambiguous inputs.
- Add reconciliation for any derived/asynchronous state that can drift from authoritative truth.
- Add audit and observability without raw-PHI logging.
- Add negative tests proving what the system refuses to infer, mutate, close or display as verified.

### Merge evidence
- Contract/schema diff.
- State-machine/invariant mapping when applicable.
- Unit + integration tests.
- Property/model tests for critical lifecycle or arithmetic semantics when applicable.
- Cross-tenant and wrong-patient negative tests for patient-bound behavior.
- Failure/degraded-state test.
- Provenance/audit assertions.
- Reconciliation/replay evidence when required.
- Product-gap disposition for new physician-visible behavior.


## 1650.50 Canonical authority ladder

The following authority classes MUST remain distinguishable in types, storage, API responses and UI semantics:

```text
SOURCE MATERIAL
    ↓
ASSERTION
    ↓
VERIFICATION
    ↓
OBSERVED / ACCEPTED FACT
    ↓
DERIVED FACT
    ↓
INFERENCE
    ↓
KNOWLEDGE RECOMMENDATION
    ↓
AI SUGGESTION
    ↓
PHYSICIAN DECISION
    ↓
COMMITTED CLINICAL ACTION
```

This diagram is not permission for automatic promotion. Each transition requires its own allowed authority and guard.

Forbidden examples:

```text
AI extraction → VERIFIED
patient statement → confirmed diagnosis
external FHIR condition → accepted problem without import semantics
recommendation → physician decision
result received → result reviewed
queue ACK → clinical completion
```

## 1650.51 Semantic Kernel anti-duplication gate

Before creating a new domain type, search the kernel and domain registry.

Reject a new type if it is merely a second representation of:

`Fact`, `Assertion`, `Observation`, `Problem`, `Hypothesis`, `Evidence`, `Uncertainty`, `Intent`, `Goal`, `Decision`, `Intervention`, `ExpectedResult`, `ObservedResult`, `TreatmentResponse`, `Obligation`, `Preference`, `Episode`, `Risk`, `Contradiction`, `Provenance`.

A specialty-specific type MAY extend a canonical primitive but MUST declare the semantic relationship.

## 1650.52 Truth Model promotion tests

Every authority-changing path MUST test:

1. patient-reported assertion remains patient-reported until explicit verification;
2. imported assertion preserves external provenance;
3. AI extraction remains candidate/unverified;
4. deterministic derived fact identifies dependencies/version;
5. clinician acceptance creates an explicit transition/event;
6. supersession preserves prior state;
7. conflicting assertions coexist until reconciled;
8. absence of a source does not create a negative fact.

## 1650.53 State-machine enforcement gate

For each critical lifecycle:

```text
state
allowed transitions
transition actor/capability
preconditions
transactional writes
events
audit
side effects
failure state
reconciliation
terminal-state semantics
reopen semantics
```

Agents MUST NOT add a state or transition only in UI code.

Database/API/domain/event representations MUST agree.

## 1650.54 Zero Lost Follow-Up executable oracle

The reconciler MUST be capable of answering:

```text
For every applicable open clinically relevant future action:
- what is it?
- why does it exist?
- which patient?
- who owns it?
- when is it due?
- what is its authoritative state?
- what closes it?
- was it transferred/superseded/cancelled?
- is its queue/index/projection consistent?
```

If an applicable critical item has no accountable lifecycle, emit invariant violation rather than creating fictional completion.

## 1650.55 Invariant-as-Code minimum registry

Minimum seed:

```text
INV-TENANT-001  cross-tenant clinical access forbidden
INV-PATIENT-001 wrong-patient mutation forbidden
INV-SIGN-001    signed clinical snapshot immutable
INV-RESULT-001  critical result cannot silently disappear
INV-OBL-001     critical obligation cannot become ownerless
INV-AI-001      AI output cannot silently become verified fact
INV-UNIT-001    incompatible/unknown units cannot be silently computed
INV-UNK-001     unknown cannot silently become negative/normal
INV-KNW-001     high-impact knowledge output identifies artifact version
INV-PLAN-001    plan compilation cannot silently partially commit
INV-CORR-001    corrected result invalidates affected derived state
```

Each invariant requires owner + prevention + oracle + test + telemetry + reconciliation/recovery where applicable.

## 1650.56 Clinical Replay acceptance test

Given a historical high-impact output, replay tooling MUST retrieve enough immutable/versioned context to explain:

```text
WHAT was shown
WHEN
TO WHOM
FOR WHICH PATIENT
USING WHICH source facts
USING WHICH knowledge/algorithm/policy versions
USING WHICH application/schema/config release
USING WHICH AI task/model config, if applicable
WITH WHICH missing/conflicting inputs
AND WHAT downstream action followed
```

Do not regenerate historical nondeterministic AI output and present the regeneration as the original.

## 1650.57 Patient Impact Query acceptance test

For a selected artifact/version defect:

```text
artifact/version
→ executions
→ patient-bound outputs
→ clinicians/users exposed
→ downstream decisions/actions where traceable
→ unresolved follow-up
```

Impact jobs MUST be authorization/purpose scoped, resumable and audited.

## 1650.58 Safety Envelope fail-closed test

For each clinical computation, test at least:

```text
missing required input
ambiguous input
unsupported unit
unsupported route/context
conflicting input
stale dependency
artifact unavailable
artifact revoked
runtime failure
```

Expected output MUST be a typed non-computable/abstention/degraded state, never a plausible guessed clinical answer.

## 1650.59 Pediatric calculation kill tests

For every weight-dependent pediatric computation:

- stale weight;
- missing weight date;
- conflicting weights;
- wrong unit;
- unknown formulation concentration;
- unsupported route;
- maximum-dose boundary where governed knowledge supplies one;
- patient switched during calculation;
- knowledge artifact changed after draft;
- retry/double submit.

The receipt MUST preserve `weight_used`, source/date/verification and algorithm/knowledge version.

## 1650.60 AI Task Card merge gate

No new clinical AI task merges without:

```text
task_id/version
purpose
risk class
minimum-necessary input allowlist
patient/encounter binding
output schema
allowed actions
prohibited mutations
claim-grounding policy
abstention policy
staleness policy
eval suite
owner
kill switch
model/config compatibility
```

A model name alone is never an AI safety specification.

## 1650.61 AI Evidence Coverage oracle

For claim-producing AI tasks, test that:

- source-linked claims resolve to source spans/objects where the task supports grounding;
- unsupported high-impact claims do not appear as verified;
- inferential language remains distinguishable from direct evidence;
- missing evidence can cause abstention;
- evidence from another patient/tenant cannot enter the claim set;
- source correction/revocation invalidates affected candidate output where required.

## 1650.62 UI Truthfulness test matrix

Every supported surface MUST test semantic distinction for:

| State | Must never look identical to |
|---|---|
| VERIFIED | SUGGESTED / UNVERIFIED |
| PATIENT_REPORTED | clinician-verified fact |
| IMPORTED | locally verified fact without source cue |
| DERIVED | raw observation |
| SUGGESTED | physician decision |
| PENDING | completed/normal |
| CONFLICTING | reconciled truth |
| DEGRADED | absence of risk |

Do not rely on color alone.

## 1650.63 Reconciliation chaos suite

Inject:

```text
consumer crash after DB commit
duplicate event
out-of-order event
queue outage
search-index outage
worker restart
staff deactivation
patient merge
corrected result
knowledge revocation
partial external API success
retry after timeout
projection rebuild
```

Verify authoritative state survives and reconciliation converges without duplicate clinical action.

## 1650.64 Digital Twin Clinic CI tiers

```text
PR:
targeted high-risk journeys

NIGHTLY:
broad longitudinal synthetic suite

RELEASE CANDIDATE:
accelerated multi-month/year simulation
+ fault injection
+ migration/replay
+ long-chart performance
+ multi-tab/wrong-patient
```

Synthetic success is evidence of engineering robustness, not proof of real-world clinical validity.

## 1650.65 Clinical Safety Red Team gate

Before controlled pilot of a new high-impact domain, independently attempt:

```text
wrong patient
wrong tenant
wrong unit
wrong dose basis
false certainty
lost result
ownerless obligation
stale knowledge
corrected-result failure
AI hallucinated fact
unsafe alert deduplication
workflow dead end
unsafe override
partial plan commit
```

S0/S1 findings block pilot until resolved and regression-tested.

## 1650.66 Complexity Budget gate

Before approving a material feature, document:

```text
CLINICAL VALUE
SAFETY VALUE
COGNITIVE-LOAD EFFECT
OPERATIONAL VALUE
NEW STATES
NEW DEPENDENCIES
NEW FAILURE MODES
NEW MAINTENANCE BURDEN
ALTERNATIVE WITH LESS COMPLEXITY
```

If the feature primarily adds screens/fields/interruption without sufficient clinical/operational value, return it for redesign.

## 1650.67 Executable-documentation migration

After formal-spec normalization, new implementation detail SHOULD live in repository artifacts:

```text
docs/requirements
docs/domain
docs/state-machines
docs/invariants
docs/hazards
docs/adr
docs/threat-models
docs/algorithms
docs/knowledge
docs/ai-tasks
docs/api
docs/data
docs/reconciliation
docs/sre
docs/validation

packages/clinical-kernel
packages/contracts
packages/clinical-state
packages/clinical-graph
packages/clinical-computation
packages/clinical-knowledge
packages/units
packages/terminology
packages/provenance
packages/authz
packages/audit
packages/clinical-safety
packages/ai-gateway
packages/design-system
```

The Companion remains an execution constitution, not a dumping ground for every implementation detail.

## 1650.68 Formal architecture Definition of Done

```text
[ ] canonical semantic primitive used
[ ] authority class explicit
[ ] information states explicit
[ ] source/provenance preserved
[ ] state machine defined where applicable
[ ] invariant IDs mapped
[ ] hazard IDs mapped
[ ] safety envelope defined
[ ] authz + tenant/patient binding tested
[ ] audit tested
[ ] negative/abstention tests
[ ] property/model tests where critical
[ ] idempotency/concurrency tests where applicable
[ ] reconciliation implemented
[ ] replay metadata sufficient
[ ] impact trace sufficient where required
[ ] AI Task Card if AI used
[ ] UI truthfulness if physician/patient facing
[ ] degraded behavior
[ ] observability
[ ] migration/backfill semantics
[ ] rollback/recovery
[ ] performance budget
[ ] product authority / PRODUCT-GAP resolved
[ ] independent safety/security review appropriate to risk
```

## 1650.69 Formal parity gate

Documentation parity is accepted only when:

```text
V2.1.1 §§302–348 mapped to Companion = 100%
CRITICAL SEMANTIC PRIMITIVES WITH DUPLICATE AUTHORITY = 0
C4/C5 LIFECYCLES WITHOUT STATE MACHINE = 0
C4/C5 INVARIANTS WITHOUT EXECUTABLE ORACLE = 0
CRITICAL ASYNC LOOPS WITHOUT RECONCILIATION = 0
HIGH-IMPACT OUTPUTS WITHOUT REPLAY METADATA = 0
AI CLINICAL TASKS WITHOUT TASK CARD = 0
UNBOUNDED CLINICAL COMPUTATIONS = 0
UI AUTHORITY-CLASS AMBIGUITIES ACCEPTED AS DESIGN = 0
UNRESOLVED S0/S1 = 0
```

## 1650.70 Final formal execution principle

**Medical OS MUST know not only the patient's data, but the epistemic status, authority, temporal validity, provenance, dependency, lifecycle and clinical obligation attached to that data.**

The implementation agent MUST prefer explicit semantics and recoverable state over convenience, implicit inference or opaque automation.


## 1650.71 Formal implementation priority matrix

| Priority | Capability | Why now | Executable artifact | Release effect |
|---|---|---|---|---|
| P0 | Clinical Semantic Kernel | Prevents divergent clinical meaning | packages/clinical-kernel + schemas | Blocks domain implementation |
| P0 | Truth/Epistemology Model | Prevents source/inference/diagnosis conflation | assertion + verification contracts | Blocks AI/import promotion |
| P0 | Invariant Registry | Makes safety properties testable | invariants registry + CI | Blocks C4/C5 release |
| P0 | State Machine Constitution | Eliminates impossible lifecycle states | state-machine package | Blocks closed-loop release |
| P0 | Reconciliation Engine | Detects inevitable drift/orphans | reconcilers + runbooks | Required for critical async loops |
| P1 | Replay + Clinical BOM | Explains historical behavior | execution receipts/replay | Required for high-risk incident assurance |
| P1 | Patient Impact Query | Enables defect recall/impact | impact service | Required before broad algorithm rollout |
| P1 | Safety Envelope | Forces explicit non-computable states | manifest/runtime guard | Required for clinical computations |
| P1 | AI Task Cards | Bounds AI authority | task registry/evals | Required before clinical AI scale |
| P1 | UI Truthfulness | Prevents authority confusion | semantic design tokens | Required before AI/hypothesis UI |
| P2 | Digital Twin Clinic CI | Continuously attacks longitudinal behavior | synthetic CI harness | Required before scale |
| P2 | Clinical Safety Red Team | Independent clinical adversarial testing | hazard/regression program | Required before controlled pilot |

# EXEC-1651 | ACTIVE | 1651. EXECUTION AUTHORITY NORMALIZATION CONTROL

**Authority chain:** `PROD-* → ENG-* → EXEC-* → invariant / hazard / state-machine / test / evidence`.

This control block normalizes the Companion as the execution constitution. It adds no physician-visible product behavior and no new engineering architecture.

## Namespace law

- `EXEC-xxxx` identifies a top-level execution-authority section.
- Existing nested headings remain subordinate to their nearest `EXEC-xxxx` parent unless/until promoted to a dedicated executable registry artifact.
- `ACTIVE` means the execution rule is current.
- Product and engineering status always dominate execution status: an `EXEC-*` rule cannot activate a `FUTURE`, `HISTORICAL`, `SUPERSEDED` or unresolved `PRODUCT-GAP` behavior.
- The Companion may explain how to implement an `ENG-*` requirement but MUST NOT silently redefine `PROD-*` or `ENG-*`.
- Bare numeric section references are not stable execution IDs after normalization; use `EXEC-*`.

## Source-of-truth hierarchy

```text
PROD-*   = physician-visible product / clinical authority
ENG-*    = engineering architecture authority
EXEC-*   = implementation-agent execution authority
INV-*    = executable invariant
HAZ-*    = hazard / control evidence
SM-*     = state-machine artifact
AI-TASK-* = bounded AI task contract
TEST-*   = test oracle / regression evidence
```

When authorities conflict, the agent MUST stop with `BLOCKED: SPEC_CONFLICT` and cite the conflicting stable IDs.

## Execution activation rule

Before implementing an `EXEC-*` instruction, the agent MUST establish:

```text
EXEC_ID:
ENG_AUTHORITY:
PROD_AUTHORITY_OR_ARCHITECTURAL_AUTHORITY:
STATUS:
DOMAIN:
PATIENT/TENANT BINDING:
INFORMATION STATE:
STATE MACHINE:
INVARIANTS:
HAZARDS:
FAILURE/ABSTENTION:
RECONCILIATION:
TEST ORACLE:
ROLLBACK/RECOVERY:
```

For C4/C5 or clinically consequential behavior, missing authority is a stop condition.

## Historical / parity material rule

Historical or parity text retained in V2.1.1 is evidence, not active execution authority. The Companion MUST reference canonical `ENG-*` identifiers from the normalized V2.1.1 rather than numeric headings embedded in `ANNEX-PARITY`.

## Future capability rule

If the mapped `PROD-*` or `ENG-*` authority is `FUTURE`, the corresponding implementation may be scaffolded only when explicitly authorized, and MUST NOT become release-active clinical behavior merely because an `EXEC-*` section discusses it.

## Atomic traceability rule

Top-level `EXEC-*` IDs are the stable document namespace. During repository materialization, executable rules MUST receive registry IDs appropriate to their function:

```text
EXEC-* → INV-*
       → HAZ-*
       → SM-*
       → AI-TASK-*
       → TEST-*
       → ADR-*
       → API/SCHEMA/DB artifacts
```

The repository traceability registry, not prose similarity, becomes the machine authority for those mappings.

## Root-agent context rule

This full Companion is NOT intended to be injected wholesale into every coding task.

The repository SHOULD use a concise root `AGENTS.md` as a map and load scoped execution material according to the domain being changed. The complete Companion remains the constitutional execution source.

## Companion freeze gate

The Companion cannot be frozen until:

```text
ACTIVE EXEC RULES WITHOUT ENG/ARCHITECTURAL AUTHORITY = 0
EXEC RULES THAT SILENTLY REDEFINE PROD = 0
C4/C5 EXECUTION WITHOUT INVARIANT = 0
C4/C5 INVARIANT WITHOUT TEST ORACLE = 0
CRITICAL ASYNC EXECUTION WITHOUT RECONCILIATION = 0
HIGH-IMPACT AI EXECUTION WITHOUT AI-TASK CONTRACT = 0
UNRESOLVED SPEC_CONFLICT = 0
UNRESOLVED S0/S1 = 0
```

## Final normalized execution law

**The Companion tells an agent how to build Medical OS. It does not decide what Medical OS clinically means. Product meaning comes from `PROD-*`; engineering meaning comes from `ENG-*`; executable proof comes from code, tests and release evidence.**

# EXEC-1652 | ACTIVE | 1652. EXECUTION AUTHORITY FINALIZATION GATE

Purpose: close the execution-document findings from the normalized triple audit without inventing product or engineering authority. This governance block adds no physician-visible product behavior and no new engineering architecture.

## Execution authority laws

- `EXEC-0001` through `EXEC-1652` are the canonical top-level execution-authority identifiers for this Companion baseline.
- EXEC identifiers are immutable after finalization. Future changes require governed new IDs or explicit supersession; silent renumbering is prohibited.
- An ACTIVE `EXEC-*` rule does not by itself activate product or engineering scope. `PROD-*` and `ENG-*` status and authority remain controlling.
- No execution rule may infer a `PROD→ENG` or `ENG→EXEC` mapping from semantic similarity, adjacency, inherited context or model interpretation.
- Missing explicit mapping is `TRACEABILITY-PENDING`; it is not evidence of coverage and cannot satisfy a release gate.
- `FUTURE` product/engineering authority cannot become release-active because the Companion contains guidance, scaffolding, examples, prototypes or tests for it.
- Historical/parity engineering material is not execution authority unless mapped to a canonical ACTIVE `ENG-*` requirement.
- For C4/C5 or otherwise clinically consequential behavior, execution requires explicit invariant, failure semantics, test oracle, reconciliation where asynchronous, provenance/version traceability and human-authority boundary where applicable.
- High-impact AI execution requires a bounded `AI-TASK-*` contract, typed inputs/outputs, allowed/prohibited actions, grounding/evidence policy where applicable, abstention/failure semantics, evaluation owner and kill switch.
- Unknown, missing, unsupported, conflicting or unavailable information must fail explicitly and must never be coerced into normal, negative, false, zero or successful clinical state.
- Conflicting product, engineering or execution authority returns `BLOCKED: SPEC_CONFLICT`.
- The repository traceability registry is the machine authority for cross-document mappings. The Companion remains the execution constitution, not the mapping database.
- The full Companion must not be injected wholesale into every coding task; a concise root `AGENTS.md` and scoped execution context should route agents to the required authority.

## Execution-side audit closure

| Audit finding | Execution-side correction | Status | Remaining evidence |
|---|---|---|---|
| ACTIVE ENG without literal EXEC reference | Missing explicit mapping is now formally `TRACEABILITY-PENDING`, never inferred as covered. | CLOSED IN MASTER | ENG→EXEC executable registry |
| Nested execution rules lack atomic registry IDs | Top-level EXEC is stable; functional rules must materialize as INV/HAZ/SM/AI-TASK/TEST registry artifacts. | CLOSED IN MASTER | Repository registries |
| C4/C5 proof unavailable from prose | Invariant + test oracle + failure/reconciliation evidence required before release. | CLOSED IN MASTER | Executable tests/evidence |
| FUTURE status leakage | EXEC cannot activate FUTURE PROD/ENG scope. | CLOSED | CI status compatibility gate |
| Authority conflicts | `BLOCKED: SPEC_CONFLICT` is mandatory. | CLOSED | Conflict tests |
| Oversized root-agent context | Full Companion retained as constitution; root AGENTS.md must remain concise/scoped. | CLOSED | Repository AGENTS.md |
| System-wide freeze | Companion may freeze as execution authority without claiming implementation/release readiness. | CLOSED IN MASTER | System-wide executable gates |

## Execution authority invariants

- `XAI-001` — Every canonical top-level execution section has exactly one stable `EXEC-*` identifier.
- `XAI-002` — ACTIVE execution cannot create physician-visible behavior without ACTIVE product/architectural authority.
- `XAI-003` — Missing explicit mapping is `TRACEABILITY-PENDING`, never implicit coverage.
- `XAI-004` — FUTURE authority cannot satisfy ACTIVE release scope.
- `XAI-005` — C4/C5 behavior cannot release without executable invariant and test oracle.
- `XAI-006` — Critical asynchronous behavior cannot release without reconciliation and recovery semantics.
- `XAI-007` — High-impact AI cannot release without bounded AI Task Card and human-authority boundary.
- `XAI-008` — Unknown/missing/unsupported/conflicting data cannot be coerced into a clinically reassuring state.
- `XAI-009` — Cross-authority conflict blocks implementation until governed resolution.
- `XAI-010` — Semantic similarity is not traceability evidence.
- `XAI-011` — Historical/parity material cannot become execution authority by reference ambiguity.
- `XAI-012` — Release evidence must be executable and independently queryable from prose.

## Execution authority freeze declaration

**EXECUTION AUTHORITY FREEZE:** `EXEC-0001` through `EXEC-1652` are the finalized execution-constitution baseline for this Companion revision.

This freeze does **not** claim implementation completion, clinical validation, security validation, regulatory certification, operational readiness or production release. Those claims require executable traceability, invariants, state machines, hazards, tests, reconciliation, validation and release evidence.
