import type { Meta, StoryObj } from '@storybook/react';
import { GameScrollArea } from './GameScrollArea';

const meta: Meta<typeof GameScrollArea> = {
  title: 'Game UI/GameScrollArea',
  component: GameScrollArea,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof GameScrollArea>;

const horseNames = [
  'Celestial Storm',
  'Golden Dawn',
  'Midnight Ember',
  'Silver Frost',
  'Crimson Tide',
  'Azure Dream',
  'Onyx Shadow',
  'Pearl Blaze',
  'Sapphire Wind',
  'Ruby Fire',
  'Jade Whisper',
  'Amber Glow',
];

export const Default: Story = {
  render: () => (
    <GameScrollArea
      style={{
        height: '200px',
        width: '280px',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {horseNames.map((name) => (
          <div
            key={name}
            style={{
              padding: '8px 12px',
              background: 'var(--glass-bg)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </GameScrollArea>
  ),
};

export const Narrow: Story = {
  render: () => (
    <GameScrollArea
      style={{
        height: '160px',
        width: '200px',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '8px',
      }}
    >
      {horseNames.map((name) => (
        <p
          key={name}
          style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}
        >
          {name}
        </p>
      ))}
    </GameScrollArea>
  ),
};
