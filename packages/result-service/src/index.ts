
import {closeResult,Result} from "../../order-result-domain/src";
export class ResultService{
 constructor(private obligations:{create(input:{patientId:string;ownerId:string;dueAt:string;sourceId:string}):Promise<unknown>}){}
 verify(r:Result){if(r.state!=="RECEIVED")throw new Error("RESULT_NOT_RECEIVED");return {...r,state:"VERIFIED" as const,version:r.version+1};}
 async requireAction(r:Result,patientId:string,ownerId:string,dueAt:string){if(!["VERIFIED","REVIEWED"].includes(r.state))throw new Error("RESULT_NOT_ACTIONABLE");await this.obligations.create({patientId,ownerId,dueAt,sourceId:r.id});return {...r,state:"REVIEWED" as const,version:r.version+1};}
 close(r:Result,evidence:string){return closeResult(r,evidence);}
}