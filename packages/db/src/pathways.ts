/**
 * Guías de manejo / care pathways (Release R4).
 *
 * **CONTENIDO DEMO, NO VALIDADO CLÍNICAMENTE** (§33 #8: el contenido clínico real
 * requiere fuente + versión + reviewer). Estructura versionada lista para
 * sustituir por guías licenciadas/aprobadas. Sólo RECOMIENDA ítems de seguimiento
 * por problema activo; no marca cumplimiento automático para no inducir falsa
 * tranquilidad (§27).
 */

export const PATHWAYS_VERSION = 'demo-2026.09.1';
export const PATHWAYS_SOURCE = 'DEMO (no validado clínicamente)';

export interface PathwayItem {
  label: string;
  cadence: string;
}
export interface PathwayDef {
  /** Palabra clave que activa la guía (match contra el problema del paciente). */
  match: string;
  title: string;
  items: ReadonlyArray<PathwayItem>;
}

const DEMO_PATHWAYS: ReadonlyArray<PathwayDef> = [
  {
    match: 'diabetes',
    title: 'Diabetes mellitus tipo 2 (DEMO)',
    items: [
      { label: 'HbA1c', cadence: 'cada 3 meses' },
      { label: 'Perfil lipídico', cadence: 'anual' },
      { label: 'Examen de pies', cadence: 'anual' },
      { label: 'Fondo de ojo', cadence: 'anual' },
    ],
  },
  {
    match: 'hipertension',
    title: 'Hipertensión arterial (DEMO)',
    items: [
      { label: 'Tensión arterial', cadence: 'cada visita' },
      { label: 'Creatinina y electrolitos', cadence: 'anual' },
    ],
  },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Guías aplicables según los problemas activos del paciente. `extra` permite
 * aportar guías del pack de especialidad activo (§R7); se combinan con las base
 * sin duplicar por `match`+`title` y se filtran igual por problemas activos.
 */
export function applicablePathways(
  conditions: ReadonlyArray<{ code: string }>,
  extra: ReadonlyArray<PathwayDef> = [],
): PathwayDef[] {
  const codes = conditions.map((c) => normalize(c.code));
  const seen = new Set<string>();
  const all: PathwayDef[] = [];
  for (const p of [...DEMO_PATHWAYS, ...extra]) {
    const key = `${p.match}|${p.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(p);
  }
  return all.filter((p) => codes.some((c) => c.includes(p.match)));
}
