import { z } from "zod";
export const AiTaskCard=z.object({
 id:z.string().regex(/^AI-TASK-\d{4}$/), version:z.string(),
 purpose:z.string().min(1), risk:z.enum(["C2","C3","C4","C5"]),
 authority:z.array(z.string().regex(/^ENG-\d{3}$/)).min(1),
 minimumNecessaryFields:z.array(z.string()).min(1), outputSchema:z.string().min(1),
 allowed:z.array(z.string()).min(1), prohibited:z.array(z.string()).min(1),
 evidence:z.string().min(1), abstention:z.string().min(1), owner:z.string().min(1),
 evalSuite:z.string().min(1), killSwitch:z.literal(true), envelope:z.string().regex(/^SE-\d{4}$/)
}).superRefine((x,ctx)=>{
 if((x.risk==="C4"||x.risk==="C5") && !/evidence|ground|claim|source/i.test(x.evidence))
  ctx.addIssue({code:"custom",message:"High-impact task requires explicit evidence policy"});
});
