/**
 * TrainerDismissControl confirm-dialog tests (Equoria-oey96.71)
 *
 * Players can dismiss (retire) a hired trainer, mirroring RiderDismissControl
 * (Equoria-oey96.27). The destructive action opens an in-app GameDialog confirm,
 * never a bare one-click removal. These cover the control's own branch logic with
 * its own `onDismiss` prop as the injection seam (not a network mock); the real
 * mutation against the dashboard is in MyTrainersDashboard.dismiss.test.tsx.
 *
 * Failure feedback is surface-owned (FRONTEND_ASYNC_STATE_DOCTRINE section 3): an
 * `errorMessage` renders as an InlineError at the control, announced as an alert.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainerDismissControl from '../TrainerDismissControl';

const TRAINER = { id: 12, name: 'Alice Thornton' };

function renderControl(props: Partial<React.ComponentProps<typeof TrainerDismissControl>> = {}) {
  const onDismiss = vi.fn();
  render(
    <TrainerDismissControl
      trainerId={TRAINER.id}
      trainerName={TRAINER.name}
      onDismiss={onDismiss}
      {...props}
    />
  );
  return { onDismiss };
}

describe('TrainerDismissControl — dismiss confirm dialog (Equoria-oey96.71)', () => {
  it('does not open the dialog or call onDismiss on initial render', () => {
    const { onDismiss } = renderControl();

    expect(screen.queryByTestId(`dismiss-trainer-confirm-${TRAINER.id}`)).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('names the trainer and the consequence in the confirmation', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole('button', { name: /dismiss trainer/i }));
    const dialog = await screen.findByTestId(`dismiss-trainer-confirm-${TRAINER.id}`);

    expect(dialog).toHaveTextContent(/Alice Thornton/);
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  it('confirming fires onDismiss once with the trainer id and closes the dialog', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderControl();

    await user.click(screen.getByRole('button', { name: /dismiss trainer/i }));
    const dialog = await screen.findByTestId(`dismiss-trainer-confirm-${TRAINER.id}`);
    await user.click(within(dialog).getByRole('button', { name: /dismiss trainer/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(TRAINER.id);
    await waitFor(() => {
      expect(screen.queryByTestId(`dismiss-trainer-confirm-${TRAINER.id}`)).not.toBeInTheDocument();
    });
  });

  it('Cancel closes the dialog without calling onDismiss', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderControl();

    await user.click(screen.getByRole('button', { name: /dismiss trainer/i }));
    await screen.findByTestId(`dismiss-trainer-confirm-${TRAINER.id}`);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onDismiss).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId(`dismiss-trainer-confirm-${TRAINER.id}`)).not.toBeInTheDocument();
    });
  });

  it('disables the trigger while a dismissal is in flight', async () => {
    const user = userEvent.setup();
    renderControl({ isDismissing: true });

    const trigger = screen.getByRole('button', { name: /dismiss trainer/i });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByTestId(`dismiss-trainer-confirm-${TRAINER.id}`)).not.toBeInTheDocument();
  });

  it('shows a failure as an announced inline error at the control', () => {
    renderControl({ errorMessage: 'Something went wrong on our end. Try again in a moment.' });

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong on our end/i);
  });

  it('shows no alert when there is no failure', () => {
    renderControl();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
