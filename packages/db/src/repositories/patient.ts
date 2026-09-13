import { and, eq, isNull, or, ilike, desc } from 'drizzle-orm';
import { newPatientId, type PatientId, ConflictError } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { patient } from '../schema';

export type PatientRow = (typeof patient)['$inferSelect'];

export interface NewPatientInput {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string;
  birthDate: string; // YYYY-MM-DD
  sex?: 'female' | 'male' | 'other' | 'unknown';
  mrn?: string;
  curp?: string;
  phone?: string;
  email?: string;
}

export interface DuplicateCandidate {
  patient: PatientRow;
  /** Por qué se considera posible duplicado. */
  reason: 'curp' | 'name_birthdate';
}

/**
 * Normaliza un nombre para comparación: minúsculas, sin acentos, espacios
 * colapsados. Base de la `dedup_key` (§28: detección de duplicados).
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clave determinista nombre completo + fecha de nacimiento. */
export function buildDedupKey(input: {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string;
  birthDate: string;
}): string {
  const name = normalizeName(
    [input.givenNames, input.firstSurname, input.secondSurname ?? ''].join(' '),
  );
  return `${name}|${input.birthDate}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === '23505') return true;
  const msg = (error as { message?: unknown }).message;
  return typeof msg === 'string' && /duplicate key|unique constraint/i.test(msg);
}

/**
 * Repositorio tenant-aware de pacientes (§NIVEL 3, ADR-0002/0003).
 *
 * - Scoping obligatorio por `ctx.tenantId` en toda operación.
 * - Excluye por defecto los pacientes con borrado lógico (`deleted_at`).
 * - El borrado es lógico y reversible; nunca DELETE físico (ADR-0003 §8).
 */
export class PatientRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  /**
   * Busca posibles duplicados ANTES de crear (§28 paso 2). No bloquea: devuelve
   * candidatos para que la capa de aplicación/usuario decida. CURP es señal
   * fuerte; nombre+fecha es señal probable.
   */
  async findDuplicates(input: {
    givenNames: string;
    firstSurname: string;
    secondSurname?: string;
    birthDate: string;
    curp?: string;
  }): Promise<DuplicateCandidate[]> {
    const dedupKey = buildDedupKey(input);
    const rows = await this.db
      .select()
      .from(patient)
      .where(
        and(
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
          or(input.curp ? eq(patient.curp, input.curp) : undefined, eq(patient.dedupKey, dedupKey)),
        ),
      );
    return (rows as PatientRow[]).map((p) => ({
      patient: p,
      reason: input.curp && p.curp === input.curp ? 'curp' : 'name_birthdate',
    }));
  }

  /**
   * Crea un paciente. Fuerza el tenant del contexto. Lanza ConflictError si el
   * MRN o la CURP ya existen en el tenant. La detección "blanda" de duplicados
   * (homónimos) es responsabilidad de `findDuplicates`, no de esta restricción.
   */
  async create(input: NewPatientInput): Promise<PatientRow> {
    const mrn = input.mrn ?? `P-${Math.floor(100000 + Math.random() * 900000)}`;
    const row = {
      id: newPatientId(),
      tenantId: this.ctx.tenantId,
      mrn,
      curp: input.curp ?? null,
      givenNames: input.givenNames,
      firstSurname: input.firstSurname,
      secondSurname: input.secondSurname ?? null,
      birthDate: input.birthDate,
      sex: input.sex ?? 'unknown',
      phone: input.phone ?? null,
      email: input.email ?? null,
      dedupKey: buildDedupKey(input),
    };
    try {
      const [created] = await this.db.insert(patient).values(row).returning();
      return created as PatientRow;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Ya existe un paciente con ese MRN o CURP en el tenant.');
      }
      throw error;
    }
  }

  /** Paciente del tenant; por defecto excluye borrados lógicos. */
  async findById(id: PatientId, opts?: { includeDeleted?: boolean }): Promise<PatientRow | null> {
    const [row] = await this.db
      .select()
      .from(patient)
      .where(
        and(
          eq(patient.id, id),
          eq(patient.tenantId, this.ctx.tenantId),
          opts?.includeDeleted ? undefined : isNull(patient.deletedAt),
        ),
      )
      .limit(1);
    return (row as PatientRow) ?? null;
  }

  /** Búsqueda por nombre (normalizado), MRN o CURP dentro del tenant. */
  async search(query: string, limit = 20): Promise<PatientRow[]> {
    const q = query.trim();
    if (q === '') return [];
    const like = `%${q}%`;
    const rows = await this.db
      .select()
      .from(patient)
      .where(
        and(
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
          or(
            ilike(patient.givenNames, like),
            ilike(patient.firstSurname, like),
            ilike(patient.secondSurname, like),
            ilike(patient.mrn, like),
            ilike(patient.curp, like),
          ),
        ),
      )
      .orderBy(patient.firstSurname, patient.givenNames)
      .limit(limit);
    return rows as PatientRow[];
  }

  async listRecent(limit = 50): Promise<PatientRow[]> {
    const rows = await this.db
      .select()
      .from(patient)
      .where(and(eq(patient.tenantId, this.ctx.tenantId), isNull(patient.deletedAt)))
      .orderBy(desc(patient.createdAt))
      .limit(limit);
    return rows as PatientRow[];
  }

  /** Borrado LÓGICO y reversible (ADR-0003 §8). Devuelve false si no es del tenant. */
  async softDelete(id: PatientId): Promise<boolean> {
    const [updated] = await this.db
      .update(patient)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(
        and(eq(patient.id, id), eq(patient.tenantId, this.ctx.tenantId), isNull(patient.deletedAt)),
      )
      .returning();
    return Boolean(updated);
  }
}
