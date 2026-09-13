import type { Meta, StoryObj } from '@storybook/react-vite';
import { PatientHeader } from './PatientHeader';
import { Button } from '../components/Button';

const meta = {
  title: 'Patrones/PatientHeader',
  component: PatientHeader,
  args: {
    fullName: 'Ana María Pérez López',
    ageLabel: '34 a',
    sexLabel: 'Femenino',
    mrn: 'MRN-001',
  },
} satisfies Meta<typeof PatientHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};

/** Identidad + edad + banderas críticas siempre visibles: previene "paciente equivocado" (§27). */
export const ConBanderasCriticas: Story = {
  args: {
    criticalFlags: [
      { label: 'Alergia: Penicilina', tone: 'critical' },
      { label: 'Anticoagulado', tone: 'warning' },
    ],
    actions: <Button variant="secondary">Acciones</Button>,
  },
};

/** Lactante: la edad se formatea en el dominio (ej. meses/días). */
export const Lactante: Story = {
  args: {
    fullName: 'Diego Ramírez Soto',
    ageLabel: '6 m 12 d',
    sexLabel: 'Masculino',
    mrn: 'MRN-114',
  },
};
