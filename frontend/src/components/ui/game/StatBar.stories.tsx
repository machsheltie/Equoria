import type { Meta, StoryObj } from '@storybook/react';
import { StatBar } from './StatBar';

const meta: Meta<typeof StatBar> = {
  title: 'Game UI/StatBar',
  component: StatBar,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    value: { control: { type: 'range', min: 0, max: 100 } },
    max: { control: { type: 'number', min: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof StatBar>;

export const Default: Story = { args: { label: 'Speed', value: 72, max: 100 } };
export const AtMax: Story = {
  args: { label: 'Stamina', value: 100, max: 100 },
  name: 'At Max (glow active)',
};
export const SmallSize: Story = { args: { label: 'Agility', value: 55, size: 'sm' } };
export const LargeSize: Story = { args: { label: 'Strength', value: 88, size: 'lg' } };
export const HideValue: Story = { args: { label: 'Focus', value: 40, showValue: false } };
export const WithUnit: Story = { args: { label: 'XP', value: 350, max: 500, unit: 'xp' } };

export const HorseStatGrid: Story = {
  render: () => (
    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[
        { label: 'Speed', value: 85 },
        { label: 'Stamina', value: 72 },
        { label: 'Agility', value: 68 },
        { label: 'Strength', value: 91 },
        { label: 'Balance', value: 100 },
        { label: 'Focus', value: 55 },
      ].map((s) => (
        <StatBar key={s.label} label={s.label} value={s.value} />
      ))}
    </div>
  ),
};
