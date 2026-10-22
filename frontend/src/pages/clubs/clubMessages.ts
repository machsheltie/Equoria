/**
 * What a refusal means for each club action (Equoria-pqor7).
 *
 * The backend answers these business refusals with a bare 4xx; the shared
 * mapper's generic 4xx copy talks about "highlighted fields", which no join,
 * vote or nomination has. Each action names the statuses it can actually get
 * (clubController.mjs) and falls through to the shared copy for the rest.
 * Server messages are never rendered.
 */

import type { ActionCopy } from '@/lib/http/actionMessage';

export const joinRefused: ActionCopy = {
  409: "You're already a member of this club.",
};

export const createClubRefused: ActionCopy = {
  409: 'A club with that name already exists. Choose another name.',
};

export const nominateRefused: ActionCopy = {
  400: "This election isn't open for nominations.",
  409: "You've already put your name forward in this election.",
};

export const voteRefused: ActionCopy = {
  400: "Voting isn't open, or that candidate is no longer on the ballot.",
  409: "You've already voted in this election.",
};
