import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import { getAllDocs } from '@/lib/mdx/getDocBySlug';

// Mock the fs module - Add the 'default' key
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('getAllDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return an array of doc slugs', async () => {
    // Mock readdir to return a list of files
    const mockFiles = [
      { name: 'getting-started.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'subdir', isDirectory: () => true, path: 'content/docs' },
      { name: 'advanced.mdx', isDirectory: () => false, path: 'content/docs/subdir' },
      { name: 'index.mdx', isDirectory: () => false, path: 'content/docs' },
      { name: 'ignored.txt', isDirectory: () => false, path: 'content/docs' },
    ];

    // Now mock the function on the default export
    vi.mocked(fs.readdir).mockResolvedValueOnce(mockFiles as any);

    const result = await getAllDocs();

    expect(result).toEqual([['getting-started'], ['subdir', 'advanced'], ['index']]);
    expect(fs.readdir).toHaveBeenCalledTimes(1);
  });

  it('should return an empty array if the directory does not exist', async () => {
    // Mock readdir on the default export to throw an error
    vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('Directory not found'));

    const result = await getAllDocs();

    expect(result).toEqual([]);
    expect(fs.readdir).toHaveBeenCalledTimes(1);
  });
});
