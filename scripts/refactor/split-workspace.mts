// Codemod de UN SOLO USO (auditoría K-09 / punto 1 del pendiente): parte apps/web/app/workspace/page.tsx (5.000+ líneas, un
// componente con ~300 declaraciones y 22 vistas en una cadena ternaria) en:
//   workspace/shared.tsx    — helpers, estilos, tipos y constantes de módulo (exportados)
//   workspace/model.tsx     — useWorkspaceModel(): TODOS los hooks y handlers, en el mismo orden; deriveHeader()
//   workspace/context.tsx   — WorkspaceProvider / useWorkspace()
//   workspace/views/*.tsx   — un componente por vista, que toma del contexto SOLO lo que usa
//   workspace/page.tsx      — orquestador: modelo + retornos tempranos + layout + <ViewSwitch/>
// Trabaja sobre el AST (compilador de TypeScript) y conserva el texto original de cada bloque: no reformatea ni reescribe
// lógica. Los identificadores libres de cada bloque se resuelven contra el modelo, los helpers de módulo y los imports.
// Se ejecuta una vez y se verifica con typecheck + suite de UI + build; después el fichero queda como registro del método.
import fs from"node:fs";import path from"node:path";
import ts from"typescript";
const ROOT=process.cwd();const DIR=path.join(ROOT,"apps/web/app/workspace");const PAGE=path.join(DIR,"page.tsx");
const src=fs.readFileSync(PAGE,"utf8");
// Programa REAL (tsconfig de apps/web) para resolver cada identificador a su declaración con el checker: sin heurísticas de ámbito.
const cfgPath=path.join(ROOT,"apps/web/tsconfig.json");const cfg=ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath,ts.sys.readFile).config,ts.sys,path.dirname(cfgPath));
const program=ts.createProgram({rootNames:[PAGE],options:cfg.options});const checker=program.getTypeChecker();
const sf=program.getSourceFile(PAGE)!;
const text=(n:ts.Node)=>src.slice(n.getStart(sf),n.getEnd());
const fullText=(n:ts.Node)=>src.slice(n.getFullStart(),n.getEnd()); // con comentarios previos
// ---------- 1) partes del módulo ----------
const imports:ts.ImportDeclaration[]=[];const moduleStmts:ts.Statement[]=[];let workspace:ts.FunctionDeclaration|undefined;
for(const st of sf.statements){
 if(ts.isImportDeclaration(st))imports.push(st);
 else if(ts.isFunctionDeclaration(st)&&st.name?.text==="Workspace")workspace=st;
 else if(ts.isExpressionStatement(st)&&ts.isStringLiteral(st.expression))continue; // "use client"
 else moduleStmts.push(st);
}
if(!workspace?.body)throw new Error("Workspace no encontrado");
// nombres declarados por una lista de sentencias (const/let/function/type/interface/class)
function declaredNames(stmts:readonly ts.Statement[]):{values:Set<string>;types:Set<string>}{
 const values=new Set<string>(),types=new Set<string>();
 const bind=(n:ts.BindingName)=>{if(ts.isIdentifier(n))values.add(n.text);else for(const e of n.elements){if(ts.isBindingElement(e))bind(e.name);}};
 for(const s of stmts){
  if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)bind(d.name);
  else if(ts.isFunctionDeclaration(s)&&s.name)values.add(s.name.text);
  else if(ts.isClassDeclaration(s)&&s.name)values.add(s.name.text);
  else if(ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s))types.add(s.name.text);
  else if(ts.isEnumDeclaration(s))values.add(s.name.text);
 }
 return{values,types};
}
// los tipos declarados dentro de Workspace se hoistean a shared.tsx (un tipo no depende del estado)
const moduleNames=declaredNames(moduleStmts);
// nombres importados (valores y tipos) con su declaración de import
const importedValue=new Map<string,ts.ImportDeclaration>(),importedType=new Map<string,ts.ImportDeclaration>();
for(const im of imports){const c=im.importClause;if(!c)continue;
 if(c.name)(c.isTypeOnly?importedType:importedValue).set(c.name.text,im);
 if(c.namedBindings&&ts.isNamedImports(c.namedBindings))for(const el of c.namedBindings.elements){const local=el.name.text;((c.isTypeOnly||el.isTypeOnly)?importedType:importedValue).set(local,im);if(!c.isTypeOnly&&!el.isTypeOnly)importedType.set(local,im);}
 if(c.namedBindings&&ts.isNamespaceImport(c.namedBindings))importedValue.set(c.namedBindings.name.text,im);
}
// ---------- 2) cuerpo de Workspace: hooks | retornos tempranos + derivados | return principal ----------
const body=workspace.body.statements;
let firstEarly=-1,mainReturn=-1;
body.forEach((s,i)=>{if(firstEarly<0&&ts.isIfStatement(s)&&/^if\(!ready\)/.test(text(s)))firstEarly=i;if(ts.isReturnStatement(s))mainReturn=i;});
if(firstEarly<0||mainReturn<0)throw new Error("estructura inesperada");
const hookAll=body.slice(0,firstEarly);
const hookTypeStmts=hookAll.filter(s=>ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s));
const hookStmts=hookAll.filter(s=>!(ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s)));
const earlyStmts=body.filter((s,i)=>i>=firstEarly&&i<mainReturn&&ts.isIfStatement(s));
const derivedStmts=body.filter((s,i)=>i>=firstEarly&&i<mainReturn&&!ts.isIfStatement(s));
const ret=body[mainReturn] as ts.ReturnStatement;
const modelNames=declaredNames(hookStmts).values;const derivedNames=declaredNames(derivedStmts).values;
// ---------- 3) la cadena de vistas ----------
type View={key:string;bodyText:string;node:ts.Node};
const views:View[]=[];let chainExpr:ts.JsxExpression|undefined;
function findChain(n:ts.Node){if(chainExpr)return;if(ts.isJsxExpression(n)&&n.expression&&ts.isConditionalExpression(n.expression)&&/^view===/.test(text(n.expression.condition)))chainExpr=n;else ts.forEachChild(n,findChain);}
findChain(ret);if(!chainExpr?.expression)throw new Error("cadena de vistas no encontrada");
let cur:ts.Expression=chainExpr.expression;
while(ts.isConditionalExpression(cur)){
 const m=/^view==="([A-Za-z0-9_]+)"$/.exec(text(cur.condition));if(!m)throw new Error("condición inesperada: "+text(cur.condition));
 const wt=cur.whenTrue;// (()=>{ ... })()
 if(!(ts.isCallExpression(wt)&&ts.isParenthesizedExpression(wt.expression)&&ts.isArrowFunction(wt.expression.expression)&&wt.expression.expression.body&&ts.isBlock(wt.expression.expression.body)))throw new Error("vista sin IIFE: "+m[1]);
 const block=wt.expression.expression.body;
 views.push({key:m[1]!,bodyText:src.slice(block.getStart(sf)+1,block.getEnd()-1),node:block});
 cur=cur.whenFalse;
}
// último: (<>...</>)
const last=ts.isParenthesizedExpression(cur)?cur.expression:cur;
views.push({key:"exp",bodyText:"\n return "+text(last)+";\n",node:last});
// ---------- 4) identificadores libres ----------
// Clasificación de un identificador por dónde está declarado su símbolo: dentro del bloque analizado (local), en el cuerpo de
// Workspace (bag), en el módulo page.tsx (shared), en un import (imported) o fuera del fichero (global/lib).
type Ref={values:Set<string>;types:Set<string>};
function analyze(node:ts.Node,_extra?:Set<string>,skip?:ts.Node):Ref{
 const values=new Set<string>(),types=new Set<string>();
 const inside=(d:ts.Node)=>d.getSourceFile()===sf&&d.getStart(sf)>=node.getStart(sf)&&d.getEnd()<=node.getEnd();
 function visit(n:ts.Node){
  if(skip&&n===skip)return; // p. ej. la cadena de vistas, que ya no vive en el layout
  if(ts.isIdentifier(n)){
   const p=n.parent;
   if(ts.isPropertyAccessExpression(p)&&p.name===n)return;
   if(ts.isPropertyAssignment(p)&&p.name===n)return;
   if(ts.isJsxAttribute(p)&&p.name===n)return;
   if(ts.isBindingElement(p)&&p.propertyName===n)return;
   if(ts.isQualifiedName(p)&&p.right===n)return;
   if((ts.isJsxOpeningElement(p)||ts.isJsxSelfClosingElement(p)||ts.isJsxClosingElement(p))&&/^[a-z]/.test(n.text))return;
   let sym=checker.getSymbolAtLocation(n);
   if(!sym)return;
   if(sym.flags&ts.SymbolFlags.Alias)sym=checker.getAliasedSymbol(sym)??sym;
   const decls=(checker.getSymbolAtLocation(n)?.declarations)??sym.declarations??[];
   if(decls.length===0)return;
   const d=decls[0]!;
   if(inside(d))return; // declarado dentro del bloque
   if(d.getSourceFile()!==sf&&!ts.isImportSpecifier(d)&&!ts.isImportClause(d)&&!ts.isNamespaceImport(d))return; // lib/global
   const isType=(sym.flags&(ts.SymbolFlags.Type|ts.SymbolFlags.Interface|ts.SymbolFlags.TypeAlias))!==0&&!(sym.flags&ts.SymbolFlags.Value);
   const isTypePosition=ts.isTypeReferenceNode(p)||ts.isTypeQueryNode(p)||ts.isExpressionWithTypeArguments(p)||(ts.isQualifiedName(p)&&p.left===n);
   if(isType||isTypePosition)types.add(n.text);else values.add(n.text);
   return;
  }
  ts.forEachChild(n,visit);
 }
 visit(node);
 return{values,types};
}
function importsFor(values:Set<string>,types:Set<string>,depth=0):string{
 const respec=(m:string)=>{const q=m[0]!;const s=m.slice(1,-1);if(depth===0||!s.startsWith("."))return m;return q+"../".repeat(depth)+s.replace(/^\.\//,"")+q;};
 const byDecl=new Map<ts.ImportDeclaration,{v:Set<string>;t:Set<string>}>();
 for(const v of values){const d=importedValue.get(v);if(d){if(!byDecl.has(d))byDecl.set(d,{v:new Set(),t:new Set()});byDecl.get(d)!.v.add(v);}}
 for(const t of types){const d=importedType.get(t)??importedValue.get(t);if(d){if(!byDecl.has(d))byDecl.set(d,{v:new Set(),t:new Set()});if(!byDecl.get(d)!.v.has(t))byDecl.get(d)!.t.add(t);}}
 const out:string[]=[];
 for(const[d,{v,t}]of byDecl){
  const c=d.importClause!;const mod=respec(text(d.moduleSpecifier));
  const parts:string[]=[];
  if(c.name&&(v.has(c.name.text)||t.has(c.name.text)))parts.push(c.name.text);
  const named:string[]=[];
  if(c.namedBindings&&ts.isNamedImports(c.namedBindings))for(const el of c.namedBindings.elements){const local=el.name.text;const orig=el.propertyName?el.propertyName.text:local;
   if(v.has(local))named.push(el.propertyName?`${orig} as ${local}`:local);else if(t.has(local))named.push(`type ${el.propertyName?`${orig} as ${local}`:local}`);}
  if(c.namedBindings&&ts.isNamespaceImport(c.namedBindings)&&v.has(c.namedBindings.name.text))parts.push(`* as ${c.namedBindings.name.text}`);
  if(named.length)parts.push(`{${named.join(",")}}`);
  if(parts.length)out.push(`import ${parts.join(",")} from ${mod};`);
 }
 return out.join("\n");
}
const rel=(from:string)=>{let r=path.relative(from,path.join(ROOT,"apps/web/app/workspace")).split(path.sep).join("/");return r===""?".":r;};
// ---------- 5) shared.tsx ----------
function exportStmt(s:ts.Statement):string{
 const t=fullText(s);
 if(ts.isVariableStatement(s)||ts.isFunctionDeclaration(s)||ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s)||ts.isClassDeclaration(s)||ts.isEnumDeclaration(s)){
  if(s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))return t;
  const start=s.getStart(sf)-s.getFullStart();return t.slice(0,start)+"export "+t.slice(start);
 }
 return t;
}
for(const s of hookTypeStmts){if(ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s))moduleNames.types.add(s.name.text);}
const sharedVals=new Set<string>(),sharedTypes=new Set<string>();for(const s of[...moduleStmts,...hookTypeStmts]){const a=analyze(s);a.values.forEach(x=>sharedVals.add(x));a.types.forEach(x=>sharedTypes.add(x));}
const sharedSrc=`// GENERADO por scripts/refactor/split-workspace.mts (partición de page.tsx, K-09). Helpers, estilos, tipos y constantes
// de módulo del workspace, exportados para las vistas. El contenido es el original de page.tsx sin cambios.
${importsFor(sharedVals,sharedTypes)}
${moduleStmts.map(exportStmt).join("")}
// Tipos que estaban declarados dentro del componente Workspace (hoisteados: un tipo no depende del estado).
${hookTypeStmts.map(exportStmt).join("")}
`;
// ---------- 6) model.tsx ----------
const hookBody=hookStmts.map(fullText).join("");
const hookUse={values:new Set<string>(),types:new Set<string>()};for(const s of hookStmts){const a=analyze(s,modelNames);a.values.forEach(x=>hookUse.values.add(x));a.types.forEach(x=>hookUse.types.add(x));}
const derivedUse={values:new Set<string>(),types:new Set<string>()};for(const s of derivedStmts){const a=analyze(s,derivedNames);a.values.forEach(x=>derivedUse.values.add(x));a.types.forEach(x=>derivedUse.types.add(x));}
const fromShared=(vals:Set<string>,types:Set<string>)=>{const v=[...vals].filter(x=>moduleNames.values.has(x)),t=[...types].filter(x=>moduleNames.types.has(x)||moduleNames.values.has(x));const names=[...v,...t.filter(x=>!v.includes(x)).map(x=>`type ${x}`)];return names.length?`import{${names.join(",")}}from"./shared";`:"";};
const derivedFromModel=[...derivedUse.values].filter(x=>modelNames.has(x));
const modelSrc=`"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09). Modelo del workspace: TODOS los hooks y handlers que vivían en
// el componente Workspace, en el MISMO orden (los hooks se llaman una vez por render, como antes). El contenido de las
// funciones es el original. \`deriveHeader\` son los valores derivados que el layout y las vistas comparten.
${importsFor(new Set([...hookUse.values,...derivedUse.values]),new Set([...hookUse.types,...derivedUse.types,"MedicalSession"]))}
${fromShared(new Set([...hookUse.values,...derivedUse.values]),new Set([...hookUse.types,...derivedUse.types]))}
export function useWorkspaceModel(){
${hookBody}
 return{${[...modelNames].join(",")}};
}
export type WorkspaceModel=ReturnType<typeof useWorkspaceModel>;
// Valores derivados tras los retornos tempranos (sesión garantizada).
export function deriveHeader(m:Omit<WorkspaceModel,"session">&{session:MedicalSession}){
 const{${derivedFromModel.join(",")}}=m;
${derivedStmts.map(fullText).join("")}
 return{${[...derivedNames].join(",")}};
}
export type WorkspaceBag=WorkspaceModel&ReturnType<typeof deriveHeader>;
`;
// ---------- 7) context.tsx ----------
const contextSrc=`"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09). Contexto del workspace: el modelo (hooks + handlers) y los
// derivados del encabezado, disponibles para cada vista. Solo se monta la vista activa; cada una toma lo que usa.
import{createContext,useContext}from"react";
import type{WorkspaceBag}from"./model";
const Ctx=createContext<WorkspaceBag|null>(null);
export function WorkspaceProvider({value,children}:{value:WorkspaceBag;children:React.ReactNode}){return <Ctx.Provider value={value}>{children}</Ctx.Provider>;}
export function useWorkspace():WorkspaceBag{const v=useContext(Ctx);if(!v)throw new Error("useWorkspace fuera de WorkspaceProvider");return v;}
`;
// ---------- 8) vistas ----------
const bagNames=new Set([...modelNames,...derivedNames]);
const viewFiles:{key:string;comp:string;file:string}[]=[];
fs.mkdirSync(path.join(DIR,"views"),{recursive:true});
for(const v of views){
 const a=analyze(v.node);
 const fromBag=[...a.values].filter(x=>bagNames.has(x));
 const comp=v.key[0]!.toUpperCase()+v.key.slice(1)+"View";
 const file=`views/${v.key}.tsx`;
 const sharedImp=fromShared(new Set([...a.values].filter(x=>!bagNames.has(x))),a.types);
 const ext=importsFor(new Set([...a.values].filter(x=>!bagNames.has(x)&&!moduleNames.values.has(x))),new Set([...a.types].filter(x=>!moduleNames.types.has(x)&&!moduleNames.values.has(x))),1);
 const out=`"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "${v.key}" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
${ext}
${sharedImp.replace('from"./shared"','from"../shared"')}
import{useWorkspace}from"../context";
export default function ${comp}(){
 const{${fromBag.join(",")}}=useWorkspace();
${v.bodyText}
}
`;
 fs.writeFileSync(path.join(DIR,file),out);viewFiles.push({key:v.key,comp,file});
}
// ---------- 9) page.tsx ----------
const layoutSrcText=text(ret.expression!);
const chainText=text(chainExpr);
const layoutWithSwitch=layoutSrcText.replace(chainText,"{<ViewSwitch/>}");
if(layoutWithSwitch===layoutSrcText)throw new Error("no se pudo sustituir la cadena de vistas");
const layoutNode=ret.expression!;
const layoutUse=analyze(layoutNode,undefined,chainExpr);
const pageBagUse=[...layoutUse.values].filter(x=>bagNames.has(x));
const earlyUse=new Set<string>();for(const s of earlyStmts){analyze(s).values.forEach(x=>earlyUse.add(x));}
const pageVals=new Set([...layoutUse.values,...earlyUse]);const pageTypes=new Set(layoutUse.types);
const pageSrc=`"use client";
// EPIC K — Espacio de trabajo clínico (orquestador). Auditoría K-09 / partición de page.tsx (2026-09-22): el estado y los
// handlers viven en ./model (useWorkspaceModel, mismo orden de hooks), los helpers en ./shared y cada vista en ./views/*.
// Este fichero conserva los retornos tempranos, el layout (barra, rail, encabezado del paciente) y el conmutador de vistas.
${importsFor(new Set([...pageVals].filter(x=>!bagNames.has(x)&&!moduleNames.values.has(x))),new Set([...pageTypes].filter(x=>!moduleNames.types.has(x)&&!moduleNames.values.has(x))))}
${fromShared(new Set([...pageVals].filter(x=>!bagNames.has(x))),pageTypes)}
import{useWorkspaceModel,deriveHeader}from"./model";
import{WorkspaceProvider,useWorkspace}from"./context";
${viewFiles.map(v=>`import ${v.comp} from"./${v.file.replace(/\.tsx$/,"")}";`).join("\n")}
const VIEWS:Record<string,React.ComponentType>={${viewFiles.filter(v=>v.key!=="exp").map(v=>`${v.key}:${v.comp}`).join(",")}};
function ViewSwitch(){const{view}=useWorkspace();const V=VIEWS[view]??ExpView;return <V/>;}
export default function Workspace(){
 const m=useWorkspaceModel();
 const{${[...new Set([...earlyUse,...pageBagUse].filter(x=>modelNames.has(x)))].join(",")}}=m;
${earlyStmts.map(fullText).join("")}
 const d=deriveHeader({...m,session});
 const{${[...pageBagUse].filter(x=>derivedNames.has(x)).join(",")}}=d;
 const bag={...m,...d};
 return <WorkspaceProvider value={bag}>${layoutWithSwitch}</WorkspaceProvider>;
}
`;
fs.writeFileSync(path.join(DIR,"shared.tsx"),sharedSrc);
fs.writeFileSync(path.join(DIR,"model.tsx"),modelSrc);
fs.writeFileSync(path.join(DIR,"context.tsx"),contextSrc);
fs.writeFileSync(PAGE,pageSrc);
console.log(JSON.stringify({views:viewFiles.map(v=>v.key),model:modelNames.size,derived:derivedNames.size,shared:moduleStmts.length,hookLines:hookBody.split("\n").length}));
