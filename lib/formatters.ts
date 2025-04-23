/**
 * Shared Intl formatters — create once, reuse everywhere.
 * Saves per-render instantiation cost.
 */
export const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeStyle: 'short',
  dateStyle: 'short',
});

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
}); 