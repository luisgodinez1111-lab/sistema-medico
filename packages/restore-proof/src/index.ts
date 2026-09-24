// Auditoría 2026-09-19, anexo R06 (R06-17): la huella del esquema no incluía RLS, políticas ni grants, así que un restore
// que dejara las tablas sin política pasaba el drill. `policiesComplete` es la mitad que faltaba: toda tabla con RLS tiene
// que tener al menos una política, porque con RLS y sin política la tabla no es «segura», es inservible.
//
// R06-F20 (lote 12e): `ledgerMatch` es la dimensión que faltaba —qué esquema se restauró, verificado por hash—. Había tres
// paquetes distintos para admitir un restore (`backup-restore`, `restore-verifier-v2`, este) y solo este tenía llamador;
// los otros dos se retiraron. Uno de ellos declaraba `backupHashVerified`, un booleano que nadie calculaba: aquí está la
// forma que SÍ aplica a esta arquitectura, donde el restore es un branch PITR o una reconstrucción desde migraciones y no
// hay fichero de dump con digest propio. Lo que se verifica por hash es el registro `schema_migrations` de la base
// restaurada: migración por migración, contra el origen y contra el repo (lo calcula `scripts/v22/restore-drill.mts`).
// `nonRepoTablesLost`: en una COPIA point-in-time, perder una tabla es un restore infiel aunque la tabla sea legado que
// ninguna migración crea (las tres de 0022). El drill solo lo puebla en ese camino; en una reconstrucción desde migraciones
// esas tablas no existen por definición y la lista va vacía.
export type RestoreProof=Readonly<{schemaHash:string;expectedSchemaHash:string;auditValid:boolean;rlsPass:boolean;replayHash:string;liveHash:string;obligationsMatch:boolean;policiesComplete?:boolean;rlsTablesWithoutPolicy?:readonly string[];ledgerMatch?:boolean;ledgerDivergence?:readonly string[];nonRepoTablesLost?:readonly string[]}>;
export function restoreErrors(x:RestoreProof){const e:string[]=[];if(x.schemaHash!==x.expectedSchemaHash)e.push("SCHEMA");if(!x.auditValid)e.push("AUDIT");if(!x.rlsPass)e.push("RLS");if(x.policiesComplete===false)e.push(`RLS_WITHOUT_POLICY:${(x.rlsTablesWithoutPolicy??[]).join(",")}`);if(x.ledgerMatch===false)e.push(`MIGRATION_LEDGER:${(x.ledgerDivergence??[]).join(",")}`);if(x.nonRepoTablesLost?.length)e.push(`NON_REPO_TABLES_LOST:${x.nonRepoTablesLost.join(",")}`);if(x.replayHash!==x.liveHash)e.push("REPLAY");if(!x.obligationsMatch)e.push("OBLIGATIONS");return e}
