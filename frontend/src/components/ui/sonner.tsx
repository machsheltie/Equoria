/** Sonner toast — Celestial Night frosted glass styling (Task 22-6 fix) */
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            'group toast',
            '!bg-[rgba(10,14,26,0.92)] !text-[var(--text-primary)]',
            '!border !border-[rgba(200,168,78,0.25)] !rounded-[var(--radius-md)]',
            '!shadow-[var(--shadow-floating)]',
            'backdrop-blur-[12px]',
            '!font-[var(--font-body)]',
          ].join(' '),
          description: '!text-[var(--text-muted)] !text-sm',
          actionButton: [
            '!bg-gradient-to-r !from-[var(--gold-primary)] !to-[var(--gold-light)]',
            '!text-[var(--bg-deep-space)] !font-semibold',
            '!font-[var(--font-heading)] !rounded-full',
            '!border-0',
          ].join(' '),
          cancelButton: [
            '!bg-[rgba(15,23,42,0.6)] !text-[var(--text-secondary)]',
            '!border !border-[var(--glass-border)] !rounded-full',
          ].join(' '),
          title: '!text-[var(--text-primary)] !font-[var(--font-heading)] !font-medium',
          icon: '!text-[var(--gold-primary)]',
          success: '!border-l-4 !border-l-[var(--status-success)]',
          error: '!border-l-4 !border-l-[var(--status-danger)]',
          warning: '!border-l-4 !border-l-[var(--status-warning)]',
          info: '!border-l-4 !border-l-[var(--status-info)]',
          closeButton: [
            '!bg-transparent !text-[var(--text-muted)]',
            'hover:!text-[var(--text-primary)] !border-0',
          ].join(' '),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
