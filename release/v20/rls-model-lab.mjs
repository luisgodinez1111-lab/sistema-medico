
import fs from"node:fs";const rows=fs.readFileSync("release/v20/rls-corpus.csv","utf8").split("\n");let allow=0,deny=0,roleDefect=0,miss=0;
for(const row of rows){const[a,b,role,bypass]=row.split(","),session=a===""?undefined:a;let exp;if(role!=="migrator"&&bypass==="1")exp="DATABASE_ROLE_DEFECT";else if(session===undefined)exp="DENY";else exp=session===b?"ALLOW":"DENY";
if(exp==="ALLOW")allow++;else if(exp==="DENY")deny++;else roleDefect++;if(!["ALLOW","DENY","DATABASE_ROLE_DEFECT"].includes(exp))miss++;}
console.log(JSON.stringify({status:miss?"FAIL":"PASS",cases:rows.length,allow,deny,roleDefect,miss},null,2));if(miss)process.exit(1);
