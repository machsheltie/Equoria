import type { Meta, StoryObj } from '@storybook/react';
import { GlassTextarea } from './GlassTextarea';

const meta: Meta<typeof GlassTextarea> = {
  title: 'Game UI/GlassTextarea',
  component: GlassTextarea,
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' },
    rows: { control: { type: 'number', min: 2, max: 10 } },
  },
};

export default meta;
type Story = StoryObj<typeof GlassTextarea>;

export const Default: Story = {
  args: { placeholder: 'Add a note about this horse...', style: { width: '320px' } },
};
export const WithContent: Story = {
  args: {
    defaultValue:
      'Celestial Storm shows exceptional potential in dressage. Responds well to calm handling.',
    style: { width: '320px' },
  },
};
export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'This field is read-only.',
    style: { width: '320px' },
  },
};
export const TallRows: Story = {
  args: { placeholder: 'Long notes here...', rows: 6, style: { width: '320px' } },
};
