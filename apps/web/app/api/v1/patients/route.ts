import{handlePatientRegister,handlePatientList}from"../../../../lib/patient-lifecycle";
// EPIC S — POST: registrar paciente. GET: listar pacientes del tenant.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handlePatientRegister(req);}
export async function GET(req:Request){return handlePatientList(req);}
