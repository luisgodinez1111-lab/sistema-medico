import { and, eq, isNull, desc } from 'drizzle-orm';
import {
  newInvoiceId,
  newInvoiceItemId,
  type InvoiceId,
  type AppointmentId,
  type PatientId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { invoice, invoiceItem, patient } from '../schema';

export type InvoiceRow = (typeof invoice)['$inferSelect'];
export type InvoiceItemRow = (typeof invoiceItem)['$inferSelect'];

export interface NewInvoiceItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}
export interface NewInvoiceInput {
  patientId: PatientId;
  items: NewInvoiceItem[];
  appointmentId?: AppointmentId;
  currency?: string;
}

/**
 * Facturación básica (R3). Dinero en centavos enteros. El total se deriva de las
 * líneas. Una factura `draft` puede cambiar; al emitir/pagar se sellan fechas.
 * Sin transacciones (neon-http): se inserta la factura, luego las líneas y se
 * actualiza el total; una factura sin líneas válidas no se crea.
 */
export class BillingRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  private async assertPatientInTenant(patientId: PatientId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: patient.id })
      .from(patient)
      .where(
        and(
          eq(patient.id, patientId),
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listForPatient(patientId: PatientId): Promise<InvoiceRow[]> {
    const rows = await this.db
      .select()
      .from(invoice)
      .where(
        and(
          eq(invoice.tenantId, this.ctx.tenantId),
          eq(invoice.patientId, patientId),
          isNull(invoice.deletedAt),
        ),
      )
      .orderBy(desc(invoice.createdAt));
    return rows as InvoiceRow[];
  }

  async getItems(invoiceId: InvoiceId): Promise<InvoiceItemRow[]> {
    const rows = await this.db
      .select()
      .from(invoiceItem)
      .where(
        and(eq(invoiceItem.tenantId, this.ctx.tenantId), eq(invoiceItem.invoiceId, invoiceId)),
      );
    return rows as InvoiceItemRow[];
  }

  /** Crea una factura en borrador con sus líneas; calcula el total. */
  async createInvoice(input: NewInvoiceInput): Promise<InvoiceRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const valid = input.items.filter(
      (i) => i.description.trim() !== '' && i.quantity > 0 && i.unitPriceCents >= 0,
    );
    if (valid.length === 0) return null;

    const invoiceId = newInvoiceId();
    const rows = valid.map((i) => ({
      id: newInvoiceItemId(),
      tenantId: this.ctx.tenantId,
      invoiceId,
      description: i.description.trim(),
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      amountCents: i.quantity * i.unitPriceCents,
    }));
    const totalCents = rows.reduce((sum, r) => sum + r.amountCents, 0);

    const [created] = await this.db
      .insert(invoice)
      .values({
        id: invoiceId,
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        currency: input.currency ?? 'MXN',
        totalCents,
        createdBy: this.ctx.userId,
      })
      .returning();
    await this.db.insert(invoiceItem).values(rows);
    return created as InvoiceRow;
  }

  /** draft → issued. Devuelve false si no aplica. */
  async issue(id: InvoiceId): Promise<boolean> {
    const [updated] = await this.db
      .update(invoice)
      .set({ status: 'issued', issuedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(invoice.id, id),
          eq(invoice.tenantId, this.ctx.tenantId),
          eq(invoice.status, 'draft'),
          isNull(invoice.deletedAt),
        ),
      )
      .returning({ id: invoice.id });
    return Boolean(updated);
  }

  /** issued → paid. Devuelve false si no aplica. */
  async markPaid(id: InvoiceId): Promise<boolean> {
    const [updated] = await this.db
      .update(invoice)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(invoice.id, id),
          eq(invoice.tenantId, this.ctx.tenantId),
          eq(invoice.status, 'issued'),
          isNull(invoice.deletedAt),
        ),
      )
      .returning({ id: invoice.id });
    return Boolean(updated);
  }
}
