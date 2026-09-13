import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClinicalCard } from './Card';
import { Button } from './Button';

const meta = {
  title: 'Componentes/ClinicalCard',
  component: ClinicalCard,
  args: {
    title: 'Alergias',
    children: 'Sin alergias conocidas (NKDA).',
  },
} satisfies Meta<typeof ClinicalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basica: Story = {};

/** Acción secundaria en el encabezado; la primaria vive fuera de la tarjeta. */
export const ConAccion: Story = {
  args: {
    title: 'Problemas activos',
    action: <Button variant="ghost">Ver todo</Button>,
    children: 'Diabetes tipo 2 · Hipertensión',
  },
};
