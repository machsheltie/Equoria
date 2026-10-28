/**
 * SMTP mail transport, used when the Gmail API is not configured.
 *
 * Explicit limits (STAFF-RR-06/08): nodemailer's defaults wait 2 minutes to
 * connect, 30 s for the greeting and 10 minutes on an idle socket, which let
 * one dead server hold the staff email outbox past its schedule.
 */

import nodemailer from 'nodemailer';

/** SMTP connect, greeting and idle-socket limits, in ms. */
export const smtpTimeouts = Object.freeze({
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
});

/**
 * @param {{ host: string, port: string|number, user: string, pass: string }} config
 */
export function createSmtpTransport({ host, port, user, pass }) {
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
    ...smtpTimeouts,
  });
}
