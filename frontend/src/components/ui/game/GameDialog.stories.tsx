import type { Meta, StoryObj } from '@storybook/react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogDescription,
  GameDialogFooter,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogTrigger,
} from './GameDialog';

const meta: Meta<typeof GameDialog> = {
  title: 'Game UI/GameDialog',
  component: GameDialog,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof GameDialog>;

export const Default: Story = {
  render: () => (
    <GameDialog>
      <GameDialogTrigger asChild>
        <button
          style={{
            padding: '10px 20px',
            background: 'var(--gold-primary)',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Open Dialog
        </button>
      </GameDialogTrigger>
      <GameDialogContent>
        <GameDialogHeader>
          <GameDialogTitle>Confirm Training</GameDialogTitle>
          <GameDialogDescription>
            Training will consume your daily session for this discipline.
          </GameDialogDescription>
        </GameDialogHeader>
        <p style={{ fontSize: '14px', margin: '16px 0' }}>
          Celestial Storm will train in Dressage. The next session will be available in 7 days.
        </p>
        <GameDialogFooter>
          <button
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            style={{
              padding: '8px 16px',
              background: 'var(--gold-primary)',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Train Now
          </button>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  ),
};

export const SimpleAlert: Story = {
  render: () => (
    <GameDialog>
      <GameDialogTrigger asChild>
        <button
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--gold-dim)',
            color: 'var(--gold-400)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          View Info
        </button>
      </GameDialogTrigger>
      <GameDialogContent>
        <GameDialogHeader>
          <GameDialogTitle>Breed Information</GameDialogTitle>
        </GameDialogHeader>
        <p style={{ fontSize: '14px', margin: '12px 0' }}>
          Arabian horses are known for their endurance, intelligence, and refined conformation.
        </p>
      </GameDialogContent>
    </GameDialog>
  ),
};
