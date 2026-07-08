/**
 * RiderDismissControl confirm-dialog interaction tests (Equoria-oey96.27)
 *
 * FR-RIDER-4: players can manually dismiss (retire) a rider. This mirrors the
 * RiderAssignmentCard.confirmDialog.test.tsx pattern — the destructive action
 * opens an in-app GameDialog confirm (never a bare one-click removal). This
 * test covers ONLY the dialog's client-side branch logic: render with a STUB
 * `onDismiss` prop, drive the dialog, assert the callback fires on confirm and
 * does NOT fire on cancel / initial render.
 *
 * The `onDismiss` prop is the component's own injection seam, NOT a mock of a
 * network boundary (CLAUDE.md §3 — no vi.mock of the API client). The full
 * dismiss mutation against the riders dashboard + real backend lives in the
 * Playwright E2E tests/e2e/rider-dismiss.spec.ts (real DB, real CSRF).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RiderDismissControl from '../RiderDismissControl';

const RIDER = { id: 12, name: 'TestFixture-Nova Vega' };

describe('RiderDismissControl — dismiss confirm dialog (Equoria-oey96.27)', () => {
  it('does not open the dialog or call onDismiss on initial render', () => {
    const onDismiss = vi.fn();
    render(<RiderDismissControl riderId={RIDER.id} riderName={RIDER.name} onDismiss={onDismiss} />);

    expect(screen.queryByTestId(`dismiss-rider-confirm-${RIDER.id}`)).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('clicking Dismiss Rider in the dialog fires onDismiss with the rider id', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<RiderDismissControl riderId={RIDER.id} riderName={RIDER.name} onDismiss={onDismiss} />);

    // Open the confirmation from the card trigger.
    await user.click(screen.getByRole('button', { name: /dismiss rider/i }));
    const dialog = await screen.findByTestId(`dismiss-rider-confirm-${RIDER.id}`);
    expect(dialog).toBeInTheDocument();

    // Confirm — destructive action fires the callback exactly once with the id.
    await user.click(within(dialog).getByRole('button', { name: /dismiss rider/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(RIDER.id);
    await waitFor(() => {
      expect(screen.queryByTestId(`dismiss-rider-confirm-${RIDER.id}`)).not.toBeInTheDocument();
    });
  });

  it('clicking Cancel closes the dialog WITHOUT calling onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<RiderDismissControl riderId={RIDER.id} riderName={RIDER.name} onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: /dismiss rider/i }));
    await screen.findByTestId(`dismiss-rider-confirm-${RIDER.id}`);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onDismiss).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId(`dismiss-rider-confirm-${RIDER.id}`)).not.toBeInTheDocument();
    });
  });

  it('disables the trigger while a prior dismiss is in flight', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <RiderDismissControl
        riderId={RIDER.id}
        riderName={RIDER.name}
        onDismiss={onDismiss}
        isDismissing
      />
    );

    // The trigger is disabled while dismissing, so the dialog cannot open.
    expect(screen.getByRole('button', { name: /dismiss rider/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /dismiss rider/i }));
    expect(screen.queryByTestId(`dismiss-rider-confirm-${RIDER.id}`)).not.toBeInTheDocument();
  });
});
