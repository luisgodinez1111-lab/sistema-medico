// EPIC BN — Evidencia física: verificador de INTERACCIONES de conjunto (Medicamentos › "Interacciones").
// Evalúa fármacos entre sí + factores del paciente, con severidad de 4 niveles + mecanismo + recomendación.
// Sin estado / sin PHI, pero se ejecuta con el arnés en vivo (auth real, RLS irrelevante aquí). vs Neon.
import fs from"node:fs";import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ixR=await import("../../apps/web/app/api/v1/interactions/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string){return{"content-type":"application/json",authorization:"Bearer "+t};}
async function verify(t:string,drugs:string[],factors:string[]=[]){const r=await ixR.POST(new Request("http://l/",{method:"POST",headers:H(t),body:JSON.stringify({drugs,factors})}));return{status:r.status,body:await r.json()};}
type Finding={kind:string;severity:string;severityLabel:string;a:string;b:string;mechanism:string;recommendation:string};
const has=(fs:Finding[],a:string,b:string,sev:string)=>fs.some(f=>((f.a===a&&f.b===b)||(f.a===b&&f.b===a))&&f.severity===sev);
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();

 // 1) Ejemplo insignia S8.3: Sertralina + Ibuprofeno + Metformina, factores Alcohol + Insuficiencia renal.
 const r=await verify(phys,["sertralina","ibuprofeno","metformina"],["alcohol","insuficiencia renal"]);
 ok(r.status===200,"VERIFY_200");
 const f:Finding[]=r.body.findings;
 ok(Array.isArray(f)&&f.length>0,"FINDINGS_PRESENT");
 // par SSRI+AINE -> Mayor (sangrado GI)
 ok(has(f,"sertralina","ibuprofeno","MAJOR"),"PAIR_SSRI_NSAID_MAYOR");
 // factor Alcohol × SSRI -> Moderada
 ok(has(f,"sertralina","Consumo de alcohol","MODERATE"),"FACTOR_ALCOHOL_SSRI_MODERADA");
 // factor Insuficiencia renal × BIGUANIDE (metformina) -> Moderada
 ok(has(f,"metformina","Insuficiencia renal","MODERATE"),"FACTOR_RENAL_BIGUANIDE_MODERADA");
 // factor Insuficiencia renal × AINE (ibuprofeno) -> Menor
 ok(has(f,"ibuprofeno","Insuficiencia renal","MINOR"),"FACTOR_RENAL_NSAID_MENOR");
 // orden por severidad descendente (el primero es el de mayor rango)
 ok(f[0]!.severity==="MAJOR","SORTED_BY_SEVERITY");
 // cada hallazgo trae mecanismo + recomendación + etiqueta ES no vacíos
 ok(f.every(x=>x.mechanism.length>0&&x.recommendation.length>0&&x.severityLabel.length>0),"MECHANISM_RECO_LABEL_PRESENT");
 // conteos y severidad máxima coherentes
 ok(r.body.counts.MAJOR>=1&&r.body.highestSeverity==="MAJOR"&&r.body.highestSeverityLabel==="Mayor","COUNTS_AND_HIGHEST");

 // 2) Síndrome serotoninérgico: Sertralina + Tramadol (dos serotoninérgicos) -> Mayor.
 const s=await verify(phys,["sertralina","tramadol"]);
 ok(has(s.body.findings,"sertralina","tramadol","MAJOR"),"SEROTONIN_SYNDROME_MAYOR");
 ok(/serotonin/i.test(JSON.stringify(s.body.findings)),"SEROTONIN_MECHANISM_TEXT");

 // 3) Contraindicada: IECA + embarazo -> Contraindicada (fetotoxicidad).
 const pg=await verify(phys,["enalapril"],["embarazo"]);
 ok(has(pg.body.findings,"enalapril","Embarazo","CONTRAINDICATED"),"ACE_PREGNANCY_CONTRAINDICADA");
 ok(pg.body.highestSeverityLabel==="Contraindicada","HIGHEST_CONTRAINDICADA");

 // 4) Conjunto seguro: Paracetamol solo -> sin hallazgos.
 // main 58ed375 añadió la regla ALCOHOL × ANALGESIC_ANTIPYRETIC (paracetamol hepatotóxico con alcohol crónico): con el factor
 // alcohol el conjunto YA NO es limpio. El «solo» del comentario es literal: sin fármacos ni factores acompañantes.
 const safe=await verify(phys,["paracetamol"]);
 ok(safe.body.findings.length===0&&safe.body.highestSeverity===null,"NO_INTERACTION_CLEAN");
 // Y la regla nueva de main queda fijada: paracetamol + alcohol -> Moderada (no desaparece en silencio).
 const etoh=await verify(phys,["paracetamol"],["alcohol"]);
 ok(has(etoh.body.findings,"paracetamol","Consumo de alcohol","MODERATE"),"FACTOR_ALCOHOL_PARACETAMOL_MODERADA");

 // 5) Transparencia: fármaco desconocido se reporta como no resuelto, no crashea.
 const unk=await verify(phys,["medicamentox","ibuprofeno"],["factor raro"]);
 ok(unk.status===200,"UNKNOWN_200");
 ok(unk.body.unresolvedDrugs.includes("medicamentox"),"UNRESOLVED_DRUG_REPORTED");
 ok(unk.body.unresolvedFactors.includes("factor raro"),"UNRESOLVED_FACTOR_REPORTED");

 // 6) Sin scope -> 403.
 const noScope=await verify(tok(["patient:read"]),["sertralina","ibuprofeno"]);
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
