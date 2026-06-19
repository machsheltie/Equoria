/**
 * TrainerAssignmentCard confirm-dialog interaction tests (Equoria-o5hub.34)
 *
 * Mirror of RiderAssignmentCard: the unassign action opens an in-app GameDialog
 * (window.confirm replaced per Equoria-o5hub.13). RTL covers the pure dialog
 * branch logic with a STUB `onUnassign` prop — confirm fires the callback,
 * cancel does not, and the trigger is gated while a prior unassign is in flight.
 *
 * The full mutation against the trainers dashboard + real backend is
 * E2E-deferred (Equoria-o5hub.34-e2e-1). No API client is mocked (CLAUDE.md §3);
 * onUnassign is the component's own injection seam.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainerAssignmentCard, { type TrainerAssignment } from '../TrainerAssignmentCard';

const ASSIGNMENT: TrainerAssignment = {
  id: 11,
  trainerId: 4,
  horseName: 'TestFixture-Blaze',
  startDate: '2026-02-02T00:00:00Z',
  isActive: true,
};

describe('TrainerAssignmentCard — unassign confirm dialog (Equoria-o5hub.34)', () => {
  it('does not open the dialog or call onUnassign on initial render', () => {
    const onUnassign = vi.fn();
    render(<TrainerAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} />);

    expect(
      screen.queryByTestId(`unassign-trainer-confirm-${ASSIGNMENT.id}`)
    ).not.toBeInTheDocument();
    expect(onUnassign).not.toHaveBeenCalled();
  });

  it('clicking Remove Trainer in the dialog fires onUnassign with the assignment id', async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    render(<TrainerAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} />);

    await user.click(screen.getByRole('button', { name: /unassign trainer/i }));
    expect(
      await screen.findByTestId(`unassign-trainer-confirm-${ASSIGNMENT.id}`)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove trainer/i }));

    expect(onUnassign).toHaveBeenCalledTimes(1);
    expect(onUnassign).toHaveBeenCalledWith(ASSIGNMENT.id);
    await waitFor(() => {
      expect(
        screen.queryByTestId(`unassign-trainer-confirm-${ASSIGNMENT.id}`)
      ).not.toBeInTheDocument();
    });
  });

  it('clicking Cancel closes the dialog WITHOUT calling onUnassign', async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    render(<TrainerAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} />);

    await user.click(screen.getByRole('button', { name: /unassign trainer/i }));
    await screen.findByTestId(`unassign-trainer-confirm-${ASSIGNMENT.id}`);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onUnassign).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByTestId(`unassign-trainer-confirm-${ASSIGNMENT.id}`)
      ).not.toBeInTheDocument();
    });
  });

  it('disables the trigger while a prior unassign is in flight', async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn();
    render(<TrainerAssignmentCard assignment={ASSIGNMENT} onUnassign={onUnassign} isUnassigning />);

    expect(screen.getByRole('button', { name: /unassign trainer/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /unassign trainer/i }));
    expect(
      screen.queryByTestId(`unassign-trainer-confirm-${ASSIGNMENT.id}`)
    ).not.toBeInTheDocument();
  });
});
