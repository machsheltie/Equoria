import type { Meta, StoryObj } from '@storybook/react';
import { GoldTabs, GoldTabsContent, GoldTabsList, GoldTabsTrigger } from './GoldTabs';

const meta: Meta<typeof GoldTabs> = {
  title: 'Game UI/GoldTabs',
  component: GoldTabs,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof GoldTabs>;

export const Default: Story = {
  render: () => (
    <GoldTabs defaultValue="stats" style={{ width: '400px' }}>
      <GoldTabsList>
        <GoldTabsTrigger value="stats">Stats</GoldTabsTrigger>
        <GoldTabsTrigger value="traits">Traits</GoldTabsTrigger>
        <GoldTabsTrigger value="history">History</GoldTabsTrigger>
      </GoldTabsList>
      <GoldTabsContent value="stats">
        <p style={{ fontSize: '14px' }}>Horse stats would appear here.</p>
      </GoldTabsContent>
      <GoldTabsContent value="traits">
        <p style={{ fontSize: '14px' }}>Discovered traits listed here.</p>
      </GoldTabsContent>
      <GoldTabsContent value="history">
        <p style={{ fontSize: '14px' }}>Competition history and lineage.</p>
      </GoldTabsContent>
    </GoldTabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <GoldTabs defaultValue="overview" style={{ width: '360px' }}>
      <GoldTabsList>
        <GoldTabsTrigger value="overview">Overview</GoldTabsTrigger>
        <GoldTabsTrigger value="details">Details</GoldTabsTrigger>
      </GoldTabsList>
      <GoldTabsContent value="overview">Overview content</GoldTabsContent>
      <GoldTabsContent value="details">Detailed content</GoldTabsContent>
    </GoldTabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <GoldTabs defaultValue="profile" style={{ width: '600px' }}>
      <GoldTabsList>
        {['Profile', 'Stats', 'Traits', 'Pedigree', 'Health', 'History'].map((t) => (
          <GoldTabsTrigger key={t} value={t.toLowerCase()}>
            {t}
          </GoldTabsTrigger>
        ))}
      </GoldTabsList>
      {['Profile', 'Stats', 'Traits', 'Pedigree', 'Health', 'History'].map((t) => (
        <GoldTabsContent key={t} value={t.toLowerCase()}>
          {t} content
        </GoldTabsContent>
      ))}
    </GoldTabs>
  ),
};
