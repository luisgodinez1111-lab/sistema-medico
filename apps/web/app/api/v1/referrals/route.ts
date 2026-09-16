import{handleReferralRequest}from"../../../../lib/referral-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleReferralRequest(req);}
