
export type SafetySeverity = "S0"|"S1"|"S2"|"S3"|"S4";
export type ControlType = "PREVENTIVE"|"DETECTIVE"|"CORRECTIVE"|"RECOVERY";
export type EvidenceState = "ABSENT"|"PENDING"|"PASS"|"FAIL"|"STALE";

export type Hazard = Readonly<{
  id:`HAZ-${string}`;
  authority:readonly `ENG-${string}`[];
  severity:SafetySeverity;
  hazardousCondition:string;
  foreseeableSequence:readonly string[];
  potentialHarm:string;
  controls:readonly `CTL-${string}`[];
}>;

export type SafetyControl = Readonly<{
  id:`CTL-${string}`;
  authority:readonly `ENG-${string}`[];
  type:ControlType;
  invariant?:`INV-${string}`;
  verification:readonly string[];
  failure:"BLOCK"|"ESCALATE"|"SAFE_MODE"|"ABSTAIN";
}>;
