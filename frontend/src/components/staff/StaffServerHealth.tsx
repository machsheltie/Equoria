/**
 * StaffServerHealth — the server's memory and speed in plain words
 * (Equoria-brh8c, owner ruling 2026-10-28 q158).
 *
 * Owner only (server.health.view). Read from the server's own memory when she
 * opens the office or presses Refresh; nothing is sent anywhere else. Copy
 * report gives her the same facts to hand to Claude Code or Codex.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired, useServerHealth } from '@/hooks/api/useStaff';
import type { ServerHealth } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffTimeOptions } from './staffMessages';
import StaffSection from './StaffSection';
import CopyReportPanel from './CopyReportPanel';

function growingWords(growing: boolean | null): string {
  if (growing === null) {
    return 'There are not enough readings yet to tell whether memory is growing.';
  }
  return growing
    ? 'Memory has been growing steadily: worth a look.'
    : 'Memory is not growing steadily.';
}

function HealthFacts({ health }: { health: ServerHealth }) {
  const { memory, speed } = health;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[var(--text-primary)]">Memory</h3>
        <ul className="mt-1 list-disc pl-5 text-sm text-[var(--text-primary)]">
          <li>The server is using {memory.totalMb} MB in all.</li>
          <li>
            The game&apos;s working memory: {memory.usedMb} MB used of {memory.reservedMb} MB set
            aside ({memory.percentUsed}%).
          </li>
          <li>{growingWords(memory.growing)}</li>
          <li>Up for {health.uptime}.</li>
          {memory.warnings.length === 0 ? (
            <li>No memory warnings.</li>
          ) : (
            memory.warnings.map((warning) => (
              <li key={`${warning.at}-${warning.what}`}>
                {formatDateTime(warning.at, staffTimeOptions)}: {warning.what}
                {warning.serious ? ' (serious)' : ''}
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <h3 className="text-[var(--text-primary)]">Speed</h3>
        <p className="mt-1 text-sm text-[var(--text-primary)]">
          {speed.requests.toLocaleString()} requests answered since{' '}
          {formatDateTime(speed.since, staffTimeOptions)}; {speed.overOneSecond.toLocaleString()}{' '}
          took over a second. {speed.cachedAnswersPercent}% were answered from the cache.
        </p>
        {speed.slowestRoutes.length === 0 ? (
          <p className="mt-2 text-sm text-role-secondary">No requests timed yet.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-role-secondary">Slowest addresses, by average time:</p>
            <ol className="mt-1 divide-y divide-[var(--border-muted)]">
              {speed.slowestRoutes.map((route) => (
                <li key={route.route} className="flex flex-wrap justify-between gap-2 py-1 text-sm">
                  <span className="font-mono text-xs text-[var(--text-primary)]">
                    {route.route}
                  </span>
                  <span className="text-role-secondary">
                    {route.averageMs} ms on average, slowest {route.slowestMs} ms,{' '}
                    {route.requests.toLocaleString()}{' '}
                    {route.requests === 1 ? 'request' : 'requests'}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

export interface StaffServerHealthProps {
  onCheckinRequired: () => void;
}

export function StaffServerHealth({ onCheckinRequired }: StaffServerHealthProps) {
  const health = useServerHealth();
  const [report, setReport] = useState<string | null>(null);

  const checkinLapsed = isCheckinRequired(health.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  let body: React.ReactNode;
  if (health.isPending) {
    body = <SectionLoading label="Reading the server's memory and speed" />;
  } else if (health.isError) {
    const { title, message, retryable } = userMessageFor(health.error);
    body = (
      <ErrorState
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void health.refetch() } : undefined}
      />
    );
  } else {
    const data = health.data.health;
    body = (
      <>
        <div className="mb-3 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            pending={health.isFetching}
            onClick={() => void health.refetch()}
          >
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setReport(data.report)}>
            Report for Claude Code
          </Button>
        </div>
        {report !== null && <CopyReportPanel report={report} onClose={() => setReport(null)} />}
        <HealthFacts health={data} />
      </>
    );
  }

  return (
    <StaffSection
      title="Server memory and speed"
      intro="How much memory the game's server is using and which addresses answer slowest, since it last started."
    >
      {body}
    </StaffSection>
  );
}

export default StaffServerHealth;
