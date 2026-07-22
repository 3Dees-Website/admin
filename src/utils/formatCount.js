export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '0';

  const value = Number(n);
  const abs = Math.abs(value);
  if (abs < 1000) return String(value);

  const format = (divided, suffix) => {
    const rounded = Math.round(divided * 10) / 10;
    const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${str}${suffix}`;
  };

  return abs < 1_000_000 ? format(value / 1000, 'k') : format(value / 1_000_000, 'M');
}
