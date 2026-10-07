// FASE 3 — Generador de ingesta del vademécum (escala REAL, sin fabricar). Convierte el vocabulario español real de
// las monografías del repo en entradas evaluables por el motor de seguridad, cruzándolas con RxNorm/ATC (RxNav, NLM).
//
// Flujo por sustancia (nombre español de la monografía):
//   1) RxNav approximateTerm  → RxCUI del principio activo (el emparejado lo hace RxNav, NO yo).
//   2) RxNav rxclass/byRxcui (ATC) → clase(s) ATC.
//   3) atc-crosswalk: ATC → clase(s) interna(s), VERIFICANDO que el nombre de clase ATC coincida con el esperado.
//   4) Admitir SOLO si ≥1 clase interna tiene regla renal (fail-closed). Lo demás → reporte de curación.
// Procedencia por fila: `source`=rxcui+ATC+fecha. Reproducible: cachea en data/rxnav-drug-snapshot.json (commiteado);
// re-correr sin --refresh regenera idéntico desde el snapshot. Uso: `pnpm drug:ingest [--refresh] [--limit N]`.
import fs from"node:fs";import path from"node:path";
import{fileURLToPath}from"node:url";
import{allMonographKeys}from"../../packages/drug-catalog/src/monographs";
import{resolveDrug,classHasRenalRule,type DrugEntry}from"../../packages/drug-catalog/src/index";
import{ATC_TO_INTERNAL,RENAL_EXCEPTION_INGREDIENTS}from"../../packages/drug-catalog/src/atc-crosswalk";

const HERE=path.dirname(fileURLToPath(import.meta.url));
const DATA=path.join(HERE,"data");
const SNAPSHOT=path.join(DATA,"rxnav-drug-snapshot.json");
const OUT_DRUGS=path.join(HERE,"../../packages/drug-catalog/src/ingested-drugs.ts");
const OUT_REPORT=path.join(DATA,"ingest-curation-report.json");
const REFRESH=process.argv.includes("--refresh");
const LIMIT=(()=>{const i=process.argv.indexOf("--limit");return i>=0?Number(process.argv[i+1]):Infinity;})();
const RXNAV="https://rxnav.nlm.nih.gov/REST";

// — util —
const norm=(s:string)=>s.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const stem=(s:string)=>s.replace(/(ina|ine|ol|ole|ide|ida|ato|ate|a|o|e)$/,"");
function lev(a:string,b:string):number{const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=0;j<=n;j++)d[0]![j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i]![j]=Math.min(d[i-1]![j]!+1,d[i]![j-1]!+1,d[i-1]![j-1]!+(a[i-1]===b[j-1]?0:1));return d[m]![n]!;}
// ¿El nombre que devolvió RxNav se parece lo bastante al nombre español? Guarda contra un emparejado aproximado falso.
function closeName(spanish:string,rxName:string):boolean{
 const a=norm(spanish).split(" ")[0]??"",b=norm(rxName).split(" ")[0]??"";
 if(!a||!b)return false;if(a===b)return true;
 if(stem(a)===stem(b)&&stem(a).length>=4)return true;
 if((a.startsWith(b)||b.startsWith(a))&&Math.min(a.length,b.length)>=5)return true;
 return lev(a,b)<=2&&Math.max(a.length,b.length)>=6;
}
async function getJson(url:string,tries=3):Promise<any>{
 for(let t=0;t<tries;t++){try{const r=await fetch(url,{headers:{accept:"application/json"}});if(r.ok)return await r.json();}catch{/* reintenta */}await new Promise(r=>setTimeout(r,250*(t+1)));}
 throw new Error("FETCH_FAILED "+url);
}

type Snap={rxcui:string|null;matchedName:string|null;confident:boolean;atc:{classId:string;className:string}[];error?:string};
const snapshot:Record<string,Snap>=fs.existsSync(SNAPSHOT)?JSON.parse(fs.readFileSync(SNAPSHOT,"utf8")):{};

