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
     // Auditoría 2026-09-19, anexo R07 — UNA SUITE QUE SE PONE ROJA SEGÚN LA CARGA DE LA MÁQUINA NO INFORMA DE NADA.
     //
     // Medido el 05-oct-2026: cinco tests de UI fallaban por TIMEOUT en la suite completa y pasaban al correr su fichero
     // solo. No eran defectos de producto: son los escaneos de accesibilidad (`axe`), que recorren el árbol renderizado de
     // varias vistas y tardan ~11 s cada uno MEDIDOS EN AISLAMIENTO; con los hilos de UI compitiendo por los núcleos, pasan
     // de 30 s. Un verde que depende de si la máquina está ocupada es exactamente un gate que no se puede creer, en los dos
     // sentidos: no distingue una regresión real de una tarde con el portátil cargado.
     //
     // Se sube el límite de los tests de UI a 120 s. No es aflojar la prueba: el contenido que comprueba no cambia, y el
     // coste real de un escaneo axe sobre siete vistas es el que es. Lo que se corrige es un límite calibrado contra una
     // máquina desocupada.
     testTimeout:120_000,
     hookTimeout:120_000,
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
