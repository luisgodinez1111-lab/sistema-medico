import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from './Alert';

const meta = {
  title: 'Componentes/Alert',
  component: Alert,
  args: { title: 'Aviso', children: 'Mensaje de la alerta.' },
  argTypes: {
    severity: { control: 'select', options: ['info', 'success', 'warning', 'critical'] },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = { args: { severity: 'info' } };
export const Success: Story = { args: { severity: 'success', title: 'Guardado' } };
export const Warning: Story = { args: { severity: 'warning', title: 'Revisar' } };

/** `critical` = alerta safety-critical del pathway engine (§NIVEL 7), no aviso de UI. */
export const Critical: Story = {
  args: {
    severity: 'critical',
    title: 'Contraindicación',
    children: 'Alergia a penicilina documentada. No prescribir.',
  },
};

/** Severidad + icono + texto: el riesgo nunca se comunica solo por color (§2.3). */
export const TodasLasSeveridades: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8 }}>
      <Alert severity="info" title="Información">
        Recordatorio de control.
      </Alert>
      <Alert severity="success" title="Éxito">
        Nota firmada.
      </Alert>
      <Alert severity="warning" title="Advertencia">
        Interacción moderada.
      </Alert>
      <Alert severity="critical" title="Crítico">
        Contraindicación absoluta.
      </Alert>
    </div>
  ),
};
