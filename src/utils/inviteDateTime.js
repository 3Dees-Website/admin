// Invitation date/time helpers. A <input type="datetime-local"> gives a bare
// "2026-11-05T14:30" with no offset, and the backend rejects an offset-less
// string, so the browser's own offset for that moment is always appended.

const pad = (n) => String(n).padStart(2, '0');

/** "+01:00" / "-05:00": the browser's offset from UTC on the given date. */
export function offsetLabel(date = new Date()) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** datetime-local value -> ISO 8601 with offset, or null if it isn't a date/time. */
export function localInputToInviteIso(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const when = new Date(value); // read as the browser's local time
  if (Number.isNaN(when.getTime())) return null;
  return `${m[1]}T${m[2]}:${m[3] || '00'}${offsetLabel(when)}`;
}

/** Stored ISO string -> datetime-local value, shown in the browser's own time. */
export function inviteIsoToLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** How the applicant's email shows it: Nigerian time. */
export function formatInviteWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} (WAT)`;
}
