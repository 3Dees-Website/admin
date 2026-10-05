// Mirrors csvEscape in backend/src/utils/csvExport.js — that file is the
// source of truth. Change both together so browser-built CSVs follow the same
// rules as the server exports.

// A cell starting with one of these is read by Excel/Sheets as a formula.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
// Digits, spaces and + - ( ) . only — phone numbers and plain numbers. With no
// letters there is no function to call, so these are left as they are.
const NUMERIC_ONLY = /^[\d\s().+-]+$/;

/**
 * Quote a value for CSV and neutralise spreadsheet formulas: a value that
 * would be read as a formula gets a leading single quote, so it is shown as
 * text. Phone-number-like values (e.g. "+234 801 234 5678") are exempt.
 */
export const csvEscape = (value) => {
  let text = String(value ?? '');
  if (FORMULA_TRIGGER.test(text) && !NUMERIC_ONLY.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
};
