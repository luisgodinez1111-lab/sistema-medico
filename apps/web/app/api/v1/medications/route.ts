import{handleMedicationProposal}from"../../../../lib/medication-lifecycle";
// EPIC H — POST /api/v1/medications  (proponer una medicación -> PROPOSED)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleMedicationProposal(req);}
