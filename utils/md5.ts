/**
 * Simple MD5 hash function for Gravatar URLs
 * @param input String to hash
 * @returns MD5 hash of the input string
 */
export function md5(input: string): string {
  // For a production app, you should use a proper crypto library
  // This is a simple implementation for demo purposes
  return Array.from(
    new Uint8Array(
      new TextEncoder().encode(input.trim().toLowerCase())
    )
  ).reduce(
    (hash, char) => ((hash << 5) - hash) + char, 0
  ).toString(16).replace(/^-/, '');
} 