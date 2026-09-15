
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const files=[
 ["safety/core-invariants.json",["ENG-307","ENG-308","ENG-303","ENG-311","ENG-342","ENG-319"],"REGISTRY"],
 ["safety/core-hazards.json",["ENG-307","ENG-303","ENG-311","ENG-342","ENG-319"],"REGISTRY"],
 ["safety/controls/catalog.json",["ENG-307","ENG-308","ENG-303","ENG-311","ENG-342","ENG-319"],"REGISTRY"],
 ["ai-tasks/catalog.json",["ENG-266","ENG-320","ENG-321","ENG-322","ENG-323","ENG-339"],"REGISTRY"],
 ["ai-tasks/bindings.json",["ENG-320","ENG-338","ENG-339"],"REGISTRY"],
 ["release/test-evidence-manifest.json",["ENG-309","ENG-346"],"REGISTRY"]
];
const artifacts=[];
for(const [p,a,k] of files){if(!fs.existsSync(p))throw new Error(`MISSING_EVIDENCE_ARTIFACT:${p}`);artifacts.push({path:p,sha256:sha(p),authority:a,kind:k});}
const execution=fs.existsSync("release/test-execution.json")?JSON.parse(fs.readFileSync("release/test-execution.json")):{status:"NOT_RUN"};
const admission=fs.existsSync("release/admission-result.json")?JSON.parse(fs.readFileSync("release/admission-result.json")):null;
const admissionPass=admission?.results?.every?.(x=>x.status==="PASS")===true;
const sourceMeta=JSON.parse(fs.readFileSync("registry_meta_v0_10.json"));
const bundle={schemaVersion:"1.0",buildId:`LOCAL-${Date.now()}`,sourceRegistrySha256:sourceMeta.source_sha256,generatedAt:new Date().toISOString(),
 artifacts,testExecution:execution.status??"NOT_RUN",admission:admissionPass?"PASS":"BLOCKED"};
fs.writeFileSync("release/bundles/latest.json",JSON.stringify(bundle,null,2));
console.log(JSON.stringify(bundle,null,2));
