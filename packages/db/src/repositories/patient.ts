import { and, eq, isNull, or, ilike, desc } from 'drizzle-orm';
import { newPatientId, type PatientId, ConflictError, ValidationError } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { patient, allergy, condition, observation, relatedPerson } from '../schema';

/** Resultado de una fusión de pacientes duplicados. */
export interface MergeResult {
  winner: PatientRow;
  moved: { allergies: number; conditions: number; observations: number; contacts: number };
}

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
  // drizzle <0.40 lanza el error de pg directo; >=0.45 lo envuelve y deja el
  // error original en `cause`. Recorremos la cadena para detectar el 23505.
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    if ((current as { code?: unknown }).code === '23505') return true;
    const msg = (current as { message?: unknown }).message;
    if (typeof msg === 'string' && /duplicate key|unique constraint/i.test(msg)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
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

  /**
   * Fusiona un paciente duplicado (`loserId`) en el superviviente (`winnerId`),
   * reasignando sus datos clínicos y marcando al duplicado como `merged` con
   * baja lógica (§28 paso 2, ADR-0003 §8: nunca destructivo).
   *
   * neon-http no soporta transacciones multi-statement, así que la operación es
   * una secuencia de UPDATE atómicos e IDEMPOTENTES: re-ejecutarla reasigna los
   * rezagados y vuelve a marcar al perdedor sin efectos adversos.
   *
   * Devuelve null si alguno de los pacientes no existe o no es del tenant.
   * Lanza ValidationError si se intenta fusionar un paciente consigo mismo.
   */
  async merge(params: { loserId: PatientId; winnerId: PatientId }): Promise<MergeResult | null> {
    const { loserId, winnerId } = params;
    if (loserId === winnerId) {
      throw new ValidationError('No se puede fusionar un paciente consigo mismo.');
    }

    // El superviviente debe existir, estar activo y ser del tenant.
    const winner = await this.findById(winnerId);
    if (!winner) return null;

    // El perdedor puede estar activo o ya fusionado en ESTE superviviente
    // (re-ejecución idempotente). Si está borrado/fusionado en otro, no procede.
    const loser = await this.findById(loserId, { includeDeleted: true });
    if (!loser || loser.tenantId !== this.ctx.tenantId) return null;
    const alreadyMerged = loser.deletedAt !== null;
    if (alreadyMerged && loser.mergedIntoId !== winnerId) return null;

    const tenantId = this.ctx.tenantId;

    // 1) Reasignar datos clínicos del perdedor al superviviente (atómico por tabla).
    const movedAllergies = await this.db
      .update(allergy)
      .set({ patientId: winnerId, updatedAt: new Date() })
      .where(and(eq(allergy.tenantId, tenantId), eq(allergy.patientId, loserId)))
      .returning({ id: allergy.id });
    const movedConditions = await this.db
      .update(condition)
      .set({ patientId: winnerId, updatedAt: new Date() })
      .where(and(eq(condition.tenantId, tenantId), eq(condition.patientId, loserId)))
      .returning({ id: condition.id });
    const movedObservations = await this.db
      .update(observation)
      .set({ patientId: winnerId, updatedAt: new Date() })
      .where(and(eq(observation.tenantId, tenantId), eq(observation.patientId, loserId)))
      .returning({ id: observation.id });
    const movedContacts = await this.db
      .update(relatedPerson)
      .set({ patientId: winnerId, updatedAt: new Date() })
      .where(and(eq(relatedPerson.tenantId, tenantId), eq(relatedPerson.patientId, loserId)))
      .returning({ id: relatedPerson.id });

    // 2) Si el perdedor tenía revisión de alergias y el superviviente no, heredarla.
    if (winner.allergiesReviewedAt === null && loser.allergiesReviewedAt !== null) {
      await this.db
        .update(patient)
        .set({ allergiesReviewedAt: loser.allergiesReviewedAt, updatedAt: new Date() })
        .where(and(eq(patient.id, winnerId), eq(patient.tenantId, this.ctx.tenantId)));
    }

    // 3) Marcar al perdedor como fusionado (apunta al superviviente) + baja lógica.
    await this.db
      .update(patient)
      .set({
        status: 'merged',
        mergedIntoId: winnerId,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(patient.id, loserId),
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
        ),
      );

    const refreshedWinner = await this.findById(winnerId);
    return {
      winner: (refreshedWinner ?? winner) as PatientRow,
      moved: {
        allergies: movedAllergies.length,
        conditions: movedConditions.length,
        observations: movedObservations.length,
        contacts: movedContacts.length,
      },
    };
  }
}
