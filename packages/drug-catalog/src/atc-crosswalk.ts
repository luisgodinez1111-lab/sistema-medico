// Crosswalk ATC (nivel 4) → taxonomía de CLASES interna del motor de seguridad. Es el ÚNICO artefacto "autorado"
// de la ingesta, y es una correspondencia TAXONOMÍA↔TAXONOMÍA (no farmacología inventada por fármaco): cada fila dice
// "la clase ATC X corresponde a mi(s) clase(s) interna(s) Y". Fuente: la clasificación ATc/DDD de la OMS, consultada
// vía RxNav (NLM); aquí solo se guarda el MAPEO derivado, no la base ATC.
//
// SEGURIDAD — por qué un código ATC equivocado NO puede misclasificar un fármaco: cada fila lleva el nombre de clase
// ATC esperado (`atcName`). El generador compara ese nombre con el que RxNav devuelve para ese código; si no coinciden
// (porque me equivoqué al teclear el código), la fila NO aplica y el fármaco cae al reporte de curación (fail-closed),
// nunca a una clase equivocada. Y SOLO se mapea a clases internas que YA tienen regla renal (si no, el fármaco no es
// admisible). Lo HETEROGÉNEO se OMITE a propósito (p. ej. "otros antidepresivos" N06AX, "otros antiepilépticos" N03AX,
// el grupo heparina B01AB que mezcla HNF y HBPM): mapearlo adivinaría. Esos fármacos quedan para curación manual.
export type AtcCrosswalkEntry=Readonly<{atc:string;atcName:string;internal:readonly string[]}>;

