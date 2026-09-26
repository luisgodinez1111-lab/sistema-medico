// Monografías de sustancias (fuente real: Vademecum, país-agnóstica) — SEPARADO de index.ts a propósito: este módulo trae
// ~1.2 MB de datos y solo debe cargarse donde se muestran las monografías (la vista Medicamentos, que es lazy). El catálogo
// de SEGURIDAD (alergia/renal/interacciones) sigue en index.ts, curado y autoritativo; esto es información de referencia.
import{DRUG_MONOGRAPHS_TSV}from"./monographs-data";
export type DrugMonograph=Readonly<{
 key:string;name:string;action:string;indications:string;contraindications:string;
 precautions:string;interactions:string;adverse:string;
}>;
/** Normaliza un nombre de sustancia a la clave de emparejado: minúsculas, sin acentos, espacios colapsados. */
export function normDrug(s:string):string{
 return s.normalize("NFKD").replace(/[\u0300-\u036f]/gu,"").toLowerCase().replace(/\s+/g," ").trim();
}
type Row=DrugMonograph&{blob:string};
let LIST:Row[]|null=null;
function parse():Row[]{
 if(LIST)return LIST;
 LIST=[];
 for(const line of DRUG_MONOGRAPHS_TSV.split("\n")){
  const t=line.split("\t");
  if(!t[0]||!t[1])continue;
  const e={key:t[0],name:t[1],action:t[2]??"",indications:t[3]??"",contraindications:t[4]??"",precautions:t[5]??"",interactions:t[6]??"",adverse:t[7]??""};
  // blob normalizado (sin acentos) para buscar por nombre/acción/indicaciones sin importar tildes.
  LIST.push({...e,blob:normDrug(e.key+" "+e.action+" "+e.indications)});
 }
 return LIST;
}
export function drugMonographCount():number{return parse().length;}
/** Monografía por nombre de sustancia (emparejado normalizado). */
export function drugMonograph(name:string):DrugMonograph|undefined{
 const k=normDrug(name);
 return parse().find(m=>m.key===k);
}
/** Ranking: nombre exacto > nombre que empieza por la consulta > palabra del nombre > acción/indicaciones. Desempate por nombre. */
function rank(m:DrugMonograph,q:string):number{
 const n=m.key,a=m.action.toLowerCase(),i=m.indications.toLowerCase();
 if(n===q)return 0;
 if(n.startsWith(q))return 1;
 if(n.includes(" "+q)||n.includes(q))return n.includes(q)?2:3;
 if(a.includes(q)||i.includes(q))return 4;
 return 5;
}
/** Busca sustancias por nombre, acción o indicaciones (case-insensitive), ordenadas por relevancia. */
export function searchMonographs(query:string,limit=40):DrugMonograph[]{
 const q=normDrug(query);
 if(!q)return[];
 return parse()
  .filter(m=>m.blob.includes(q))
  .map(m=>({m,r:rank(m,q)}))
  .sort((x,y)=>x.r-y.r||x.m.key.localeCompare(y.m.key)).map(({m:{blob:_b,...m}})=>m).slice(0,limit);
}
