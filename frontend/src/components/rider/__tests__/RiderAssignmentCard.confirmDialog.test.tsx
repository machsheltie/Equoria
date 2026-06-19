/**
 * RiderAssignmentCard confirm-dialog interaction tests (Equoria-o5hub.34)
 *
 * The unassign action now opens an in-app GameDialog (window.confirm replaced
 * per Equoria-o5hub.13). The pure interaction contract is RTL-testable without
 * any API: render with a STUB `onUnassign` prop, drive the dialog, and assert
 * the callback fires on confirm and does NOT fire on cancel / initial render.
 *
 * The full unassign mutation against riders dashboard + real backend stays
 * E2E-deferred (Equoria-o5hub.34-e2e-1). This test covers only the dialog's
 * client-side branch logic — no mocking of our API client (CLAUDE.md §3); the
 * onUnassign prop is the component's own injection seam, not a mock of a network
 * boundary.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RiderAssignmentCard from '../RiderAssignmentCard';
import type { RiderAssignment } from '@/hooks/api/useRiders';

const ASSIGNMENT: RiderAssignment = {
  id: 7,
  riderId: 3,
  horseId: 42,
  horseName: 'TestFixture-Comet',
  startDate: '2026-01-10T00:00:00Z',
  isActive: true,
};

describe('RiderAssignmentCard — unassign confirm dialog (Equoria-o5hub.34)', () => {
  it('does not open the dialog or call onUnassign on initial render', () => {
    const onUnassign = vi.fn();
    render(<RiderAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} />);

    // Confirm dialog is closed until the user asks to unassign.
    expect(screen.queryByTestId(`unassign-rider-confirm-${ASSIGNMENT.id}`)).not.toBeInTheDocument();
    expect(onUnassign).not.toHaveBeenCalled();
  });

  it('clicking Remove Rider in the dialog fires onUnassign with the assignment id', async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    render(<RiderAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} />);

    // Open the confirmation.
    await user.click(screen.getByRole('button', { name: /unassign rider/i }));
    const dialog = await screen.findByTestId(`unassign-rider-confirm-${ASSIGNMENT.id}`);
    expect(dialog).toBeInTheDocument();

    // Confirm — destructive action fires the callback exactly once with the id.
    await user.click(screen.getByRole('button', { name: /remove rider/i }));

    expect(onUnassign).toHaveBeenCalledTimes(1);
    expect(onUnassign).toHaveBeenCalledWith(ASSIGNMENT.id);
    // Dialog closes after confirming.
    await waitFor(() => {
      expect(
        screen.queryByTestId(`unassign-rider-confirm-${ASSIGNMENT.id}`)
      ).not.toBeInTheDocument();
    });
  });

  it('clicking Cancel closes the dialog WITHOUT calling onUnassign', async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    render(<RiderAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} />);

    await user.click(screen.getByRole('button', { name: /unassign rider/i }));
    await screen.findByTestId(`unassign-rider-confirm-${ASSIGNMENT.id}`);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    // Cancel is non-destructive: no mutation, dialog gone.
    expect(onUnassign).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByTestId(`unassign-rider-confirm-${ASSIGNMENT.id}`)
      ).not.toBeInTheDocument();
    });
  });

  it('disables the trigger and the confirm button while a prior unassign is in flight', async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    render(<RiderAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} isUnassigning />);

    // The row trigger is disabled while unassigning, so the dialog cannot reopen.
    expect(screen.getByRole('button', { name: /unassign rider/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /unassign rider/i }));
    expect(screen.queryByTestId(`unassign-rider-confirm-${ASSIGNMENT.id}`)).not.toBeInTheDocument();
  });
});
