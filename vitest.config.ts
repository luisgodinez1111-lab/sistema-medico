import{defineConfig}from"vitest/config";
import{cpus}from"node:os";
// ARQUITECTURA DE PRUEBAS POR PROYECTOS (Vitest 3) — señal estable y RÁPIDA, no un parche.
//
// Dos perfiles de recursos muy distintos, cada uno con su entorno y su política de concurrencia:
//
//   • unit — los ~270 tests de LÓGICA (*.test.ts): entorno node. Son funciones puras (dominio, catálogo, folds, CDS):
//     no necesitan aislamiento por archivo, así que se corren en el pool de HILOS con `isolate:false` (reutiliza el
//     contexto → menos overhead de arranque) y con tantos hilos como cores. Es el gate real de corrección.
//   • ui   — los tests de RENDER/ACCESIBILIDAD (*.test.tsx: jsdom + axe). Necesitan aislamiento (jsdom por archivo),
//     así que van en FORKS aislados. Se reparten en varios archivos (ver _cockpit-harness) para PARALELIZAR en los
//     cores en vez de un monolito serial; timeout holgado porque axe es pesado.
//
// `vitest run` ejecuta AMBOS proyectos (misma cobertura); `test:unit`/`test:ui` corren uno. El transform JSX automático
// (como Next) se declara en cada proyecto para que .ts y .tsx se compilen igual.
const JSX={jsx:"automatic" as const,jsxImportSource:"react"};
const CORES=Math.max(2,cpus().length);
export default defineConfig({
 esbuild:JSX,
 test:{
  projects:[
   {
    extends:true,
    esbuild:JSX,
    test:{
     name:"unit",
     environment:"node",
     include:["tests/**/*.test.ts"],
     pool:"threads",
     // Tests de lógica pura: sin aislamiento por archivo (los caches de módulo son de solo lectura y se reutilizan).
     isolate:false,
     poolOptions:{threads:{isolate:false,maxThreads:CORES,minThreads:Math.ceil(CORES/2)}},
    },
   },
   {
    extends:true,
    esbuild:JSX,
    test:{
     name:"ui",
     environment:"jsdom",
     include:["tests/**/*.test.tsx"],
     testTimeout:30_000,
     hookTimeout:30_000,
     // THREADS (no forks): los hilos comparten el servidor de Vite, así que el transform del grafo de módulos (incluidos
     // los datasets de ~1.2 MB) se hace UNA vez y se reutiliza entre archivos, en vez de re-transformarse por proceso.
     // isolate:true mantiene un registro de módulos fresco por archivo (jsdom + vi.mock por archivo), sin perder ese cache.
     pool:"threads",
     poolOptions:{threads:{isolate:true,maxThreads:CORES,minThreads:2}},
    },
   },
  ],
 },
});
