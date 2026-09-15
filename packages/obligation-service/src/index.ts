
import {detectOverdue,completeObligation,Obligation} from "../../obligation-domain/src";
export class ObligationService{
 private rows=new Map<string,Obligation>();
 async create(x:{patientId:string;ownerId:string;dueAt:string;sourceId:string}){if(!x.ownerId)throw new Error("OBLIGATION_OWNER_REQUIRED");const id=`obl:${x.sourceId}`;const o:Obligation={id,patientId:x.patientId,ownerId:x.ownerId,dueAt:x.dueAt,state:"OPEN",version:1};this.rows.set(id,o);return o;}
 scan(now:string){const changed:Obligation[]=[];for(const [id,o] of this.rows){const n=detectOverdue(o,now);this.rows.set(id,n);if(n!==o)changed.push(n);}return changed;}
 complete(id:string,evidence:string){const o=this.rows.get(id);if(!o)throw new Error("OBLIGATION_NOT_FOUND");const n=completeObligation(o,evidence);this.rows.set(id,n);return n;}
}