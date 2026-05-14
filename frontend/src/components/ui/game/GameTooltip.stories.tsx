import type { Meta, StoryObj } from '@storybook/react';
import {
  GameTooltip,
  GameTooltipContent,
  GameTooltipProvider,
  GameTooltipTrigger,
} from './GameTooltip';

const meta: Meta<typeof GameTooltip> = {
  title: 'Game UI/GameTooltip',
  component: GameTooltip,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <GameTooltipProvider>
        <Story />
      </GameTooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GameTooltip>;

export const Default: Story = {
  render: () => (
    <GameTooltip>
      <GameTooltipTrigger asChild>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Hover me
        </button>
      </GameTooltipTrigger>
      <GameTooltipContent>
        <p>Arabian horses have superior endurance (+20% bonus)</p>
      </GameTooltipContent>
    </GameTooltip>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <GameTooltip>
      <GameTooltipTrigger asChild>
        <span
          style={{
            display: 'inline-flex',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--glass-bg)',
            border: '1px solid var(--gold-dim)',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'help',
            fontSize: '12px',
            color: 'var(--gold-400)',
          }}
        >
          ?
        </span>
      </GameTooltipTrigger>
      <GameTooltipContent>
        <p>Training cooldown: 7 days between sessions per discipline.</p>
      </GameTooltipContent>
    </GameTooltip>
  ),
};

export const LongContent: Story = {
  render: () => (
    <GameTooltip>
      <GameTooltipTrigger asChild>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--gold-700)',
            border: 'none',
            color: 'var(--text-primary)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Legendary Trait
        </button>
      </GameTooltipTrigger>
      <GameTooltipContent>
        <p>
          This trait grants a 25% bonus to all competition scores in the horse&apos;s primary
          discipline. Extremely rare — only 0.1% of foals are born with this trait.
        </p>
      </GameTooltipContent>
    </GameTooltip>
  ),
};
