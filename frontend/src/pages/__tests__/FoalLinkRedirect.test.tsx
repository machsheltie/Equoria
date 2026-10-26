/**
 * Old foal links land on the horse page (Equoria-jaeot).
 *
 * OLD CONTRACT: /foals/:id was a separate foal page (FoalDetailPage) that
 * stopped working once the horse turned 3.
 * OWNER RULING (2026-10-16, repeated in q71 on 2026-10-26): a horse has one
 * page for life; the separate foal page goes. A /foals/:id link therefore
 * lands on /horses/:id, the same horse.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useParams } from 'react-router';
import FoalLinkRedirect from '../FoalLinkRedirect';

const HorsePageStandIn = () => {
  const { id } = useParams<{ id: string }>();
  return <p>horse page for {id}</p>;
};

describe('FoalLinkRedirect (Equoria-jaeot)', () => {
  it('sends /foals/:id to the same horse on /horses/:id', async () => {
    render(
      <MemoryRouter initialEntries={['/foals/42']}>
        <Routes>
          <Route path="/foals/:id" element={<FoalLinkRedirect />} />
          <Route path="/horses/:id" element={<HorsePageStandIn />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('horse page for 42')).toBeInTheDocument();
  });
});
