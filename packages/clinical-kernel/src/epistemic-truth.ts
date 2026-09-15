
export type EpistemicState="REPORTED"|"IMPORTED"|"DERIVED"|"INFERRED"|"RECOMMENDED"|"VERIFIED"|"DECIDED"|"SIGNED";
const allowed:Record<EpistemicState,readonly EpistemicState[]>={
 REPORTED:["VERIFIED"], IMPORTED:["VERIFIED"], DERIVED:["VERIFIED"], INFERRED:["RECOMMENDED"],
 RECOMMENDED:["DECIDED"], VERIFIED:["DECIDED"], DECIDED:["SIGNED"], SIGNED:[]
};
export function promoteTruth(from:EpistemicState,to:EpistemicState,actor:"SYSTEM"|"AI"|"PHYSICIAN"){
 if(!allowed[from].includes(to)) throw new Error(`ILLEGAL_EPISTEMIC_PROMOTION:${from}:${to}`);
 if((to==="DECIDED"||to==="SIGNED") && actor!=="PHYSICIAN")
   throw new Error(`HUMAN_AUTHORITY_REQUIRED:${from}:${to}`);
 return to;
}
