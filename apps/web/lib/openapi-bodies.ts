// Auditoría S-10 — esquemas JSON (2020-12) de los cuerpos de la API, derivados del zod que valida cada handler.
// Única implementación compartida por `pnpm openapi:generate` y por el test de sincronía de docs/api/openapi.json.
import{z}from"zod";
import{API_BODY_SCHEMAS}from"./api-body-registry";
export function deriveBodySchemas():Readonly<Record<string,Readonly<Record<string,unknown>>>>{
 const out:Record<string,Record<string,unknown>>={};
 for(const[key,schema]of Object.entries(API_BODY_SCHEMAS)){
  const js=z.toJSONSchema(schema,{target:"draft-2020-12",unrepresentable:"any",io:"input"}) as Record<string,unknown>;
  delete js["$schema"];out[key]=js;
 }
 return out;
}
