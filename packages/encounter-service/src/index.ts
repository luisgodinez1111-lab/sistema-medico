
import {transitionEncounter,EncounterState} from "../../encounter-domain/src";
import {authorize,Principal} from "../../authz/src";
export type Encounter=Readonly<{id:string;tenantId:string;patientId:string;version:number;state:EncounterState;signedAt?:string}>;
export class EncounterService{
 constructor(private repo:{get(t:string,id:string):Promise<Encounter|null>;insert(e:Encounter):Promise<void>;update(e:Encounter,v:number):Promise<void>}){}
 async open(p:Principal,id:string,patientId:string){authorize(p,{tenantId:p.tenantId,roles:["PHYSICIAN"],scope:"encounter:write",purpose:"TREATMENT"});const e:Object={};const x:Encounter={id,tenantId:p.tenantId,patientId,version:1,state:"OPEN"};await this.repo.insert(x);return x;}
 async transition(p:Principal,id:string,to:EncounterState){authorize(p,{tenantId:p.tenantId,roles:["PHYSICIAN"],scope:"encounter:write",purpose:"TREATMENT"});const x=await this.repo.get(p.tenantId,id);if(!x)throw new Error("ENCOUNTER_NOT_FOUND");const state=transitionEncounter(x.state,to);const n={...x,state,version:x.version+1,...(to==="SIGNED"?{signedAt:new Date().toISOString()}: {})};await this.repo.update(n,x.version);return n;}
}