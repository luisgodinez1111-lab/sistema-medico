# Convención de las rutas de la API v1

Auditoría 2026-09-19, anexo R04 (R04-F08): «no hay README dentro de `apps/web/app/api/` que explique la convención
*route.ts delegante + lifecycle*». Esto es ese documento. No describe una aspiración: describe lo que las **164 rutas de hoy
hacen**, y los guardarraíles que fallan si una ruta nueva se sale de la convención.

## La regla de una línea

**`route.ts` delega; la lógica vive en `apps/web/lib/<dominio>-lifecycle.ts`.** Un `route.ts` con reglas de negocio dentro
es un defecto: la lógica deja de ser comprobable sin HTTP y la misma decisión acaba escrita en varios sitios (es el hallazgo
R02a-TPL-01, que costó 25 copias de la misma tríada de autorización).

```ts
// apps/web/app/api/v1/<recurso>/[<recurso>Id]/<transición>/route.ts
import{handleAlgo}from"../../../../../../lib/algo-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{algoId:string}>}){
 try{
  const{algoId}=await pathIds(ctx.params); // R04-007: el identificador se valida ANTES de tocar el kernel
  return await handleAlgo(req,algoId);
 }catch(e){return httpErrorResponse(e);} // D8: sin el try, el 400 de pathIds escapa y Next responde un 500 sin cuerpo
}
```

`runtime="nodejs"` y `dynamic="force-dynamic"` son obligatorios: el kernel usa `postgres.js` (no corre en edge) y una
respuesta clínica cacheada es una respuesta que miente.

## Qué pone cada capa

| Capa | Responsabilidad | Qué NO hace |
|---|---|---|
| `route.ts` | Declarar el runtime, validar el identificador de ruta, delegar | Autorizar, leer la base, decidir nada |
| `<dominio>-lifecycle.ts` | Autorizar, validar el cuerpo con zod, plegar el stream, escribir el comando | Consultas SQL sueltas (van en `lib/runtime/*`) |
| `lib/lifecycle-factory.ts` | La tríada `authz → loadForTransition → commit` de toda transición de agregado | Vocabulario de dominio |
| `packages/*` | Reglas puras y calculables (compatibilidad ABO, ESI, Kt/V, CKD-EPI…) | Tocar HTTP, la base o PHI |

## Lo que un guardarraíl te va a exigir

Estos tests fallan y son la razón por la que la convención se sostiene; conviene conocerlos antes de escribir la ruta:

- **`tests/v22/http-boundary.test.ts`** — toda ruta con parámetro de ruta lo valida con `pathIds` antes de llamar al
  handler. Un identificador sin validar llega al kernel y produce un 500 de Postgres en vez de un 400.
- **`tests/v22/route-id-dynamic.test.ts`** — invoca **toda** operación con parámetro `*Id` con un id malformado y exige
  400 `VALIDATION_ERROR` sin tocar la persistencia (hallazgo D8: el `pathIds` fuera del `try` daba un 500 sin cuerpo).
- **`tests/v22/route-coverage.test.ts`** — **toda** ruta HTTP la ejercita al menos una prueba en vivo
  (`scripts/v22/live-*-proof.mts`) que importa el handler real y lo invoca con un `Request` real contra una base real con RLS
  forzado. Añadir una ruta sin prueba rompe la suite: es lo que mantiene el 100 % y evita que «las rutas están probadas»
  envejezca.
- **`tests/v22/openapi-inventory.test.ts`** — cada `route.ts` aparece en `docs/api/openapi.json` con sus métodos reales.
- **`tests/v22/follow-state.test.ts`** — todo `kind` que un ciclo de seguimiento emite está clasificado en la UI. Un estado
  nuevo sin clasificar aparece como «pendiente» sin que nadie lo decida (ver R05a-F02: una vacuna con evento adverso se
  mostraba como pendiente).
- **`tests/v22/gates-that-can-fail.test.ts`** — ninguna llamada a `authorize` puede omitir el propósito de uso. Como
  `authorize` solo lo compara si el llamador lo declara, no declararlo equivale a no comprobar nada (R2B-025).

## Cuerpo de la petición y OpenAPI

1. El cuerpo se valida con zod **en el lifecycle**, no en la ruta, y el esquema se exporta (`export const XBody=z.object…`).
2. Registrar el cuerpo y regenerar el contrato:

```sh
pnpm openapi:registry   # descubre los cuerpos exportados y actualiza apps/web/lib/api-body-registry.ts
pnpm openapi:generate   # regenera docs/api/openapi.json desde el inventario de rutas
pnpm openapi:check      # falla si el contrato publicado no coincide con el código
```

Si `openapi:check` falla, el contrato publicado y el código dicen cosas distintas: gana el código, regenera.

## Scope y propósito

- Cada recurso tiene `<recurso>:read` y `<recurso>:write`. **Una lectura pide `:read`**; el scope de escritura implica el de
  lectura del mismo recurso, y esa implicación vive en un solo sitio (`packages/runtime-auth`). Pedir `:write` para leer hace
  imposible un rol de solo lectura, que es el hallazgo S-01/S-02.
- **Pasa siempre `purpose`.** Para atención clínica es `"TREATMENT"`; para configuración administrativa,
  `["TREATMENT","OPERATIONS"]`. Una autorización sin propósito no comprueba el propósito.
- Las mutaciones exigen `Idempotency-Key` y `If-Match` (`requireMutationHeaders`). La versión esperada **la aporta el
  cliente**: fijarla en el código rompe la concurrencia optimista y se desincroniza en cuanto aparece un evento intermedio
  (R2B-010).

## Errores

`toHttpError` traduce `ClinicalError` a HTTP en un único sitio. Los códigos que más se usan:
`VALIDATION_ERROR`→400, `UNAUTHENTICATED`→401, `FORBIDDEN`/`CROSS_TENANT`→403, `NOT_FOUND`→404, `CONFLICT`→409,
`PRECONDITION_REQUIRED`→428. **Nunca** se construye una respuesta de error a mano en la ruta: el cuerpo del error tiene una
forma declarada y campos permitidos por código (`http-errors.ts`), justamente para que no se filtre PHI en un mensaje.

## Antes de crear una ruta nueva

1. ¿Existe ya el lifecycle? Casi siempre sí, y la ruta es una transición más.
2. ¿La transición está en la máquina de estados del `*-fold`? Si no, ahí empieza el trabajo, no en la ruta.
3. ¿Quién puede hacerla (rol, scope, propósito) y contra qué recurso?
4. ¿Qué prueba en vivo la va a ejercitar? Escríbela: `route-coverage` la va a exigir de todos modos, y el orden importa
   porque la prueba es la que descubre lo que la lectura del código no ve.