export const ATC_CROSSWALK:readonly AtcCrosswalkEntry[]=[
 // — Cardiovascular / metabólico —
 {atc:"C10AA",atcName:"HMG CoA reductase inhibitors",internal:["STATIN"]},
 {atc:"C09AA",atcName:"ACE inhibitors, plain",internal:["ACE_INHIBITOR"]},
 {atc:"C09CA",atcName:"Angiotensin II receptor blockers (ARBs), plain",internal:["ARB"]},
 {atc:"C07AA",atcName:"Beta blocking agents, non-selective",internal:["BETA_BLOCKER"]},
 {atc:"C07AB",atcName:"Beta blocking agents, selective",internal:["BETA_BLOCKER"]},
 {atc:"C07AG",atcName:"Alpha and beta blocking agents",internal:["BETA_BLOCKER"]},
 {atc:"C08CA",atcName:"Dihydropyridine derivatives",internal:["CALCIUM_CHANNEL_BLOCKER"]},
 {atc:"C08DA",atcName:"Phenylalkylamine derivatives",internal:["NON_DIHYDRO_CCB"]},
 {atc:"C08DB",atcName:"Benzothiazepine derivatives",internal:["NON_DIHYDRO_CCB"]},
 {atc:"C03CA",atcName:"Sulfonamides, plain",internal:["LOOP_DIURETIC"]},
 {atc:"C03AA",atcName:"Thiazides, plain",internal:["THIAZIDE"]},
 {atc:"C03DA",atcName:"Aldosterone antagonists",internal:["POTASSIUM_SPARING"]},
 {atc:"C01AA",atcName:"Digitalis glycosides",internal:["DIGITALIS"]},
 {atc:"C01DA",atcName:"Organic nitrates",internal:["NITRATE"]},
 {atc:"C02CA",atcName:"Alpha-adrenoreceptor antagonists",internal:["ALPHA_BLOCKER"]},
 {atc:"G04CA",atcName:"Alpha-adrenoreceptor antagonists",internal:["ALPHA_BLOCKER"]},
 {atc:"B01AA",atcName:"Vitamin K antagonists",internal:["ANTICOAGULANT","VKA"]},
 {atc:"B01AC",atcName:"Platelet aggregation inhibitors excl. heparin",internal:["ANTIPLATELET"]},
 // — Diabetes —
 {atc:"A10BA",atcName:"Biguanides",internal:["BIGUANIDE"]},
 {atc:"A10BB",atcName:"Sulfonylureas",internal:["SULFONYLUREA"]},
 {atc:"A10BH",atcName:"Dipeptidyl peptidase 4 (DPP-4) inhibitors",internal:["DPP4_INHIBITOR"]},
 {atc:"A10BK",atcName:"Sodium-glucose co-transporter 2 (SGLT2) inhibitors",internal:["SGLT2_INHIBITOR"]},
 {atc:"A10BG",atcName:"Thiazolidinediones",internal:["TZD"]},
 {atc:"A10AB",atcName:"Insulins and analogues for injection, fast-acting",internal:["INSULIN"]},
 {atc:"A10AC",atcName:"Insulins and analogues for injection, intermediate-acting",internal:["INSULIN"]},
 {atc:"A10AD",atcName:"Insulins and analogues for inj., intermediate-acting combined with fast-acting",internal:["INSULIN"]},
 {atc:"A10AE",atcName:"Insulins and analogues for injection, long-acting",internal:["INSULIN"]},
 // — Gastro —
 {atc:"A02BC",atcName:"Proton pump inhibitors",internal:["PPI"]},
 {atc:"A02BA",atcName:"H2-receptor antagonists",internal:["H2_BLOCKER"]},
 {atc:"A03FA",atcName:"Propulsives",internal:["PROKINETIC"]},
 {atc:"A04AA",atcName:"Serotonin (5HT3) antagonists",internal:["ANTIEMETIC_5HT3"]},
 // — Antibióticos —
 {atc:"J01CA",atcName:"Penicillins with extended spectrum",internal:["PENICILLIN","BETA_LACTAM"]},
 {atc:"J01CE",atcName:"Beta-lactamase sensitive penicillins",internal:["PENICILLIN","BETA_LACTAM"]},
 {atc:"J01CF",atcName:"Beta-lactamase resistant penicillins",internal:["PENICILLIN","BETA_LACTAM"]},
 {atc:"J01CR",atcName:"Combinations of penicillins, incl. beta-lactamase inhibitors",internal:["PENICILLIN","BETA_LACTAM"]},
 {atc:"J01DB",atcName:"First-generation cephalosporins",internal:["CEPHALOSPORIN","BETA_LACTAM"]},
 {atc:"J01DC",atcName:"Second-generation cephalosporins",internal:["CEPHALOSPORIN","BETA_LACTAM"]},
 {atc:"J01DD",atcName:"Third-generation cephalosporins",internal:["CEPHALOSPORIN","BETA_LACTAM"]},
 {atc:"J01DE",atcName:"Fourth-generation cephalosporins",internal:["CEPHALOSPORIN","BETA_LACTAM"]},
 {atc:"J01DI",atcName:"Other cephalosporins and penems",internal:["CEPHALOSPORIN","BETA_LACTAM"]},
 {atc:"J01DH",atcName:"Carbapenems",internal:["CARBAPENEM"]},
 {atc:"J01FA",atcName:"Macrolides",internal:["MACROLIDE"]},
 {atc:"J01FF",atcName:"Lincosamides",internal:["LINCOSAMIDE"]},
 {atc:"J01MA",atcName:"Fluoroquinolones",internal:["FLUOROQUINOLONE"]},
 {atc:"J01AA",atcName:"Tetracyclines",internal:["TETRACYCLINE"]},
 {atc:"J01GB",atcName:"Other aminoglycosides",internal:["AMINOGLYCOSIDE"]},
 {atc:"J01XA",atcName:"Glycopeptide antibacterials",internal:["GLYCOPEPTIDE"]},
 {atc:"J01XE",atcName:"Nitrofuran derivatives",internal:["NITROFURANTOIN"]},
 {atc:"J01XD",atcName:"Imidazole derivatives",internal:["NITROIMIDAZOLE"]},
 {atc:"P01AB",atcName:"Nitroimidazole derivatives",internal:["NITROIMIDAZOLE"]},
 {atc:"J01EE",atcName:"Combinations of sulfonamides and trimethoprim, incl. derivatives",internal:["SULFONAMIDE","SULFONAMIDE_ANTIBIOTIC"]},
 {atc:"J02AC",atcName:"Triazole and tetrazole derivatives",internal:["AZOLE"]},
 {atc:"J05AB",atcName:"Nucleosides and nucleotides excl. reverse transcriptase inhibitors",internal:["ANTIVIRAL_NUCLEOSIDE"]},
 // — SNC —
 {atc:"N06AB",atcName:"Selective serotonin reuptake inhibitors",internal:["SSRI"]},
 {atc:"N06AA",atcName:"Non-selective monoamine reuptake inhibitors",internal:["TCA"]},
 {atc:"N05BA",atcName:"Benzodiazepine derivatives",internal:["BENZODIAZEPINE"]},
 {atc:"N05CD",atcName:"Benzodiazepine derivatives",internal:["BENZODIAZEPINE"]},
 {atc:"N05AN",atcName:"Lithium",internal:["LITHIUM"]},
 {atc:"N05AD",atcName:"Butyrophenone derivatives",internal:["ANTIPSYCHOTIC"]},
 {atc:"N05AH",atcName:"Diazepines, oxazepines, thiazepines and oxepines",internal:["ANTIPSYCHOTIC"]},
 {atc:"N05AX",atcName:"Other antipsychotics",internal:["ANTIPSYCHOTIC"]},
 {atc:"N03AA",atcName:"Barbiturates and derivatives",internal:["BARBITURATE"]},
 {atc:"N02AA",atcName:"Natural opium alkaloids",internal:["OPIOID"]},
 {atc:"N02AB",atcName:"Phenylpiperidine derivatives",internal:["OPIOID"]},
 {atc:"N02AX",atcName:"Other opioids",internal:["OPIOID"]},
 // — Endocrino / respiratorio —
 {atc:"H02AB",atcName:"Glucocorticoids",internal:["CORTICOSTEROID"]},
 {atc:"H03BA",atcName:"Thiouracils",internal:["ANTITHYROID"]},
 {atc:"H03BB",atcName:"Sulfur-containing imidazole derivatives",internal:["ANTITHYROID"]},
 {atc:"G03CA",atcName:"Natural and semisynthetic estrogens, plain",internal:["ESTROGEN"]},
 {atc:"R03DC",atcName:"Leukotriene receptor antagonists",internal:["LEUKOTRIENE"]},
 {atc:"R03DA",atcName:"Xanthines",internal:["METHYLXANTHINE"]},
 {atc:"R03BA",atcName:"Glucocorticoids",internal:["INHALED_CORTICOSTEROID"]},
 // G04BE ("Drugs used in erectile dysfunction") OMITIDO a propósito: es HETEROGÉNEO (sildenafil/tadalafil son PDE5,
 // pero alprostadil/papaverina/fentolamina NO). Mapearlo misclasificaría. Los PDE5 reales van curados.
 // — AINE (M01A) —
 {atc:"M01AB",atcName:"Acetic acid derivatives and related substances",internal:["NSAID"]},
 {atc:"M01AC",atcName:"Oxicams",internal:["NSAID"]},
 {atc:"M01AE",atcName:"Propionic acid derivatives",internal:["NSAID"]},
 {atc:"M01AG",atcName:"Fenamates",internal:["NSAID"]},
 {atc:"M01AH",atcName:"Coxibs",internal:["NSAID","COX2_SELECTIVE"]},
];

// Índice por código ATC (nivel 4). El generador lo consulta y verifica `atcName` contra lo que devuelve RxNav.
export const ATC_TO_INTERNAL:ReadonlyMap<string,AtcCrosswalkEntry>=new Map(ATC_CROSSWALK.map(e=>[e.atc,e]));

// EXCEPCIONES RENALES — principios activos que son miembros RENALMENTE ELIMINADOS de una clase cuya regla renal es
// `noAdjustment`. Admitirlos heredaría un "sin ajuste" FALSO (p. ej. la propia nota de BETA_BLOCKER dice que sotalol y
// nadolol SÍ requieren ajuste). Como no se fabrican umbrales por fármaco, el generador los deja fuera (→ curación): así
// quedan NOT_EVALUATED (fuerzan REVIEW), que es la dirección SEGURA, hasta que se les cure una regla renal con fuente.
export const RENAL_EXCEPTION_INGREDIENTS:ReadonlySet<string>=new Set<string>([
 "sotalol","carteolol","nadolol",   // betabloqueadores de eliminación renal (clase BETA_BLOCKER = noAdjustment)
 "demeclociclina",                  // tetraciclina que empeora la función renal/causa DI nefrogénica (clase TETRACYCLINE = noAdjustment)
]);
