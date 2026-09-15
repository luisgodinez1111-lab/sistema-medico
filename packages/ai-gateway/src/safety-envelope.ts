import { z } from "zod";
export const SafetyEnvelope = z.object({
  id:z.string().regex(/^SE-\d{4}$/),
  aiTask:z.string().regex(/^AI-TASK-\d{4}$/),
  supported:z.array(z.string()).min(1),
  preconditions:z.array(z.string()),
  exclusions:z.array(z.string()),
  failureMode:z.enum(["ABSTAIN","SAFETY_BLOCKED","DEPENDENCY_UNAVAILABLE","INVALID_INPUT"]),
  humanApprovalRequired:z.boolean(),
  killSwitch:z.boolean(),
  evidenceRequired:z.boolean()
}).superRefine((x,ctx)=>{
  if(!x.killSwitch) ctx.addIssue({code:"custom",message:"AI safety envelope requires kill switch"});
  if(!x.evidenceRequired) ctx.addIssue({code:"custom",message:"AI safety envelope requires evidence"});
});
