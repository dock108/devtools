/**
 * Shared formatters for currency, dates, and other common formats
 */

/**
 * Format a number as USD currency
 * @param value - The value to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  options: Partial<Intl.NumberFormatOptions> = {},
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });

  return formatter.format(value);
}

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
