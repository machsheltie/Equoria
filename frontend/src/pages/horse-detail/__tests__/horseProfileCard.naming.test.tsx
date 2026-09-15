/**
 * HorseProfileCard — naming behaviour (Equoria-4fnro).
 *
 * Real component, real policy module, real Equoria primitives: the only
 * scaffolding is a router (EntityHeader renders a back Link) and a
 * QueryClientProvider (useRenameHorse is a mutation). Nothing Equoria-owned is
 * mocked, and no request is made — every case here closes the form locally or
 * never opens it.
 *
 * What it pins:
 *   1. An unnamed horse reads as an invitation, and the pencil offers to NAME
 *      her rather than to edit her.
 *   2. Focus returns to the pencil when the form closes, so a keyboard user is
 *      not dropped at the top of the document after naming her horse.
 *   3. A name the shared rule refuses is explained at the field and never sent.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import HorseProfileCard from '../HorseProfileCard';
import { UNNAMED_HORSE_NAME } from '@/lib/horseNamePolicy';

const baseHorse = {
  id: 1,
  name: 'Moonflower',
  breed: 'Thoroughbred',
  age: 0,
  gender: 'Filly',
  healthStatus: 'Excellent',
  stats: { speed: 40, stamina: 40, agility: 40 },
};

/** Owns isEditing/editName exactly as HorseDetailPage does. */
function Harness({ name }: { name: string }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HorseProfileCard
          horse={{ ...baseHorse, name } as React.ComponentProps<typeof HorseProfileCard>['horse']}
          sireName={null}
          isEditing={isEditing}
          editName={editName}
          onStartEdit={() => {
            setEditName(name === UNNAMED_HORSE_NAME ? '' : name);
            setIsEditing(true);
          }}
          onCancelEdit={() => setIsEditing(false)}
          onChangeEditName={setEditName}
          onOpenTemperamentReference={() => {}}
          refetch={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseProfileCard — naming (Equoria-4fnro)', () => {
  it('offers to NAME an unnamed horse, and to EDIT one who already has a name', () => {
    const { unmount } = render(<Harness name={UNNAMED_HORSE_NAME} />);
    expect(screen.getByLabelText('Name this horse')).toBeInTheDocument();
    // The word reads as a blank waiting to be filled, in the same h1.
    expect(screen.getByTestId('horse-unnamed-title')).toHaveTextContent('unnamed');
    unmount();

    render(<Harness name="Moonflower" />);
    expect(screen.getByLabelText('Edit horse name')).toBeInTheDocument();
    expect(screen.queryByTestId('horse-unnamed-title')).not.toBeInTheDocument();
  });

  it('opens an EMPTY field for an unnamed horse — her first act is writing, not deleting', () => {
    render(<Harness name={UNNAMED_HORSE_NAME} />);
    fireEvent.click(screen.getByLabelText('Name this horse'));
    expect(screen.getByLabelText('Horse name')).toHaveValue('');
    expect(screen.getByLabelText('Horse name')).toHaveAttribute('maxLength', '40');
    expect(screen.getByTestId('horse-rename-counter')).toHaveTextContent(
      '40 of 40 characters left'
    );
  });

  it('returns focus to the pencil when the form is cancelled', () => {
    render(<Harness name="Moonflower" />);
    const pencil = screen.getByLabelText('Edit horse name');
    pencil.focus();
    fireEvent.click(pencil);

    // The pencil is gone while the form is open.
    expect(screen.queryByLabelText('Edit horse name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const restored = screen.getByLabelText('Edit horse name');
    expect(restored).toBeInTheDocument();
    expect(document.activeElement).toBe(restored);
  });

  it('explains a refused name at the field and never sends it', () => {
    render(<Harness name="Moonflower" />);
    fireEvent.click(screen.getByLabelText('Edit horse name'));
    fireEvent.change(screen.getByLabelText('Horse name'), { target: { value: 'Fred <3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Local refusal: the form stays open with her text intact, and the reason is
    // announced beside the field. (A sent request would have failed this test on
    // an unmocked fetch.)
    expect(screen.getByRole('alert')).toHaveTextContent('<');
    expect(screen.getByLabelText('Horse name')).toHaveValue('Fred <3');
  });
});
