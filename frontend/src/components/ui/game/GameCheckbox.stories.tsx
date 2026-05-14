import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { GameCheckbox } from './GameCheckbox';
import { GameLabel } from './GameLabel';

const meta: Meta<typeof GameCheckbox> = {
  title: 'Game UI/GameCheckbox',
  component: GameCheckbox,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof GameCheckbox>;

export const Unchecked: Story = { args: { id: 'cb-unchecked' } };
export const Checked: Story = { args: { id: 'cb-checked', defaultChecked: true } };
export const Disabled: Story = { args: { id: 'cb-disabled', disabled: true } };
export const DisabledChecked: Story = {
  args: { id: 'cb-disabled-checked', disabled: true, defaultChecked: true },
};

export const WithLabel: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <GameCheckbox id="cb-label" />
      <GameLabel htmlFor="cb-label">Show retired horses</GameLabel>
    </div>
  ),
};

export const FormGroup: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[
        { id: 'dressage', label: 'Dressage', checked: true },
        { id: 'jumping', label: 'Show Jumping', checked: false },
        { id: 'eventing', label: 'Eventing', checked: true },
        { id: 'western', label: 'Western', checked: false },
      ].map((item) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GameCheckbox id={item.id} defaultChecked={item.checked} />
          <GameLabel htmlFor={item.id}>{item.label}</GameLabel>
        </div>
      ))}
    </div>
  ),
};
