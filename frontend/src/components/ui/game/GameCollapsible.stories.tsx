import type { Meta, StoryObj } from '@storybook/react';
import { ChevronDown } from 'lucide-react';
import { GameCollapsible, GameCollapsibleContent, GameCollapsibleTrigger } from './GameCollapsible';
import { StatBar } from './StatBar';

const meta: Meta<typeof GameCollapsible> = {
  title: 'Game UI/GameCollapsible',
  component: GameCollapsible,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof GameCollapsible>;

export const Default: Story = {
  render: () => (
    <div
      style={{
        width: '320px',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '12px',
      }}
    >
      <GameCollapsible>
        <GameCollapsibleTrigger>
          <span>Conformation Stats</span>
          <ChevronDown style={{ width: '16px', height: '16px', transition: 'transform 200ms' }} />
        </GameCollapsibleTrigger>
        <GameCollapsibleContent>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <StatBar label="Head" value={85} />
            <StatBar label="Neck" value={92} />
            <StatBar label="Shoulders" value={78} />
            <StatBar label="Back" value={88} />
          </div>
        </GameCollapsibleContent>
      </GameCollapsible>
    </div>
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <div
      style={{
        width: '320px',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '12px',
      }}
    >
      <GameCollapsible defaultOpen>
        <GameCollapsibleTrigger>
          <span>Gait Scores</span>
          <ChevronDown style={{ width: '16px', height: '16px', transition: 'transform 200ms' }} />
        </GameCollapsibleTrigger>
        <GameCollapsibleContent>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <StatBar label="Walk" value={72} />
            <StatBar label="Trot" value={88} />
            <StatBar label="Canter" value={95} />
            <StatBar label="Gallop" value={100} />
          </div>
        </GameCollapsibleContent>
      </GameCollapsible>
    </div>
  ),
};

export const NestedSections: Story = {
  render: () => (
    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {['Conformation', 'Gaits', 'Temperament'].map((section) => (
        <div
          key={section}
          style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }}
        >
          <GameCollapsible>
            <GameCollapsibleTrigger>
              <span>{section}</span>
              <ChevronDown
                style={{ width: '16px', height: '16px', transition: 'transform 200ms' }}
              />
            </GameCollapsibleTrigger>
            <GameCollapsibleContent>
              <div style={{ padding: '10px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{section} details...</p>
              </div>
            </GameCollapsibleContent>
          </GameCollapsible>
        </div>
      ))}
    </div>
  ),
};