async function resolveOne(term:string):Promise<Snap>{
 // 1) approximateTerm → rxcui + nombre(s) (RxNav suele traer el nombre español de DrugBank)
 const ap=await getJson(`${RXNAV}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=6&option=1`);
 const cands:any[]=ap?.approximateGroup?.candidate??[];
 const top=cands.find((c:any)=>c.rank==="1")??cands[0];
 if(!top?.rxcui)return{rxcui:null,matchedName:null,confident:false,atc:[]};
 const rxcui=String(top.rxcui);
 const approxNames:string[]=cands.filter((c:any)=>String(c.rxcui)===rxcui&&c.name).map((c:any)=>c.name as string);
 // 2) clases ATC — SOLO del INGREDIENTE mono (minConcept.tty==="IN"), NUNCA de un producto combinado (MIN): así un
 //    fármaco no hereda la clase de una combinación que lo contiene (p. ej. difenhidramina+ibuprofeno → NSAID). Es la
 //    protección estructural contra la misclasificación por combo.
 const cl=await getJson(`${RXNAV}/rxclass/class/byRxcui.json?rxcui=${rxcui}&relaSource=ATC`);
 const infos:any[]=cl?.rxclassDrugInfoList?.rxclassDrugInfo??[];
 const mono=infos.filter((x:any)=>x.minConcept?.tty==="IN"&&x.rxclassMinConceptItem?.classType==="ATC1-4");
 const inName:string|null=mono[0]?.minConcept?.name??null;
 // Confianza: el concepto resuelto se parece al nombre español (por el nombre aproximado español o el nombre IN).
 const confident=[...approxNames,...(inName?[inName]:[])].some(n=>closeName(term,n));
 const atc=confident?Array.from(new Map(mono.map((x:any)=>[x.rxclassMinConceptItem.classId,{classId:x.rxclassMinConceptItem.classId as string,className:x.rxclassMinConceptItem.className as string}])).values()):[];
 return{rxcui,matchedName:inName??approxNames[0]??null,confident,atc};
}

