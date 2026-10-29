/**
 * CopyReportPanel — a Diagnose report with one Copy report button
 * (Equoria-yqi49, Equoria-brh8c). The owner hands it to Claude Code or Codex.
 *
 * Shared by the held-show tools, the payroll tools and the server panel. When
 * the browser refuses clipboard access the report is selected and she is told
 * to copy it by hand.
 *
 * File for Claude Code (owner ruling q234) puts the report in the game's issue
 * list for the next Claude Code session. It files once: a filed report says so.
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/state';
import type { OwnerFiling } from '@/lib/api/staff';

/** The File for Claude Code control, when the report can be filed. */
export interface FileForClaudeCode {
  /** Whether it is filed already, as the server last said. */
  filing: OwnerFiling | null;
  pending: boolean;
  /** Plain words for a refused filing, or null. */
  error: string | null;
  onFile: () => void;
}

function filedWords(filing: OwnerFiling): string {
  if (filing.imported && filing.beadId) {
    return `Filed. It is in the issue list as ${filing.beadId}.`;
  }
  return filing.alreadyFiled
    ? 'This was already filed. The next Claude Code session picks it up.'
    : 'Filed. The next Claude Code session picks it up.';
}

export interface CopyReportPanelProps {
  report: string;
  onClose: () => void;
  file?: FileForClaudeCode;
}

export function CopyReportPanel({ report, onClose, file }: CopyReportPanelProps) {
  const filed = file?.filing?.filed === true;
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyState('copied');
    } catch {
      // The browser refused clipboard access: the visible fallback below
      // selects the report and tells her to copy it by hand.
      textRef.current?.select();
      setCopyState('manual');
    }
  };

  return (
    <div className="mt-3 border-l-2 border-[var(--border-muted)] pl-4">
      <p className="text-[var(--text-primary)]">
        Hand this report to Claude Code or Codex. It holds no emails, passwords or server settings.
      </p>
      <textarea
        ref={textRef}
        readOnly
        aria-label="Diagnosis report"
        value={report}
        rows={12}
        className="mt-2 w-full rounded border border-[var(--border-muted)] bg-transparent p-2 font-mono text-xs text-[var(--text-primary)]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          Copy report
        </Button>
        {file && (
          <Button
            variant="secondary"
            size="sm"
            pending={file.pending}
            disabled={filed}
            onClick={file.onFile}
          >
            {filed ? 'Filed for Claude Code' : 'File for Claude Code'}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        {copyState === 'copied' && (
          <span className="text-sm text-role-secondary" role="status">
            Copied.
          </span>
        )}
        {copyState === 'manual' && (
          <span className="text-sm text-role-secondary" role="status">
            The report is selected: press Ctrl+C to copy it.
          </span>
        )}
      </div>
      {file?.filing?.filed && (
        <p className="mt-2 text-sm text-role-secondary" role="status">
          {filedWords(file.filing)}
        </p>
      )}
      {file?.error && <InlineError message={file.error} />}
    </div>
  );
}

export default CopyReportPanel;
