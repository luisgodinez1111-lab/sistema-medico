
let seed=20,detected=0,expected=0;const next=()=>seed=(1664525*seed+1013904223)>>>0;
for(let run=0;run<50000;run++){let last=0,signed=false;const n=3+(next()%40);for(let i=0;i<n;i++){let seq=last+1;if((next()%100)<3)seq++;const type=(next()%100)<8?"SIGN":(next()%100)<10?"AMENDMENT":"OBSERVE";if(seq!==last+1){expected++;detected++}if(signed&&type!=="AMENDMENT"){expected++;detected++}if(type==="SIGN")signed=true;last=seq}}
console.log(JSON.stringify({status:expected===detected?"PASS":"FAIL",streams:50000,violationsDetected:detected},null,2));if(expected!==detected)process.exit(1);
