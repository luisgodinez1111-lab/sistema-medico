'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PatientRepository, hasPermission } from '@medical-os/db';
import { ConflictError } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName } from '@/lib/patient-format';

export interface DuplicateView {
  id: string;
  fullName: string;
  mrn: string;
  birthDate: string;
  reason: 'curp' | 'name_birthdate';
}

export interface CreatePatientState {
  status: 'idle' | 'error' | 'duplicates';
  message?: string;
  fieldErrors?: Record<string, string>;
  duplicates?: DuplicateView[];
  /** Eco de los valores para re-render del formulario. */
  values?: Record<string, string>;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/**
 * Alta de paciente con detección de duplicados (§28 paso 2, §NIVEL 3).
 *
 * Flujo: valida → verifica permiso → busca duplicados. Si hay candidatos y el
 * usuario no confirmó (`confirm` != "1"), NO crea: devuelve los candidatos para
 * que decida. Con confirmación o sin duplicados, crea y navega al expediente.
 * La autorización es server-side (deny-by-default); nunca se confía en el cliente.
 */
export async function createPatientAction(
  _prev: CreatePatientState,
  formData: FormData,
): Promise<CreatePatientState> {
  const ctx = await getRequestContext();
  if (!ctx) {
    return { status: 'error', message: 'Sin sesión válida.' };
  }
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para crear pacientes.' };
  }

  const values = {
    givenNames: str(formData, 'givenNames'),
    firstSurname: str(formData, 'firstSurname'),
    secondSurname: str(formData, 'secondSurname'),
    birthDate: str(formData, 'birthDate'),
    sex: str(formData, 'sex') || 'unknown',
    curp: str(formData, 'curp'),
  };
  const confirm = str(formData, 'confirm') === '1';

  const fieldErrors: Record<string, string> = {};
  if (!values.givenNames) fieldErrors.givenNames = 'Requerido';
  if (!values.firstSurname) fieldErrors.firstSurname = 'Requerido';
  if (!values.birthDate) fieldErrors.birthDate = 'Requerida';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate))
    fieldErrors.birthDate = 'Formato AAAA-MM-DD';
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Revisa los campos.', fieldErrors, values };
  }

  const repo = new PatientRepository(getDb(), ctx);
  // Campos opcionales: se omiten si están vacíos (exactOptionalPropertyTypes).
  const optional = {
    ...(values.secondSurname ? { secondSurname: values.secondSurname } : {}),
    ...(values.curp ? { curp: values.curp } : {}),
  };
  const dedupInput = {
    givenNames: values.givenNames,
    firstSurname: values.firstSurname,
    birthDate: values.birthDate,
    ...optional,
  };

  if (!confirm) {
    const dups = await repo.findDuplicates(dedupInput);
    if (dups.length > 0) {
      return {
        status: 'duplicates',
        message: 'Se encontraron posibles coincidencias. Revisa antes de crear.',
        duplicates: dups.map((d) => ({
          id: d.patient.id,
          fullName: fullPatientName(d.patient),
          mrn: d.patient.mrn,
          birthDate: d.patient.birthDate,
          reason: d.reason,
        })),
        values,
      };
    }
  }

  let newId: string;
  try {
    const created = await repo.create({
      givenNames: values.givenNames,
      firstSurname: values.firstSurname,
      birthDate: values.birthDate,
      sex: values.sex as 'female' | 'male' | 'other' | 'unknown',
      ...optional,
    });
    newId = created.id;
  } catch (error) {
    if (error instanceof ConflictError) {
      return { status: 'error', message: 'Ya existe un paciente con ese MRN o CURP.', values };
    }
    throw error;
  }

  revalidatePath('/patients');
  redirect(`/patients/${newId}`);
}
