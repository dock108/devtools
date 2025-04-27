export function formatDate(isoDateString: string): string {
  if (!isoDateString) return '';
  try {
    return new Date(isoDateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', isoDateString, error);
    return 'Invalid Date'; // Fallback for invalid date strings
  }
}

// Add other date-related utilities here if needed
