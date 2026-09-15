import { z } from "zod";

export const AuthorityId = z.string().regex(/^(PROD-\d{3}(?:-R\d{3})?|ENG-\d{3}(?:-R\d{3})?|EXEC-\d{4})$/);
export const RiskClass = z.enum(["C2","C3","C4","C5"]);
export const ExplicitClinicalState = z.enum([
  "COMPUTED","NOT_APPLICABLE","NOT_COMPUTABLE","INSUFFICIENT_DATA","CONFLICTING_DATA",
  "INVALID_INPUT","UNSUPPORTED_UNIT","ARTIFACT_UNAVAILABLE","DEPENDENCY_UNAVAILABLE",
  "SAFETY_BLOCKED","RUNTIME_ERROR"
]);
export const InvariantContract = z.object({
  id:z.string().regex(/^INV-\d{4}$/), eng:z.string().regex(/^ENG-\d{3}$/),
  risk:RiskClass, status:z.string(), contract:z.string().min(1),
  failure_gate:z.string().min(1), next_proof:z.string().min(1)
});
export const AiTaskContract = z.object({
  id:z.string().regex(/^AI-TASK-\d{4}$/), eng:z.string().regex(/^ENG-\d{3}$/),
  risk:RiskClass, status:z.string(), task:z.string().min(1), scope:z.string().min(1),
  input:z.string().min(1), output:z.string().min(1), failure:z.string().min(1),
  human_authority:z.string().min(1), ops:z.string().min(1)
});
