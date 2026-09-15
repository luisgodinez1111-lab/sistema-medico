
import {deliveryFailure,delivered,OutboxMessage} from "../../../packages/outbox/src";
export async function processOutbox(message:OutboxMessage,publish:(m:OutboxMessage)=>Promise<void>){try{await publish(message);return delivered(message);}catch{return deliveryFailure(message);}}
