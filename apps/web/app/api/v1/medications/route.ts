import {NextResponse} from"next/server";
export async function POST(){return NextResponse.json({error:{code:"AUTH_SESSION_ADAPTER_REQUIRED",message:"Clinical mutation remains closed until verified principal/session integration is active."}},{status:503});}
export async function GET(){return NextResponse.json({error:{code:"AUTH_SESSION_ADAPTER_REQUIRED",message:"Clinical read remains closed until verified principal/session integration is active."}},{status:503});}
