import type { Meta, StoryObj } from '@storybook/react';
import { GameBadge } from './GameBadge';

const meta: Meta<typeof GameBadge> = {
  title: 'Game UI/GameBadge',
  component: GameBadge,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'success',
        'warning',
        'primary',
        'outline',
        'common',
        'uncommon',
        'rare',
        'ultra-rare',
        'legendary',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof GameBadge>;

export const Default: Story = { args: { children: 'Gold Badge', variant: 'default' } };
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } };
export const Destructive: Story = { args: { children: 'Injured', variant: 'destructive' } };
export const Success: Story = { args: { children: 'Healthy', variant: 'success' } };
export const Warning: Story = { args: { children: 'Caution', variant: 'warning' } };
export const Primary: Story = { args: { children: 'Info', variant: 'primary' } };
export const Outline: Story = { args: { children: 'Outline', variant: 'outline' } };
export const Common: Story = { args: { children: 'Common', variant: 'common' } };
export const Uncommon: Story = { args: { children: 'Uncommon', variant: 'uncommon' } };
export const Rare: Story = { args: { children: 'Rare', variant: 'rare' } };
export const UltraRare: Story = { args: { children: 'Ultra Rare', variant: 'ultra-rare' } };
export const Legendary: Story = { args: { children: 'Legendary', variant: 'legendary' } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {(
        [
          'default',
          'secondary',
          'destructive',
          'success',
          'warning',
          'primary',
          'outline',
          'common',
          'uncommon',
          'rare',
          'ultra-rare',
          'legendary',
        ] as const
      ).map((v) => (
        <GameBadge key={v} variant={v}>
          {v}
        </GameBadge>
      ))}
    </div>
  ),
};
