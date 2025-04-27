import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Mock fs functions
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Import the getDocBySlug module dynamically to avoid path resolution issues in ESM
const importGetAllDocs = async () => {
  // Need to use dynamic import for ESM compatibility
  const { getAllDocs } = await import('../../lib/mdx/getDocBySlug.js');
  return { getAllDocs };
};

describe('getAllDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should return at least 5 documentation slugs', async () => {
    // Mock the file system to return our expected docs
    const mockFiles = [
      { name: 'getting-started.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'alerts.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'rules-and-risk.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'notifications.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'faq.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'index.mdx', isDirectory: () => false, path: 'content/docs' },
    ];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockFiles);

    // Import the function
    const { getAllDocs } = await importGetAllDocs();

    // Call the function
    const result = await getAllDocs();

    // Verify results
    expect(result).toHaveLength(6); // 5 required docs + index
    expect(result).toContainEqual(['getting-started']);
    expect(result).toContainEqual(['alerts']);
    expect(result).toContainEqual(['rules-and-risk']);
    expect(result).toContainEqual(['notifications']);
    expect(result).toContainEqual(['faq']);

    // Verify readdir was called correctly
    expect(fs.readdir).toHaveBeenCalledTimes(1);
  });
});
