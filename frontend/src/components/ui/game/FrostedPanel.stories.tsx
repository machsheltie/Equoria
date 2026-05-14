import type { Meta, StoryObj } from '@storybook/react';
import {
  FrostedPanel,
  FrostedPanelContent,
  FrostedPanelDescription,
  FrostedPanelFooter,
  FrostedPanelHeader,
  FrostedPanelTitle,
} from './FrostedPanel';

const meta: Meta<typeof FrostedPanel> = {
  title: 'Game UI/FrostedPanel',
  component: FrostedPanel,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof FrostedPanel>;

export const Default: Story = {
  render: () => (
    <FrostedPanel style={{ width: '320px' }}>
      <FrostedPanelHeader>
        <FrostedPanelTitle>Celestial Stallion</FrostedPanelTitle>
        <FrostedPanelDescription>Arabian · Level 12</FrostedPanelDescription>
      </FrostedPanelHeader>
      <FrostedPanelContent>
        <p style={{ fontSize: '14px' }}>Horse details and stats would appear here.</p>
      </FrostedPanelContent>
    </FrostedPanel>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <FrostedPanel style={{ width: '320px' }}>
      <FrostedPanelHeader>
        <FrostedPanelTitle>Training Session</FrostedPanelTitle>
        <FrostedPanelDescription>Dressage · 7 days cooldown</FrostedPanelDescription>
      </FrostedPanelHeader>
      <FrostedPanelContent>
        <p style={{ fontSize: '14px' }}>Next session available in 3 days.</p>
      </FrostedPanelContent>
      <FrostedPanelFooter>
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
      </FrostedPanelFooter>
    </FrostedPanel>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <FrostedPanel style={{ width: '280px' }}>
      <FrostedPanelHeader>
        <FrostedPanelTitle>Quick Info</FrostedPanelTitle>
      </FrostedPanelHeader>
      <FrostedPanelContent>
        <p style={{ fontSize: '14px' }}>Panel content goes here.</p>
      </FrostedPanelContent>
    </FrostedPanel>
  ),
};
