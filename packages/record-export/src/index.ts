// EPIC AB — Manifiesto del expediente clínico del paciente (interoperabilidad/portabilidad, estilo NOM-024).
// Proyección PURA y DETERMINISTA: a partir de las filas estructurales del stream de eventos construye un
// bundle canónico (agregados ordenados, cada uno con su historia de estados) y una serialización estable.
// El hash del contenido (sha256) se calcula sobre canonicalManifest() en la capa de ruta -> reproducible.
export type RecordRowLike=Readonly<{aggregateType:string;aggregateId:string;sequence:number;kind:string;occurredAt:string}>;
export type ManifestEvent=Readonly<{sequence:number;kind:string;occurredAt:string}>;
export type ManifestAggregate=Readonly<{aggregateId:string;aggregateType:string;eventCount:number;latestKind:string;firstAt:string;lastAt:string;events:readonly ManifestEvent[]}>;
export type RecordManifest=Readonly<{patientId:string;aggregateCount:number;eventCount:number;aggregates:readonly ManifestAggregate[]}>;

export function buildRecordManifest(patientId:string,rows:readonly RecordRowLike[]):RecordManifest{
 const byAgg=new Map<string,RecordRowLike[]>();
 for(const r of rows){const a=byAgg.get(r.aggregateId)??[];a.push(r);byAgg.set(r.aggregateId,a);}
 const aggregates:ManifestAggregate[]=[];
 for(const[aggregateId,evs]of byAgg){
  const sorted=[...evs].sort((a,b)=>a.sequence-b.sequence);
  const events=sorted.map(e=>({sequence:e.sequence,kind:e.kind,occurredAt:e.occurredAt}));
  const last=sorted[sorted.length-1]!;
  aggregates.push({aggregateId,aggregateType:sorted[0]!.aggregateType,eventCount:sorted.length,latestKind:last.kind,firstAt:sorted[0]!.occurredAt,lastAt:last.occurredAt,events});
 }
 // Orden estable por id de agregado -> manifiesto reproducible independientemente del orden de lectura.
 aggregates.sort((a,b)=>a.aggregateId.localeCompare(b.aggregateId));
 const eventCount=aggregates.reduce((n,a)=>n+a.eventCount,0);
 return{patientId,aggregateCount:aggregates.length,eventCount,aggregates};
}

// Serialización canónica y determinista (claves en orden fijo) para hashear el contenido.
export function canonicalManifest(m:RecordManifest):string{
 const aggs=m.aggregates.map(a=>({
  aggregateId:a.aggregateId,aggregateType:a.aggregateType,eventCount:a.eventCount,latestKind:a.latestKind,
  firstAt:a.firstAt,lastAt:a.lastAt,
  events:a.events.map(e=>({sequence:e.sequence,kind:e.kind,occurredAt:e.occurredAt})),
 }));
 return JSON.stringify({patientId:m.patientId,aggregateCount:m.aggregateCount,eventCount:m.eventCount,aggregates:aggs});
}
