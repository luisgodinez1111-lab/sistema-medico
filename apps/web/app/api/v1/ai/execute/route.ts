import{handleAiGatewayExecute,aiGatewayEnabled,aiKillSwitchResponse}from"../../../../../lib/ai-gateway-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// R6 opción B — ejecución de tarea de IA por el gateway. Kill-switch primero: sin habilitar, 503 honesto (nada de IA).
// Habilitado y sin proveedor: el handler se ABSTIENE (503 DEPENDENCY_UNAVAILABLE), nunca fabrica salida.
export async function POST(req:Request){if(!aiGatewayEnabled())return aiKillSwitchResponse();return handleAiGatewayExecute(req);}
