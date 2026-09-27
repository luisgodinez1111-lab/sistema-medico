import fs from"node:fs";import path from"node:path";import ts from"typescript";
// Lote 11 (ADR-0300) — Grafo de importaciones REAL del repositorio para las guardas de arquitectura. Se construye con el
// analizador de TypeScript (preProcessFile: import/export estáticos, `import()` dinámicos y `require`), no con expresiones
// regulares sobre el texto, y resuelve solo especificadores relativos (el repo no usa alias ni paquetes de workspace).
export const ROOT=process.cwd();
const SKIP=new Set(["node_modules",".next",".git","__snapshots__"]);
export const rel=(abs:string):string=>path.relative(ROOT,abs).split(path.sep).join("/");
export function sourceFiles(dir:string,exts:RegExp=/\.(ts|tsx|mts)$/):string[]{
 const out:string[]=[];const abs=path.join(ROOT,dir);if(!fs.existsSync(abs))return out;
 for(const e of fs.readdirSync(abs,{withFileTypes:true})){if(SKIP.has(e.name))continue;const p=path.join(dir,e.name);
  if(e.isDirectory())out.push(...sourceFiles(p,exts));else if(exts.test(e.name)&&!e.name.endsWith(".d.ts")&&!e.name.endsWith(".d.mts"))out.push(p.split(path.sep).join("/"));}
 return out;
}
const cache=new Map<string,string[]>();
export function specifiersOf(file:string):string[]{
 let s=cache.get(file);if(s)return s;
 s=ts.preProcessFile(fs.readFileSync(path.join(ROOT,file),"utf8"),true,true).importedFiles.map(f=>f.fileName);cache.set(file,s);return s;
}
const EXT=["",".ts",".tsx",".mts",".mjs",".js","/index.ts","/index.tsx"];
export function resolveRelative(from:string,spec:string):string|undefined{
 if(!spec.startsWith("."))return undefined;
 const base=path.join(ROOT,path.dirname(from),spec);
 for(const e of EXT){const c=base+e;if(fs.existsSync(c)&&fs.statSync(c).isFile())return rel(c);}
 return undefined;
}
export const edgesOf=(file:string):string[]=>specifiersOf(file).map(s=>resolveRelative(file,s)).filter((x):x is string=>!!x);
export const packageOf=(file:string):string|undefined=>/^packages\/([^/]+)\//.exec(file)?.[1];
// Componentes fuertemente conexos (Tarjan) de un grafo dirigido; devuelve solo los ciclos (tamaño > 1 o auto-arista).
export function cycles(nodes:readonly string[],next:(n:string)=>readonly string[]):string[][]{
 let i=0;const idx=new Map<string,number>(),low=new Map<string,number>(),on=new Set<string>(),st:string[]=[],out:string[][]=[];
 const visit=(v:string)=>{idx.set(v,i);low.set(v,i);i++;st.push(v);on.add(v);
  for(const w of next(v)){if(!idx.has(w)){visit(w);low.set(v,Math.min(low.get(v)!,low.get(w)!));}else if(on.has(w))low.set(v,Math.min(low.get(v)!,idx.get(w)!));}
  if(low.get(v)===idx.get(v)){const c:string[]=[];let w:string;do{w=st.pop()!;on.delete(w);c.push(w);}while(w!==v);if(c.length>1||next(v).includes(v))out.push(c.sort());}};
 for(const n of nodes)if(!idx.has(n))visit(n);
 return out;
}
// Cierre transitivo de importaciones relativas a partir de unas raíces.
export function closure(roots:readonly string[]):Set<string>{
 const seen=new Set<string>();const stack=[...roots];
 while(stack.length){const f=stack.pop()!;if(seen.has(f))continue;seen.add(f);for(const g of edgesOf(f))if(!seen.has(g))stack.push(g);}
 return seen;
}
// Usos prohibidos en código de dominio: reloj y azar implícitos, entorno y módulos de Node (el dominio es puro y determinista).
export function impurities(file:string):string[]{
 const src=fs.readFileSync(path.join(ROOT,file),"utf8");const sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true);const out:string[]=[];
 const at=(n:ts.Node)=>`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line+1}`;
 const visit=(n:ts.Node)=>{
  if(ts.isPropertyAccessExpression(n)&&n.getText()==="process.env")out.push(`${at(n)} process.env`);
  if(ts.isCallExpression(n)){const t=n.expression.getText();if(t==="Date.now"||t==="Math.random")out.push(`${at(n)} ${t}()`);}
  if(ts.isNewExpression(n)&&n.expression.getText()==="Date"&&(n.arguments?.length??0)===0)out.push(`${at(n)} new Date()`);
  ts.forEachChild(n,visit);};
 visit(sf);
 for(const s of specifiersOf(file))if(s.startsWith("node:")||s==="postgres")out.push(`${file} importa ${s}`);
 return out;
}
