
export type CapabilityAdmissionState =
  "PASS"|"BLOCKED_AUTHORITY"|"BLOCKED_HAZARD"|"BLOCKED_CONTROL"|"BLOCKED_INVARIANT"|
  "BLOCKED_TEST_SOURCE"|"BLOCKED_EXECUTION"|"BLOCKED_DEFECT"|"BLOCKED_EVIDENCE";

export type CapabilitySafetyCase = Readonly<{
  id:`CAP-${string}`;
  risk:"C2"|"C3"|"C4"|"C5";
  authority:readonly `ENG-${string}`[];
  hazards:readonly `HAZ-${string}`[];
  controls:readonly `CTL-${string}`[];
  invariants:readonly `INV-${string}`[];
  machines:readonly string[];
  tests:readonly string[];
  releasePolicy:string;
}>;
