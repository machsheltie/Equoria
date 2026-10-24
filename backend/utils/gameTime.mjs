/**
 * gameTime.mjs — the game clock.
 *
 * Owner ruling (Stacey, repeated 2026-10-09): everything in Equoria runs on
 * the owner's time zone, US Eastern, following daylight saving like a wall
 * clock (America/New_York: EDT in summer, EST in winter). Every scheduled job,
 * every "today", every "this week" and every day count is an Eastern calendar
 * day. Timestamps are still STORED as instants (UTC in the database); only the
 * calendar they are read on is Eastern.
 *
 * Day counts use the Eastern calendar date, never a millisecond delta, so a
 * 23- or 25-hour daylight-saving day is still exactly one game day.
 *
 * Built on Intl (full ICU ships with Node >= 22); no dependency.
 */

export const GAME_TIME_ZONE = 'America/New_York';

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GAME_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/**
 * The Eastern wall-clock reading of an instant.
 * @param {Date|string|number} date
 * @returns {{year:number, month:number, day:number, weekday:number, hour:number, minute:number, second:number}}
 *   month is 1-12; weekday is 0 (Sunday) - 6 (Saturday).
 */
export function gameDateParts(date) {
  const parts = {};
  for (const { type, value } of partsFormatter.formatToParts(new Date(date))) {
    parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAYS[parts.weekday],
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Whole-day index of the instant's Eastern calendar date. Subtracting two
 * indexes gives the number of game days between them.
 * @param {Date|string|number} date
 * @returns {number}
 */
export function gameDayIndex(date) {
  const { year, month, day } = gameDateParts(date);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * The Eastern calendar date as 'YYYY-MM-DD'.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function gameDateKey(date) {
  return new Date(gameDayIndex(date) * MS_PER_DAY).toISOString().slice(0, 10);
}

/*
 * DATE-ONLY COLUMNS (Horse.dateOfBirth, lastBredDate, lastVettedDate are
 * `@db.Date`). Postgres keeps only a calendar date and Prisma returns it as
 * UTC midnight of that date. Such a value already IS a calendar date: read it
 * with calendarDateDayIndex (never re-read it on the Eastern clock, which would
 * put it on the evening before), and write it with gameCalendarDate so the
 * stored date is the Eastern date, not the UTC date of the moment.
 */

/**
 * Day index of a date-only value (as Prisma returns a `@db.Date` column),
 * comparable with gameDayIndex.
 * @param {Date|string|number} value
 * @returns {number}
 */
export function calendarDateDayIndex(value) {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY;
}

/**
 * The value to store in a `@db.Date` column: the Eastern calendar date of
 * `instant`, moved by `offsetDays` whole game days (e.g. -21 for "born 21 days
 * ago"), as UTC midnight of that date.
 * @param {Date|string|number} [instant=new Date()]
 * @param {number} [offsetDays=0]
 * @returns {Date}
 */
export function gameCalendarDate(instant = new Date(), offsetDays = 0) {
  return new Date((gameDayIndex(instant) + offsetDays) * MS_PER_DAY);
}

/** Eastern offset from UTC at an instant, in ms (e.g. -4h during EDT). */
function easternOffsetMs(instantMs) {
  const p = gameDateParts(instantMs);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(instantMs / 1000) * 1000
  );
}

/**
 * The instant of 00:00 Eastern that begins game day `index`.
 * (Daylight saving changes at 02:00, so midnight always exists exactly once.)
 * @param {number} index - a gameDayIndex value
 * @returns {Date}
 */
export function startOfGameDayIndex(index) {
  const wallMidnightAsUtc = index * MS_PER_DAY;
  const guess = wallMidnightAsUtc - easternOffsetMs(wallMidnightAsUtc);
  return new Date(wallMidnightAsUtc - easternOffsetMs(guess));
}

/**
 * The instant of 00:00 Eastern on the instant's game day.
 * @param {Date|string|number} date
 * @returns {Date}
 */
export function startOfGameDay(date) {
  return startOfGameDayIndex(gameDayIndex(date));
}

/**
 * The half-open interval [start, end) of the instant's game day, for
 * "already happened today?" queries.
 * @param {Date|string|number} [date=new Date()]
 * @returns {{start: Date, end: Date}}
 */
export function gameDayBounds(date = new Date()) {
  const index = gameDayIndex(date);
  return { start: startOfGameDayIndex(index), end: startOfGameDayIndex(index + 1) };
}

/**
 * The instant of 00:00 Eastern on the most recent `weekStartDay` at or before
 * the instant's game day.
 * @param {Date|string|number} date
 * @param {number} weekStartDay - 0 (Sunday) - 6 (Saturday)
 * @returns {Date}
 */
export function startOfGameWeek(date, weekStartDay) {
  const back = (gameDateParts(date).weekday - weekStartDay + 7) % 7;
  return startOfGameDayIndex(gameDayIndex(date) - back);
}

/**
 * The instant `days` Eastern calendar days after `date` at the same Eastern
 * wall-clock time (to the second), so a 23- or 25-hour daylight-saving day is
 * still exactly one game day. A wall time that does not exist on the target day
 * (02:xx on the spring-forward day) lands an hour later.
 * Equoria-bvddn.22: a club election run-off lasts one game day.
 * @param {Date|string|number} date
 * @param {number} days
 * @returns {Date}
 */
export function sameGameClockDaysLater(date, days) {
  const { hour, minute, second } = gameDateParts(date);
  const wallMs = ((hour * 60 + minute) * 60 + second) * 1000;
  const subSecondMs = new Date(date).getTime() % 1000;
  const targetIndex = gameDayIndex(date) + days;
  const guess = startOfGameDayIndex(targetIndex).getTime() + wallMs;
  // Where the guess actually landed on the Eastern clock, measured from the
  // target day's midnight (it can spill into the next day near midnight).
  const landed = gameDateParts(guess);
  const landedMs =
    (gameDayIndex(guess) - targetIndex) * 24 * 3_600_000 +
    ((landed.hour * 60 + landed.minute) * 60 + landed.second) * 1000;
  return new Date(guess - (landedMs - wallMs) + subSecondMs);
}

/**
 * The Eastern game month of an instant as 'YYYY-MM'. The codebase had no game
 * month before the leaderboard redesign (Equoria-y3nia): a game month is the
 * Eastern calendar month, so it rolls over at 00:00 Eastern on the 1st.
 * @param {Date|string|number} [date=new Date()]
 * @returns {string}
 */
export function gameMonthKey(date = new Date()) {
  const { year, month } = gameDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * The instant of 00:00 Eastern on the 1st of the instant's game month.
 * @param {Date|string|number} [date=new Date()]
 * @returns {Date}
 */
export function startOfGameMonth(date = new Date()) {
  const { year, month } = gameDateParts(date);
  return startOfGameDayIndex(Date.UTC(year, month - 1, 1) / 86_400_000);
}
