import{handleRegisterTaskCard,aiGatewayEnabled,aiKillSwitchResponse}from"../../../../../lib/ai-gateway-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// R6 opción B — registro de AI-TASK cards (Physician Control), detrás del kill-switch.
export async function POST(req:Request){if(!aiGatewayEnabled())return aiKillSwitchResponse();return handleRegisterTaskCard(req);}
