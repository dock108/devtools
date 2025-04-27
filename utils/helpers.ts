// Placeholder for utility helper functions
export {};

// Utility helper functions for redirection and status handling

/**
 * Creates a URL for redirecting with an error message
 */
export function getErrorRedirect(path: string, message: string) {
  const params = new URLSearchParams();
  params.append('error', message);
  return `${path}?${params.toString()}`;
}

/**
 * Creates a URL for redirecting with a status message
 */
export function getStatusRedirect(path: string, status: string) {
  const params = new URLSearchParams();
  params.append('status', status);
  return `${path}?${params.toString()}`;
}

// Export additional utility functions as needed
