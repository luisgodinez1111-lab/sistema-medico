import{handleAiAssist}from"../../../../../lib/ai-copilot-gateway";
// EPIC CB (ADR-0220 fase 1) — POST /api/v1/ai/assist: choke point de seguridad del copilot (sin IA generativa).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAiAssist(req);}
