import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Componentes/Badge',
  component: Badge,
  args: { children: 'Activo' },
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'info', 'success', 'warning', 'critical'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { tone: 'neutral' } };
export const Info: Story = { args: { tone: 'info', children: 'Sugerencia' } };
export const Success: Story = { args: { tone: 'success', children: 'Almacenado' } };
export const Warning: Story = { args: { tone: 'warning', children: 'Revisar' } };
export const Critical: Story = { args: { tone: 'critical', children: 'Alergia' } };

/** El riesgo lleva etiqueta textual, nunca solo color (§2.3). */
export const ConIcono: Story = {
  args: { tone: 'critical', icon: '⛔ ', children: 'Contraindicado' },
};
