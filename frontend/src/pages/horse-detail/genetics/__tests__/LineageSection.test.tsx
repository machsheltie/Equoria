/**
 * LineageSection parent links (Equoria-bvddn.40 b)
 *
 * Parent links must navigate inside the SPA (no full reload, which would
 * discard the query cache).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import LineageSection from '../LineageSection';
import type { Horse } from '../../HorseDetailPageTypes';

const horse = { id: 10, name: 'Foal', parentIds: { sireId: 7, damId: 8 } } as unknown as Horse;

function HorsePage() {
  const { id } = useParams();
  return (
    <div>
      <div data-testid="route-id">{id}</div>
      <LineageSection horse={horse} allTraits={[]} />
    </div>
  );
}

describe('LineageSection parent links', () => {
  it.each([
    ['View Sire Details', '/horses/7'],
    ['View Dam Details', '/horses/8'],
  ])('%s navigates in-app to %s', async (label, target) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/horses/10']}>
        <Routes>
          <Route path="/horses/:id" element={<HorsePage />} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(screen.getByRole('link', { name: new RegExp(label) }));
    await waitFor(() =>
      expect(screen.getByTestId('route-id')).toHaveTextContent(target.split('/').pop()!)
    );
  });
});
