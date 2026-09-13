import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Componentes/Button',
  component: Button,
  args: { children: 'Guardar' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancelar' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Eliminar' } };
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };

/** Regla UX (§2.3): máximo una acción primaria por panel; el resto secundarias. */
export const UnaSolaPrimaria: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="primary">Firmar nota</Button>
      <Button variant="secondary">Guardar borrador</Button>
      <Button variant="ghost">Descartar</Button>
    </div>
  ),
};
