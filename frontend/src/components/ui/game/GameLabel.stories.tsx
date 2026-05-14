import type { Meta, StoryObj } from '@storybook/react';
import { GameLabel } from './GameLabel';

const meta: Meta<typeof GameLabel> = {
  title: 'Game UI/GameLabel',
  component: GameLabel,
  parameters: { layout: 'centered' },
  argTypes: {
    smallCaps: { control: 'boolean' },
    required: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof GameLabel>;

export const Default: Story = { args: { children: 'Horse Name' } };
export const Required: Story = { args: { children: 'Horse Name', required: true } };
export const SmallCaps: Story = {
  args: { children: 'Section Header', smallCaps: true },
  name: 'Small Caps',
};
export const SmallCapsRequired: Story = {
  args: { children: 'Required Section', smallCaps: true, required: true },
};

export const FormExample: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <GameLabel required>Discipline</GameLabel>
      <input
        style={{
          padding: '8px 12px',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontSize: '14px',
          width: '200px',
        }}
        placeholder="Select discipline..."
      />
    </div>
  ),
};

export const SectionHeader: Story = {
  render: () => (
    <div style={{ width: '280px' }}>
      <GameLabel smallCaps>Conformation Stats</GameLabel>
      <div style={{ marginTop: '8px', height: '2px', background: 'var(--glass-border)' }} />
    </div>
  ),
};
