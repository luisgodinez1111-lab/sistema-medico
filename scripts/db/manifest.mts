// Regenera db/migrations/manifest.json con TODAS las migraciones y su sha256 (auditoría D-08). Se ejecuta al añadir una
// migración; tests/v22/migrations-integrity.test.ts falla si el manifiesto no coincide con los ficheros.
import fs from"node:fs";
const{readMigrationFiles,buildManifest}=await import("../../packages/db-migrations/src");
const m=buildManifest(readMigrationFiles());
fs.writeFileSync("db/migrations/manifest.json",JSON.stringify(m,null,1)+"\n");
console.log(JSON.stringify({migrations:m.migrations.length,last:m.migrations.at(-1)?.file}));
