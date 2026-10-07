import{describe,it,expect}from"vitest";
import fs from"node:fs";
import path from"node:path";
import{execFileSync}from"node:child_process";
// Auditoría 2026-09-19, anexo R09 (R09-003 y R09-004) — LOS ADR ERAN PLANTILLAS, Y LA SERIE EMPEZABA EN 0011.
//
// DOS HALLAZGOS, UN MISMO DEFECTO DE GOBIERNO:
//   · R09-003: «24 de 25 ADRs son plantillas de 3-7 líneas sin fecha/autor/opciones». Remedido: 22 de 33 seguían por
//     debajo de 15 líneas, tres de ellos con 4. Una decisión sin fecha, sin decisor y sin alternativas descartadas no es
//     una decisión registrada: es una descripción de lo que ya se hizo.
//   · R09-004: ADR-0000 a ADR-0010 nunca se crearon y la numeración empieza en 0011, un salto silencioso.
//
// LO QUE ESTE TEST PROTEGE, Y LO QUE DELIBERADAMENTE NO EXIGE. Exige que cada ADR declare su fecha, su decisor y sus
// alternativas, **y acepta «no consta» como valor válido** — porque para 25 ADR heredados eso es la VERDAD, y escribir un
// nombre probable sería fabricar un registro de gobierno: el defecto que esta auditoría persigue en la tabla de firmas C5
// vacía (R09-020) y en `Mapping_Adjudication.csv` con cero filas (R09-023). Un registro falso es peor que uno ausente,
// porque el ausente se ve. Lo que el test NO permite es que un ADR nuevo nazca sin encabezado, ni que la fecha derivada de
// git deje de coincidir con git.
const DIR="docs/adr";
const adrs=():string[]=>fs.readdirSync(DIR).filter(f=>f.endsWith(".md")).sort();
const leer=(f:string):string=>fs.readFileSync(path.join(DIR,f),"utf8");
/** Fecha en que el fichero ENTRÓ al repositorio, según git. Es lo único verificable: no es la fecha de la decisión. */
const fechaDeGit=(f:string):string=>
 execFileSync("git",["log","--diff-filter=A","--format=%ad","--date=short","-1","--",path.join(DIR,f)],{encoding:"utf8"}).trim();

describe("Gobierno de los ADR (R09-003, R09-004)",()=>{

 it("el hueco de numeración está EXPLICADO, no rellenado con decisiones inventadas",()=>{
  const lista=adrs();
  // ADR-0000 existe y es el índice: quien abra la carpeta encuentra primero la explicación, no un salto.
  const cero=lista.find(f=>f.startsWith("ADR-0000"));
  expect(cero,"R09-004 pedía un ADR-0000 que remitiera al rastro real").toBeDefined();
  const m=leer(cero!);
  expect(m,"el ADR-0000 debe remitir a donde SÍ está el rastro de las decisiones fundacionales").toContain("SPEC_INDEX");
  // Y debe decir que el hueco no se rellena: once ADR retroactivos serían un rastro de gobierno falso.
  expect(m).toMatch(/se explica, no se rellena/);
  expect(m,"debe declarar que 0001–0010 no se reciclan").toMatch(/0001[–-]0010/);
  // La prueba de fuego: los números 0001–0010 siguen SIN usar. Si alguien los rellena, el ADR-0000 pasa a mentir.
  const rellenados=lista.filter(f=>/^ADR-00(0[1-9]|10)-/.test(f));
  expect(rellenados,"0001–0010 deben quedar sin usar: reutilizarlos haría creer que la serie está completa").toEqual([]);
 });

 it("cada ADR declara fecha, decisor y alternativas — y «no consta» es una respuesta válida",()=>{
  const sinFecha:string[]=[];const sinDecisor:string[]=[];const sinAlternativas:string[]=[];
  for(const f of adrs()){
   const s=leer(f);
   // Se acepta cualquiera de las dos formas: el encabezado derivado de los heredados, o el `Status: X (fecha)` + Contexto
   // de los escritos durante la remediación. Lo que no se acepta es que no haya ninguna.
   const tieneFecha=/Fecha de incorporación al repositorio|\*\*Fecha:\*\*|Status:.*\(\d{4}-\d{2}-\d{2}\)/.test(s);
   const tieneDecisor=/\*\*Decidido por:\*\*|\*\*Escrito por:\*\*|auditoría [A-Z]?\d|Status: PROPUESTO/.test(s);
   const tieneAlternativas=/\*\*Alternativas consideradas:\*\*|## Alternativas|Alternativas\b/.test(s);
   if(!tieneFecha)sinFecha.push(f);
   if(!tieneDecisor)sinDecisor.push(f);
   if(!tieneAlternativas)sinAlternativas.push(f);
  }
  expect(sinFecha,"ADR sin fecha: ni la de la decisión ni la de incorporación al repositorio").toEqual([]);
  expect(sinDecisor,"ADR sin decisor declarado («no consta» vale, un nombre inventado no)").toEqual([]);
  expect(sinAlternativas,"ADR sin alternativas: una decisión sin alternativas descartadas es una descripción").toEqual([]);
 });

 it("la fecha derivada de git es la de git, no una copia que pueda divergir",()=>{
  // Si alguien edita la fecha a mano, deja de ser evidencia verificable y pasa a ser una afirmación. Se comprueba contra
  // el historial de cada fichero que declara haberla derivado.
  const mentirosos:string[]=[];
  for(const f of adrs()){
   const s=leer(f);
   const m=/\*\*Fecha de incorporación al repositorio:\*\* (\d{4}-\d{2}-\d{2})/.exec(s);
   if(!m)continue;
   const real=fechaDeGit(f);
   // Un fichero sin commit de alta todavía (recién creado, sin confirmar) no se puede medir: se omite en vez de fallar.
   if(real===""){continue;}
   if(m[1]!==real)mentirosos.push(`${f}: dice ${m[1]}, git dice ${real}`);
  }
  expect(mentirosos,"la fecha declarada tiene que ser la del historial").toEqual([]);
 });

 it("ningún ADR heredado se atribuye un decisor que el repositorio no registra",()=>{
  // La mitad que importa: el test podría «pasarse» escribiendo un nombre en los 25 heredados. Esto lo impide — los que
  // declaran fecha DERIVADA de git son precisamente los que no tienen decisor registrado, y deben decirlo.
  const falsos:string[]=[];
  for(const f of adrs()){
   const s=leer(f);
   if(!s.includes("Fecha de incorporación al repositorio"))continue;
   if(!/\*\*Decidido por:\*\* \*\*no consta\.\*\*/.test(s))
    falsos.push(`${f}: declara un decisor para una decisión cuya fecha ni siquiera consta`);
  }
  expect(falsos,"un decisor inventado es peor que un decisor ausente: el ausente se ve").toEqual([]);
 });

 it("el encabezado dice POR QUÉ no se reconstruyó, para que nadie lo «complete» de memoria más adelante",()=>{
  // Sin la razón escrita, el siguiente que pase por aquí rellenaría los huecos con lo que le parezca razonable.
  const heredados=adrs().filter(f=>leer(f).includes("Fecha de incorporación al repositorio"));
  expect(heredados.length,"los ADR heredados deben llevar el encabezado derivado").toBeGreaterThanOrEqual(20);
  for(const f of heredados){
   const s=leer(f);
   expect(s,`${f} no explica por qué no se reconstruyó`).toMatch(/nada se reconstruye de memoria/);
   expect(s,`${f} no distingue la fecha del commit de la de la decisión`).toMatch(/No es la fecha de la\s*>?\s*decisión/);
  }
 });
});
