// Marcas comerciales (curado, México). Permite buscar por nombre comercial y agrupar por principio activo. Se apoya en
// monographs.ts para la normalización y para enlazar cada marca con la monografía de su principio activo. NO contiene datos
// clínicos: la clínica (acción/indicaciones/contraindicaciones) vive en el principio activo. Es un subconjunto curado; el
// universo completo (COFEPRIS) se ingiere aparte cuando se disponga del export.
import{normDrug}from"./monographs";
import{DRUG_BRANDS_TSV}from"./brands-data";
export type DrugBrand=Readonly<{brand:string;ingredient:string;ingredientKey:string;lab:string}>;
let LIST:DrugBrand[]|null=null;
function parse():DrugBrand[]{
 if(LIST)return LIST;
 LIST=[];
 for(const line of DRUG_BRANDS_TSV.split("\n")){
  const t=line.split("\t");const brand=(t[0]??"").trim();const ingredient=(t[1]??"").trim();
  if(!brand||!ingredient)continue;
  LIST.push({brand,ingredient,ingredientKey:normDrug(ingredient),lab:(t[2]??"").trim()});
 }
 return LIST;
}
export function drugBrandCount():number{return parse().length;}
/** Todas las marcas, ordenadas alfabéticamente (para listar sin búsqueda). */
export function allBrands():readonly DrugBrand[]{return parse().slice().sort((a,b)=>a.brand.localeCompare(b.brand,"es"));}
/** Marcas comerciales de un principio activo (emparejado normalizado). */
export function brandsForIngredient(name:string):DrugBrand[]{
 const k=normDrug(name);
 return parse().filter(b=>b.ingredientKey===k).sort((a,b)=>a.brand.localeCompare(b.brand,"es"));
}
/** Busca por nombre comercial, principio activo o laboratorio. Ranking: marca exacta > empieza por > contiene. */
export function searchBrands(query:string,limit=40):DrugBrand[]{
 const q=normDrug(query);
 if(!q)return[];
 const rank=(b:DrugBrand):number=>{const n=normDrug(b.brand);return n===q?0:n.startsWith(q)?1:n.includes(q)?2:b.ingredientKey.includes(q)?3:4;};
 return parse().filter(b=>normDrug(b.brand).includes(q)||b.ingredientKey.includes(q)||normDrug(b.lab).includes(q))
  .map(b=>({b,r:rank(b)}))
  .sort((x,y)=>x.r-y.r||x.b.brand.localeCompare(y.b.brand,"es")).map(x=>x.b).slice(0,limit);
}
