
import {evolvePatient,PatientState} from "../../patient-domain/src";
import {Repository} from "../../repository/src";
import {authorize,type Principal} from "../../runtime-auth/src"; // S-09: única autorización
export class PatientService{
 constructor(private repo:Repository<PatientState>){}
 async create(p:Principal,id:string){authorize(p,{tenantId:p.tenantId,scope:"patient:write",purpose:"TREATMENT"});/* el rol lo decide la política rol→scopes del servidor (ADR-0230) */const s=evolvePatient(undefined,{type:"CREATE_PATIENT",id,tenantId:p.tenantId});await this.repo.insert(s);return s;}
 async get(p:Principal,id:string){authorize(p,{tenantId:p.tenantId,scope:"patient:read"});const x=await this.repo.get(p.tenantId,id);if(!x)throw new Error("PATIENT_NOT_FOUND");return x;}
}