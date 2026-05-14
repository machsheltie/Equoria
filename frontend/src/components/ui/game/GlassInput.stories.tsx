import type { Meta, StoryObj } from '@storybook/react';
import { GlassInput } from './GlassInput';

const meta: Meta<typeof GlassInput> = {
  title: 'Game UI/GlassInput',
  component: GlassInput,
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'password', 'search', 'number'] },
  },
};

export default meta;
type Story = StoryObj<typeof GlassInput>;

export const Default: Story = {
  args: { placeholder: 'Search horses...', style: { width: '280px' } },
};
export const WithValue: Story = {
  args: { defaultValue: 'Celestial Storm', style: { width: '280px' } },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read-only field', style: { width: '280px' } },
};
export const Password: Story = {
  args: { type: 'password', placeholder: 'Enter password', style: { width: '280px' } },
};
export const EmailType: Story = {
  args: { type: 'email', placeholder: 'player@equoria.com', style: { width: '280px' } },
};
