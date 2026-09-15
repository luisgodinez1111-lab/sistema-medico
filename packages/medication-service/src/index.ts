
import {prescribe,stopMedication,Medication} from "../../medication-domain/src";
import {Principal,authorize} from "../../authz/src";
export class MedicationService{
 prescribe(p:Principal,m:Medication){authorize(p,{tenantId:p.tenantId,roles:["PHYSICIAN"],scope:"medication:write",purpose:"TREATMENT"});return prescribe(m,"PHYSICIAN",p.actorId);}
 stop(p:Principal,m:Medication,reason:string){authorize(p,{tenantId:p.tenantId,roles:["PHYSICIAN"],scope:"medication:write",purpose:"TREATMENT"});return stopMedication(m,reason);}
}