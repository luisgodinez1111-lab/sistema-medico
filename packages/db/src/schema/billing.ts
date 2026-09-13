import { pgTable, pgEnum, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type {
  InvoiceId,
  InvoiceItemId,
  AppointmentId,
  PatientId,
  TenantId,
  UserId,
} from '@medical-os/shared';

/**
 * Facturación básica (Release R3). MÓDULO SEPARADO de las tablas clínicas
 * nucleares (§33 #11: no mezclar pagos con lo clínico). El dinero se guarda en
 * CENTAVOS enteros (sin floats) con moneda explícita. Tenant- y patient-scoped.
 */
export const invoiceStatus = pgEnum('invoice_status', ['draft', 'issued', 'paid', 'void']);

export const invoice = pgTable(
  'invoice',
  {
    id: text('id').primaryKey().$type<InvoiceId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    appointmentId: text('appointment_id').$type<AppointmentId>(),

    status: invoiceStatus('status').notNull().default('draft'),
    currency: text('currency').notNull().default('MXN'),
    /** Total en centavos, derivado de las líneas (cacheado). */
    totalCents: integer('total_cents').notNull().default(0),

    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdBy: text('created_by').$type<UserId>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('invoice_tenant_idx').on(t.tenantId),
    index('invoice_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

export const invoiceItem = pgTable(
  'invoice_item',
  {
    id: text('id').primaryKey().$type<InvoiceItemId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    invoiceId: text('invoice_id').notNull().$type<InvoiceId>(),

    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    amountCents: integer('amount_cents').notNull().default(0),
  },
  (t) => [index('invoice_item_invoice_idx').on(t.tenantId, t.invoiceId)],
);
