// Auditoría 2026-09-19, anexo R06 (R06-17): la huella del esquema no incluía RLS, políticas ni grants, así que un restore
// que dejara las tablas sin política pasaba el drill. `policiesComplete` es la mitad que faltaba: toda tabla con RLS tiene
// que tener al menos una política, porque con RLS y sin política la tabla no es «segura», es inservible.
export type RestoreProof=Readonly<{schemaHash:string;expectedSchemaHash:string;auditValid:boolean;rlsPass:boolean;replayHash:string;liveHash:string;obligationsMatch:boolean;policiesComplete?:boolean;rlsTablesWithoutPolicy?:readonly string[]}>;
export function restoreErrors(x:RestoreProof){const e:string[]=[];if(x.schemaHash!==x.expectedSchemaHash)e.push("SCHEMA");if(!x.auditValid)e.push("AUDIT");if(!x.rlsPass)e.push("RLS");if(x.policiesComplete===false)e.push(`RLS_WITHOUT_POLICY:${(x.rlsTablesWithoutPolicy??[]).join(",")}`);if(x.replayHash!==x.liveHash)e.push("REPLAY");if(!x.obligationsMatch)e.push("OBLIGATIONS");return e}
