import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{BRANCHES,AGGREGATE_BRANCH,VIEW_BRANCH,ROUTE_BRANCH,BRANCH_META,type Branch}from"../../packages/clinical-domains/src";
import{SIDE_NAV,TOOLS_NAV}from"../../apps/web/app/workspace/shared";
// GUARD DE ARQUITECTURA — las 3 ramas (Consultas / Expedientes / Laboratorios y Diagnósticos) + Sistema son
// ESTRUCTURA VERIFICADA, no una convención. `packages/clinical-domains` es la FUENTE ÚNICA de a qué rama
// pertenece cada agregado, vista y grupo de rutas; este test falla si el repo y ese mapa se separan: un agregado
// nuevo sin asignar, una vista fuera del mapa, una ruta sin rama, o la navegación agrupada de otra forma. Así la
// centralización que pidió el dueño no se degrada con el tiempo: mover algo de rama obliga a editar la fuente única.
const LIB="apps/web/lib";
const V1="apps/web/app/api/v1";
const MODEL="apps/web/app/workspace/model.tsx";
const BSET=new Set<Branch>(BRANCHES);

// Agregados reales del repo = el `aggregateType` que cada *-lifecycle.ts declara (constante AGG, o el primer
// `aggregateType:"…"` inline cuando no hay AGG, como en encounter-lifecycle).
function discoverAggregates():Set<string>{
 const out=new Set<string>();
 for(const f of fs.readdirSync(LIB).filter(n=>n.endsWith("-lifecycle.ts"))){
  const src=fs.readFileSync(path.join(LIB,f),"utf8");
  const ca=src.match(/const AGG\s*=\s*"([^"]+)"/);
  const inline=src.match(/aggregateType:\s*"([^"]+)"/);
  const agg=ca?.[1]??inline?.[1];
  expect(agg,`no pude extraer el aggregateType de ${f}`).toBeTruthy();
  out.add(agg!);
 }
 return out;
}
// Universo de vistas = el union de `view` en model.tsx (fuente de verdad del estado del workspace).
function discoverViews():Set<string>{
 const src=fs.readFileSync(MODEL,"utf8");
 const decl=src.match(/const\[view,setView\]=useState<([^>]*)>/);
 expect(decl,"no encontré el union de `view` en model.tsx").toBeTruthy();
 return new Set([...decl![1]!.matchAll(/"([^"]+)"/g)].map(m=>m[1]!));
}
function discoverRouteGroups():Set<string>{
 return new Set(fs.readdirSync(V1,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name));
}
const sorted=(s:Iterable<string>)=>[...s].sort();

describe("las 3 ramas son estructura verificada (fuente única: packages/clinical-domains)",()=>{
 it("todo valor de rama en los mapas es una rama válida",()=>{
  for(const[map,name]of[[AGGREGATE_BRANCH,"AGGREGATE_BRANCH"],[VIEW_BRANCH,"VIEW_BRANCH"],[ROUTE_BRANCH,"ROUTE_BRANCH"]]as const)
   for(const[k,v]of Object.entries(map))expect(BSET.has(v),`${name}["${k}"]="${v}" no es una rama válida`).toBe(true);
 });

 it("cada agregado del repo tiene rama, y el mapa no tiene agregados fantasma",()=>{
  const real=discoverAggregates();
  const mapped=new Set(Object.keys(AGGREGATE_BRANCH));
  const sinRama=sorted([...real].filter(a=>!mapped.has(a)));
  const fantasma=sorted([...mapped].filter(a=>!real.has(a)));
  expect(sinRama,`agregados SIN rama en AGGREGATE_BRANCH: ${sinRama.join(", ")}`).toEqual([]);
  expect(fantasma,`claves de AGGREGATE_BRANCH que ya no existen como agregado: ${fantasma.join(", ")}`).toEqual([]);
 });

 it("el mapa de vistas es exactamente el union de `view` de model.tsx",()=>{
  const real=discoverViews();
  const mapped=new Set(Object.keys(VIEW_BRANCH));
  expect(sorted(mapped),"VIEW_BRANCH debe cubrir exactamente las vistas de model.tsx").toEqual(sorted(real));
 });

 it("cada grupo de rutas /api/v1/* tiene rama, y el mapa no tiene rutas fantasma",()=>{
  const real=discoverRouteGroups();
  const mapped=new Set(Object.keys(ROUTE_BRANCH));
  const sinRama=sorted([...real].filter(r=>!mapped.has(r)));
  const fantasma=sorted([...mapped].filter(r=>!real.has(r)));
  expect(sinRama,`grupos de ruta SIN rama en ROUTE_BRANCH: ${sinRama.join(", ")}`).toEqual([]);
  expect(fantasma,`claves de ROUTE_BRANCH que ya no existen como ruta: ${fantasma.join(", ")}`).toEqual([]);
 });

 it("ninguna rama clínica queda vacía (las 3 + Sistema tienen agregados y vistas)",()=>{
  for(const b of BRANCHES){
   expect(Object.values(AGGREGATE_BRANCH).includes(b),`la rama ${b} no tiene ningún agregado`).toBe(true);
   expect(Object.values(VIEW_BRANCH).includes(b),`la rama ${b} no tiene ninguna vista`).toBe(true);
  }
 });
});

describe("la navegación concuerda con la fuente única (SIDE_NAV + TOOLS_NAV)",()=>{
 const navViews=[...SIDE_NAV.map(i=>i.view),...TOOLS_NAV.map(i=>i.view)];

 it("cada ítem de navegación apunta a una vista con rama; entre todos cubren todas las vistas",()=>{
  for(const v of navViews)expect(VIEW_BRANCH[v],`la navegación apunta a la vista "${v}" sin rama en VIEW_BRANCH`).toBeTruthy();
  expect(sorted(new Set(navViews)),"SIDE_NAV+TOOLS_NAV debe cubrir exactamente las vistas mapeadas").toEqual(sorted(new Set(Object.keys(VIEW_BRANCH))));
 });

 it("una vista no aparece dos veces en la navegación",()=>{
  const dup=navViews.filter((v,i)=>navViews.indexOf(v)!==i);
  expect(dup,`vistas duplicadas en la navegación: ${dup.join(", ")}`).toEqual([]);
 });

 it("los ítems de SIDE_NAV van agrupados por rama y en el orden de BRANCH_META (ninguna rama se parte en dos bloques)",()=>{
  // La portada (home) va arriba sin sección; el resto se pinta por bloques contiguos de rama.
  const seq=SIDE_NAV.filter(i=>!i.home).map(i=>VIEW_BRANCH[i.view]!);
  const blocks:Branch[]=[];
  for(const b of seq)if(blocks[blocks.length-1]!==b)blocks.push(b);
  // Cada rama debe aparecer como UN solo bloque (sin repetirse → sin partirse).
  expect(blocks.length,`una rama se parte en bloques no contiguos: ${blocks.join(" → ")}`).toBe(new Set(blocks).size);
  // Y los bloques respetan el orden declarado en BRANCH_META.
  const orders=blocks.map(b=>BRANCH_META[b].order);
  expect(orders,`el orden de las secciones no sigue BRANCH_META: ${blocks.join(" → ")}`).toEqual([...orders].sort((a,b)=>a-b));
 });
});

// ARCHITECTURE FITNESS FUNCTION (arquitectura evolutiva) — mantiene la estructura MÍNIMA: las ramas clínicas no se
// acoplan entre sí; solo pueden depender de `transversal` (el kernel compartido: identidad/perfil, facturación,
// ajustes). Medido hoy: 3 imports cruzados, todos → physician-profile (transversal) = legítimo. Un import NUEVO de una
// rama clínica a otra rompe el build y obliga a una decisión explícita (desacoplar o declarar la excepción).
const CLINICAL=new Set<Branch>(["consultas","expedientes","laboratorios-diagnosticos"]);
function lifecycleFiles():string[]{return fs.readdirSync(LIB).filter(f=>f.endsWith("-lifecycle.ts"));}
function branchOfFile(file:string):Branch|undefined{
 const s=fs.readFileSync(path.join(LIB,file),"utf8");
 const m=s.match(/const AGG\s*=\s*"([^"]+)"/)??s.match(/aggregateType:\s*"([^"]+)"/);
 return m?AGGREGATE_BRANCH[m[1]!]:undefined;
}
function lifecycleDeps(file:string):string[]{
 const s=fs.readFileSync(path.join(LIB,file),"utf8");const files=new Set(lifecycleFiles());
 return [...s.matchAll(/from"\.\/([a-z0-9-]+-lifecycle)"/g)].map(m=>m[1]!+".ts").filter(d=>files.has(d));
}
// Dependencias cruzadas entre ramas CLÍNICAS expresamente permitidas (hoy ninguna). Añadir aquí es una decisión visible.
const ALLOWED_CROSS_CLINICAL:ReadonlySet<string>=new Set<string>([]);

describe("fitness function de dependencias entre ramas (bounded contexts, arquitectura mínima)",()=>{
 it("ninguna rama CLÍNICA importa el ciclo de vida de OTRA rama clínica (solo puede depender de transversal)",()=>{
  const bad:string[]=[];
  for(const f of lifecycleFiles()){
   const bf=branchOfFile(f);if(!bf||!CLINICAL.has(bf))continue;
   for(const dep of lifecycleDeps(f)){
    const bd=branchOfFile(dep);
    if(bd&&CLINICAL.has(bd)&&bd!==bf&&!ALLOWED_CROSS_CLINICAL.has(`${f}->${dep}`))bad.push(`${f} (${bf}) → ${dep} (${bd})`);
   }
  }
  expect(bad,`acoplamiento cruzado entre ramas clínicas (desacopla vía transversal o declara la excepción): ${bad.join("; ")}`).toEqual([]);
 });
 it("transversal es el KERNEL compartido: no depende de una rama clínica (evita ciclos de dependencia)",()=>{
  const bad:string[]=[];
  for(const f of lifecycleFiles()){
   if(branchOfFile(f)!=="transversal")continue;
   for(const dep of lifecycleDeps(f)){const bd=branchOfFile(dep);if(bd&&CLINICAL.has(bd))bad.push(`${f} (transversal) → ${dep} (${bd})`);}
  }
  expect(bad,`el kernel transversal no debe depender de una rama clínica: ${bad.join("; ")}`).toEqual([]);
 });
});
