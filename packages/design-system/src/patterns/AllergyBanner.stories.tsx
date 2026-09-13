import type { Meta, StoryObj } from '@storybook/react-vite';
import { AllergyBanner } from './AllergyBanner';

const meta = {
  title: 'Patrones/AllergyBanner',
  component: AllergyBanner,
  args: { allergies: [] },
} satisfies Meta<typeof AllergyBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Alergias confirmadas: se muestran explícitas, nunca escondidas tras un badge (§27). */
export const ConAlergias: Story = {
  args: { allergies: ['Penicilina', 'Sulfas'] },
};

/** "Sin alergias conocidas" (NKDA): negativo documentado. */
export const SinAlergiasConocidas: Story = {
  args: { allergies: [] },
};

/**
 * "No evaluado" ≠ "sin alergias": nunca se colapsa ausencia de dato con negativo
 * (§NIVEL 5). Debe documentarse antes de prescribir.
 */
export const NoEvaluado: Story = {
  args: { allergies: [], notAssessed: true },
};