async function main(){
 fs.mkdirSync(DATA,{recursive:true});
 const keys=allMonographKeys();
 // Solo las sustancias que el motor AÚN no resuelve por una entrada CURADA (las ingeridas llevan `source`).
 const pending=keys.filter(k=>{const d=resolveDrug(k);return !(d&&!d.source);});
 const admitted:Record<string,DrugEntry>={};
 const curation:{name:string;reason:string;detail?:string}[]=[];
 let processed=0,fetched=0;
 for(const key of pending){
  if(processed>=LIMIT)break;processed++;
  // `snapshot[key]` es `Snap|undefined` (noUncheckedIndexedAccess) y el `catch` construía un objeto con claves que NO
  // existen en `Snap` (`rxName`, `tty`) y sin las que sí (`matchedName`, `confident`): en un fallo de red la instantánea
  // se guardaba con la forma equivocada, y solo no se notaba porque justo después se lee `error` y se continúa.
  let snap:Snap|undefined=snapshot[key];
  if(!snap||REFRESH){
   try{snap=await resolveOne(key);fetched++;}
   catch(e){snap={rxcui:null,matchedName:null,confident:false,atc:[],error:String(e)};}
   snapshot[key]=snap;if(fetched%25===0)fs.writeFileSync(SNAPSHOT,JSON.stringify(snapshot,null,1));}
  const sn:Snap=snap;
  if(sn.error){curation.push({name:key,reason:"FETCH_FAILED"});continue;}
  if(!sn.rxcui){curation.push({name:key,reason:"NO_RXCUI"});continue;}
  if(!sn.confident){curation.push({name:key,reason:"LOW_CONFIDENCE_MATCH",detail:`"${key}" ↮ RxNav "${sn.matchedName??""}"`});continue;}
  if(sn.atc.length===0){curation.push({name:key,reason:"NO_ATC"});continue;}
  // 3) crosswalk con verificación de nombre de clase ATC
  const classes=new Set<string>();const usedAtc:string[]=[];
  for(const a of sn.atc){
   const cw=ATC_TO_INTERNAL.get(a.classId);
   if(!cw)continue;
   if(!(norm(cw.atcName).includes(norm(a.className))||norm(a.className).includes(norm(cw.atcName)))){curation.push({name:key,reason:"ATC_NAME_MISMATCH",detail:`${a.classId}: esperado "${cw.atcName}", RxNav "${a.className}"`});continue;}
   for(const c of cw.internal)classes.add(c);usedAtc.push(a.classId);
  }
  if(classes.size===0){curation.push({name:key,reason:"CLASS_NOT_CROSSWALKED",detail:sn.atc.map(a=>`${a.classId} ${a.className}`).join("; ")});continue;}
  // Excepción renal documentada: miembro renalmente eliminado de una clase noAdjustment → NO heredar un "sin ajuste"
  // falso. Se deja NOT_EVALUATED (REVIEW), que es más seguro que admitirlo sin su regla renal real.
  if(RENAL_EXCEPTION_INGREDIENTS.has(key)){curation.push({name:key,reason:"RENAL_EXCEPTION_NEEDS_CURATION",detail:[...classes].join(",")});continue;}
  // 4) invariante renal: admitir solo si alguna clase interna tiene regla renal (si no, rompería la barrera)
  if(![...classes].some(classHasRenalRule)){curation.push({name:key,reason:"NO_RENAL_RULE_FOR_CLASS",detail:[...classes].join(",")});continue;}
  admitted[key]={ingredient:key,classes:[...classes].sort(),source:`RxNorm rxcui:${sn.rxcui} · ATC ${usedAtc.join("+")} · RxNav ${new Date().toISOString().slice(0,10)}`,atc:usedAtc.join("+")};
 }
 fs.writeFileSync(SNAPSHOT,JSON.stringify(snapshot,null,1));
 // — emitir el archivo generado (ordenado y estable) —
 const sortedKeys=Object.keys(admitted).sort();
 const body=sortedKeys.map(k=>{const d=admitted[k]!;return ` ${JSON.stringify(k)}:{ingredient:${JSON.stringify(d.ingredient)},classes:[${d.classes.map(c=>JSON.stringify(c)).join(",")}],source:${JSON.stringify(d.source)},atc:${JSON.stringify(d.atc)}},`;}).join("\n");
 const header=`// GENERADO por scripts/ops/drug-ingest.mts — NO editar a mano.\n//\n// Entradas INGERIDAS desde RxNorm/RxClass (ATC) vía RxNav (NLM), con procedencia por fila. El nombre español (clave)\n// viene de las monografías reales del repo; la clase, del cruce ATC→interna (atc-crosswalk.ts) verificado contra el\n// nombre de clase de RxNav; admitidas solo si su clase tiene regla renal (fail-closed). Re-generar: pnpm drug:ingest.\n// NO se inventa farmacología. Generado: ${new Date().toISOString().slice(0,10)}. Admitidas: ${sortedKeys.length}.\nimport type{DrugEntry}from"./index";\nexport const INGESTED_DRUGS:Record<string,DrugEntry>={\n${body}\n};\n`;
 fs.writeFileSync(OUT_DRUGS,header);
 const byReason:Record<string,number>={};for(const c of curation)byReason[c.reason]=(byReason[c.reason]??0)+1;
 fs.writeFileSync(OUT_REPORT,JSON.stringify({generatedAt:new Date().toISOString().slice(0,10),source:"RxNorm/RxClass ATC vía RxNav (NLM)",totalMonographs:keys.length,alreadyCurated:keys.length-pending.length,processed,admitted:sortedKeys.length,curationNeeded:curation.length,byReason,items:curation.sort((a,b)=>a.reason.localeCompare(b.reason)||a.name.localeCompare(b.name))},null,1));
 console.log(`[drug:ingest] monografías=${keys.length} pendientes=${pending.length} procesadas=${processed} fetched=${fetched} ADMITIDAS=${sortedKeys.length} curación=${curation.length}`);
 console.log(`[drug:ingest] por razón:`,byReason);
}
main().catch(e=>{console.error(e);process.exit(1);});
