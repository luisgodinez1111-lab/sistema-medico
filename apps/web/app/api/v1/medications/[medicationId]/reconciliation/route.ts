import{handleMedicationReconciliation}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// Auditoría 2026-09-19, anexo R02a (R02a-MED-02) — POST /api/v1/medications/:id/reconciliation
//
// LA RUTA QUE NO EXISTÍA. `handleMedicationReconciliation` estaba completo —esquema, barreras, `commitAnnotation`— y
// ninguna ruta lo exponía, así que la conciliación de medicamentos era una capacidad declarada e inalcanzable: ni un
// médico ni una prueba en vivo podían llegar a ella. Conciliar es comparar lo prescrito con lo que el paciente realmente
// toma, y es el control que detecta el fármaco que dejó de tomarse sin que nadie lo supiera.
//
// Es una ANOTACIÓN: no cambia el estado del fármaco. Encontrar que el paciente no lo toma no es suspenderlo; la decisión
// clínica viene después y pasa por sus propias barreras.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await pathIds(ctx.params);return handleMedicationReconciliation(req,medicationId);}
