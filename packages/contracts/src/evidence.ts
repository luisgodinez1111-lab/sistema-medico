
export type EvidenceArtifact = Readonly<{
  path:string;
  sha256:string;
  authority:readonly string[];
  kind:"SOURCE"|"TEST"|"REGISTRY"|"EXECUTION"|"RELEASE_RESULT";
}>;

export type ReleaseEvidenceBundle = Readonly<{
  schemaVersion:"1.0";
  buildId:string;
  sourceRegistrySha256:string;
  generatedAt:string;
  artifacts:readonly EvidenceArtifact[];
  testExecution:"PASS"|"FAIL"|"NOT_RUN";
  admission:"PASS"|"BLOCKED";
}>;
