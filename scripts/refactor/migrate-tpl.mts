// Codemod de UN SOLO USO (auditoría R02a-TPL-01): sustituye las 18 copias IDÉNTICAS de `loadForTransition` y `commit`
// por la fábrica `aggregateLifecycle`. Conserva las firmas locales, así que ninguna llamada dentro de cada fichero cambia.
import fs from "node:fs";
const LOAD=/async function loadForTransition\(req:Request,(\w+):string\)\{\n const\{claims,ctx\}=resolveVerified\(req\);authz\(claims\);\n const\{idempotencyKey,expectedVersion\}=requireMutationHeaders\(req\);\n const folded=(\w+)\(await readAggregateEvents\(ctx,\1\)\);\n if\(!folded\.exists\)throw new ClinicalError\("NOT_FOUND","([^"]+)"\);\n return\{ctx,idempotencyKey,expectedVersion,folded\};\n\}/;
const COMMIT=/async function commit\(ctx:Parameters<typeof runClinicalCommand>\[0\],idempotencyKey:string,expectedVersion:number,(\w+):string,folded:(\w+),to:(\w+),eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string\)\{\n const cmd=buildCommand\(\{idempotencyKey,aggregateType:AGG,aggregateId:\1,expectedVersion,eventType,payload,occurredAt,topic\}\);\n let result=await lookupReplay\(ctx,cmd\);\n if\(!result\)\{(\w+)\(folded\.state,to\);result=await runClinicalCommand\(ctx,cmd\);\}\n const r=result\.response as\{version:number;auditHash\?:string\};\n return NextResponse\.json\(\{\1,state:to,version:r\.version,auditHash:r\.auditHash,replayed:result\.replayed\},\{status:result\.replayed\?200:201\}\);\n\}/;
let migrados=0;
for(const f of fs.readdirSync("apps/web/lib").filter(x=>x.endsWith("-lifecycle.ts"))){
 const p="apps/web/lib/"+f;let s=fs.readFileSync(p,"utf8");
 const ml=LOAD.exec(s),mc=COMMIT.exec(s);
 if(!ml||!mc)continue;
 const[,idName,foldFn,notFound]=ml;
 const[,idName2,foldedType,stateType,assertFn]=mc;
 if(idName!==idName2){console.log("SALTADO (ids distintos):",f);continue;}
 const fabrica=`// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en aggregate-lifecycle.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<${foldedType},${stateType}>({aggregateType:AGG,idKey:"${idName}",notFound:"${notFound}",fold:${foldFn},assertTransition:${assertFn},authz});
const loadForTransition=(req:Request,${idName}:string)=>LIFECYCLE.loadForTransition(req,${idName});
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,${idName}:string,folded:${foldedType},to:${stateType},eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,${idName},folded,to,eventType,payload,occurredAt,topic);`;
 s=s.replace(ml[0],fabrica).replace(mc[0],"");
 // import de la fábrica junto a los demás
 const lines=s.split("\n");let at=0;
 for(let i=0;i<Math.min(lines.length,40);i++) if(lines[i]!.startsWith("import")) at=i+1;
 lines.splice(at,0,'import{aggregateLifecycle}from"./aggregate-lifecycle";');
 s=lines.join("\n").replace(/\n{3,}/g,"\n\n");
 fs.writeFileSync(p,s,"utf8");migrados++;
 console.log(`${f}: ${foldedType}/${stateType} id=${idName}`);
}
console.log("migrados:",migrados);
