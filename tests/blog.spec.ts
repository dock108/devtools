import { describe, it, expect } from 'vitest';
import { getAllPosts } from '@/lib/blog'; // Adjust path if needed

// Mock the fs module if running in an environment without file system access
// Or ensure tests run where fs is available (e.g., Node environment)

describe('Blog Utility Functions', () => {
  it('getAllPosts() should return at least 3 posts sorted by date descending', () => {
    const posts = getAllPosts();

    // Check if it returns an array
    expect(Array.isArray(posts)).toBe(true);

    // Check if there are at least 3 posts (based on the files created)
    // Note: This will fail if the MDX files don't exist or have invalid front matter
    expect(posts.length).toBeGreaterThanOrEqual(3);

    // Check if posts are sorted correctly (most recent first)
    if (posts.length >= 2) {
      const date1 = new Date(posts[0].date);
      const date2 = new Date(posts[1].date);
      expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
    }

    // Check if essential properties exist
    if (posts.length > 0) {
      expect(posts[0]).toHaveProperty('slug');
      expect(posts[0]).toHaveProperty('title');
      expect(posts[0]).toHaveProperty('date');
      expect(posts[0]).toHaveProperty('excerpt');
      expect(posts[0]).toHaveProperty('readingTime');
      // tags and image are optional
    }
  });

  // TODO: Add tests for getPostBySlug, getPrevNextPosts, etc.
  // TODO: Add RTL tests for BlogCard component
});
