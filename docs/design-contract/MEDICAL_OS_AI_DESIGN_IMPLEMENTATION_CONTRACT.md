# Medical OS AI Design & Implementation Execution Contract

Status: subordinate executable implementation authority. Not a fifth master.

## 1. Mission
Translate the Medical OS authorities into a coherent, professional, safety-critical clinical interface. The agent is not asked to make arbitrary screens. It is asked to materialize governed clinical semantics into reusable components, responsive layouts, tests and evidence.

## 2. Required execution loop
For every screen or Golden UX Loop:
0 LOAD AUTHORITY
1 INSPECT EXISTING CODE
2 DEFINE CLINICAL JOB
3 MAP REQUIREMENTS
4 MAP P0-P8 PRIORITY
5 MAP EPISTEMIC CLASS
6 MAP HUMAN/SYSTEM AUTHORITY
7 ENUMERATE STATES
8 ENUMERATE FORBIDDEN STATES
9 MAP HAZARDS/CONTROLS/INVARIANTS
10 MAP CONNECTIONS AND FAILURE POINTS
11 SELECT/REUSE COMPONENTS
12 DEFINE CONTENT AND DENSITY LIMITS
13 DEFINE RESPONSIVE CONTRACT
14 DEFINE ACCESSIBILITY CONTRACT
15 DEFINE FIXTURES
16 DEFINE TEST PLAN
17 IMPLEMENT
18 TYPECHECK/LINT
19 UNIT/COMPONENT TEST
20 INTEGRATION/E2E
21 ACCESSIBILITY
22 RENDER CANONICAL VIEWPORTS
23 VISUAL INSPECTION
24 ADVERSARIAL/FULT-INJECTION QA
25 REPAIR DEFECTS
26 RE-RUN AFFECTED EVIDENCE
27 UPDATE FAILURE COVERAGE LEDGER
28 RECORD RESIDUAL RISK
29 GATE
30 MOVE TO NEXT SLICE ONLY AFTER THE CURRENT GATE IS SATISFIED OR EXPLICITLY BLOCKED

## 3. Visual implementation constitution
Use primitive -> semantic -> component tokens. No raw safety colors in clinical components. No arbitrary spacing, radius, elevation, icon size, font size or animation duration when a token exists. Color is never the sole carrier of critical state. Avoid excessive cards, nested cards, decorative gradients, giant marketing typography, rainbow status vocabularies, unexplained icons, critical information hidden in tooltips and dashboard-KPI aesthetics inside the encounter workspace.

Aesthetic fidelity is subordinate to clinical correctness. The North Star image is direction, not workflow authority.

## 4. App shell
Desktop >=1280: collapsible navigation (72 px collapsed / 240 px expanded), fluid primary clinical workspace, contextual rail preferred 360 px (320-400). Patient identity and P0/P1/P2 must remain discoverable during C5 actions.
Tablet: compact navigation; contextual rail becomes governed drawer/sheet; primary workspace uses available width. Collapsing secondary UI may not hide critical obligations or sign blockers.
Mobile: transform information architecture; do not squeeze desktop. Persist patient, critical state, current task and primary high-impact action; secondary context uses progressive disclosure.

## 5. Component construction law
Canonical components are state machines, not visual fragments. Every clinical component contract declares: semantic ID, authority, epistemic class, patient-context requirement, states, forbidden states, anatomy/slots, actions, responsive safety, accessibility, loading/pending/error/stale/conflict/degraded behavior, telemetry restrictions and test IDs.
Do not duplicate a canonical component merely to achieve a visual variation.

## 6. Interaction laws
High-impact action: patient + action + consequence must be visually/semantically associated. Pending is not success. Timeout is not proof of failure-to-commit. UNKNOWN_COMMIT_STATE requires authoritative lookup before blind retry. Stale writes preserve draft and reconcile. Session reauthentication never auto-submits a high-impact action. Patient switch invalidates patient-scoped drafts, queries, overlays and AI context according to v3.2.

## 7. Content stress rules
Never validate a design only with ideal fixture data. Required fixture classes: normal, critical, unknown, conflicting, corrected, degraded, extreme-density and long-content. Include homonyms, partial identity, long names, many problems, medications/allergies, overdue obligations, corrected results, stale projections, degraded AI/network and legacy unknowns.

## 8. Golden Component Gallery
Before broad screen production, render canonical components in every governed state, at desktop and compact widths, with short and adversarial content. Required gallery: PatientContextHeader, ClinicalValue, ClinicalAlert, ProblemCard, ResultCard, MedicationCard, ObligationCard, EvidenceCard, AIRecommendationCard, DecisionCard, TimelineEvent, SignGate, DegradedStateBanner.

## 9. Visual evidence
Required canonical viewports: 1440x900, 1280x800, 1180x820, 820x1180, 430x932, 360x800. For C5 states, capture deterministic screenshots and review diffs. A visual baseline is evidence only for the exact commit/environment/fixture/state recorded. Rebaseline only with an explicit reason and review.

## 10. Accessibility
Target WCAG 2.2 AA baseline plus v3.2 C5 requirements. Keyboard, focus, screen reader semantics, 200%/targeted 400% zoom, reduced motion, touch targets, error association and non-color critical semantics are required. Automated axe evidence does not substitute for designated human C5 assistive-technology review.

## 11. Design quality gate
A screen cannot PASS if: requirements/invariants are unmapped; forbidden state is reachable; patient context is ambiguous; C5 blocker is hidden at any canonical viewport; raw HTTP error is primary clinical explanation; success precedes server authority; unknown is normalized; required tests are not executed; visual diffs are unresolved; required accessibility evidence is missing; or C5 human review remains required.

## 12. Evidence report
Every implementation report records: screen/loop ID, requirements, commit/tree hash, environment, authority map, states, forbidden states, connections/failure points, components reused/created, tests with commands and exit codes, screenshots with hashes, accessibility evidence, fault injection, known defects, residual risks, evidence class and gate state.

## 13. Design quality definition
Professional means: coherent token system; predictable hierarchy; high information density without loss of comprehension; stable alignment; restrained elevation; consistent iconography; clinically meaningful state differentiation; responsive transformation rather than compression; accessible interaction; no false authority; no visual regression of safety information; and evidence that the implemented behavior matches the contract.

## 14. Final law
Do not expand prose by default. When a defect is discovered, repair the smallest authoritative contract, add the reproducing fixture/test, invalidate affected evidence, execute the repair and record the result.
