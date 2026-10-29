/**
 * CopyReportPanel — a Diagnose report with one Copy report button
 * (Equoria-yqi49, Equoria-brh8c). The owner hands it to Claude Code or Codex.
 *
 * Shared by the held-show tools, the payroll tools and the server panel. When
 * the browser refuses clipboard access the report is selected and she is told
 * to copy it by hand.
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface CopyReportPanelProps {
  report: string;
  onClose: () => void;
}

export function CopyReportPanel({ report, onClose }: CopyReportPanelProps) {
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
    </div>
  );
}

export default CopyReportPanel;
