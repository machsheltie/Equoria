/**
 * ReturningStaffCard — one rider or groom back for hire (Equoria-266h7).
 *
 * Owner rulings 2026-10-28: a released or unpaid staff member returns at its current
 * level with what it has revealed intact (q177); the card shows its name, stars,
 * personality and ONLY its revealed items, as authored words (never stored codes);
 * hiring is one click with the weekly price on the button and no confirmation (q230).
 * The shape follows the hire cards above it on the same tab.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import { InlineError } from '@/components/ui/state';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import type { StaffGrowthItem, StaffGrowthView } from '@/lib/api/types';
import '@/styles/returningStaff.css';

export interface ReturningStaffCardProps {
  testId: string;
  name: string;
  starLevel: string | null | undefined;
  /** The personality badge (already an authored label). */
  personality: React.ReactNode;
  /** An extra identity line, e.g. a groom's kind of care. */
  detail?: React.ReactNode;
  growth?: StaffGrowthView;
  bio?: string | null;
  weeklyPrice: number;
  affordable: boolean;
  /** This card's hire is in flight. */
  hiring: boolean;
  /** Any hire on the page is in flight. */
  disabled: boolean;
  onHire: () => void;
  /** The refusal of this card's last hire, already in player words. */
  errorMessage?: string | null;
}

function noteModifier(item: StaffGrowthItem): string {
  if (item.note === 'Favourite') return 'favourite';
  return item.sign === 'negative' ? 'weakness' : 'strength';
}

const RevealedItems: React.FC<{ growth?: StaffGrowthView }> = ({ growth }) => {
  const groups = (growth?.categories ?? []).filter((c) => c.revealed.length > 0);
  return (
    <div className="returning-staff__reveals" data-testid="returning-staff-reveals">
      <h4 className="returning-staff__reveals-heading">Discovered so far</h4>
      {groups.length === 0 ? (
        <p className="returning-staff__nothing">Nothing revealed yet.</p>
      ) : (
        groups.map((group) => (
          <dl className="returning-staff__reveal-group" key={group.label}>
            <dt className="returning-staff__reveal-kind">{group.label}</dt>
            <dd className="returning-staff__reveal-items">
              {group.revealed.map((item) => (
                <span className="returning-staff__reveal" key={`${item.label}-${item.note}`}>
                  {item.label}
                  <span
                    className={`returning-staff__reveal-note returning-staff__reveal-note--${noteModifier(item)}`}
                  >
                    ({item.note})
                  </span>
                </span>
              ))}
            </dd>
          </dl>
        ))
      )}
    </div>
  );
};

const ReturningStaffCard: React.FC<ReturningStaffCardProps> = ({
  testId,
  name,
  starLevel,
  personality,
  detail,
  growth,
  bio,
  weeklyPrice,
  affordable,
  hiring,
  disabled,
  onHire,
  errorMessage,
}) => (
  <li>
    <Surface variant="panel" data-testid={testId} className="returning-staff__card">
      <div>
        <h3 className="returning-staff__name">{name}</h3>
        <div className="returning-staff__identity">
          <StaffLevelStars level={starLevel} />
          {personality}
          {detail && <span className="returning-staff__speciality">{detail}</span>}
        </div>
      </div>

      <RevealedItems growth={growth} />

      {bio && <p className="returning-staff__bio">&ldquo;{bio}&rdquo;</p>}

      <div className="returning-staff__hire">
        <Button
          type="button"
          onClick={onHire}
          disabled={!affordable || disabled}
          aria-busy={hiring || undefined}
          className="returning-staff__hire-button"
          aria-label={`Hire ${name}, ${weeklyPrice.toLocaleString('en-US')} coins a week`}
          data-testid={`${testId}-hire`}
        >
          {hiring ? (
            'Hiring...'
          ) : (
            <span className="returning-staff__price">
              Hire — <Currency amount={weeklyPrice} /> /wk
            </span>
          )}
        </Button>
        {!affordable && (
          <p className="returning-staff__short">Your balance doesn&rsquo;t cover a week yet.</p>
        )}
        {errorMessage && <InlineError message={errorMessage} className="returning-staff__error" />}
      </div>
    </Surface>
  </li>
);

export default ReturningStaffCard;
