
import {evolvePatient,PatientState} from "../../patient-domain/src";
import {Repository} from "../../repository/src";
import {authorize,Principal} from "../../authz/src";
export class PatientService{
 constructor(private repo:Repository<PatientState>){}
 async create(p:Principal,id:string){authorize(p,{tenantId:p.tenantId,roles:["PHYSICIAN","CLINICAL_ADMIN"],scope:"patient:write",purpose:"TREATMENT"});const s=evolvePatient(undefined,{type:"CREATE_PATIENT",id,tenantId:p.tenantId});await this.repo.insert(s);return s;}
 async get(p:Principal,id:string){authorize(p,{tenantId:p.tenantId,scope:"patient:read"});const x=await this.repo.get(p.tenantId,id);if(!x)throw new Error("PATIENT_NOT_FOUND");return x;}
}