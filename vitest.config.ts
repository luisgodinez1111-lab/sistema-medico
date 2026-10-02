import{defineConfig}from"vitest/config";
// ARQUITECTURA DE PRUEBAS POR PROYECTOS (Vitest 3) — señal estable y rápida, no un parche.
//
// El suite tiene dos perfiles de recursos muy distintos y mezclarlos en un único pool hacía que, en runners ajustados, los
// pocos tests pesados saturaran la memoria y arrastraran a los demás a timeouts aleatorios (cada corrida caía en uno distinto).
// Se separan en dos PROYECTOS, cada uno con su entorno y su política de concurrencia:
//
//   • unit — los ~270 tests de LÓGICA (dominio, catálogo, folds, CDS, handlers): entorno node, paralelismo pleno. Rápidos y
//     deterministas; son el gate real de corrección.
//   • ui   — los tests de RENDER/ACCESIBILIDAD (*.test.tsx: jsdom + axe, pesados en memoria): entorno jsdom, pool acotado
//     (máx. 2 forks) y timeout holgado, para que no compitan por memoria ni se corten por un pico de carga.
//
// `vitest run` ejecuta AMBOS proyectos (misma cobertura que antes); `--project unit|ui` corre uno. El transform JSX
// automático (como Next) se declara en cada proyecto para que .ts y .tsx se compilen igual.
const JSX={jsx:"automatic" as const,jsxImportSource:"react"};
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
    },
   },
   {
    extends:true,
    esbuild:JSX,
    test:{
     name:"ui",
     environment:"jsdom",
     include:["tests/**/*.test.tsx"],
     // jsdom + axe-core son pesados: timeout holgado y concurrencia acotada para no saturar la memoria del runner.
     testTimeout:30_000,
     hookTimeout:30_000,
     pool:"forks",
     poolOptions:{forks:{maxForks:2,minForks:1}},
    },
   },
  ],
 },
});
