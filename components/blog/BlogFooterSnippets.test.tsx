import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BlogFooterSnippets } from './BlogFooterSnippets';
import { getAllPosts, PostMeta } from '@/lib/blog';

// Mock the getAllPosts function
vi.mock('@/lib/blog', () => ({
  getAllPosts: vi.fn(),
}));

// Mock the formatDate function if it causes issues (e.g., locale)
vi.mock('@/lib/date', () => ({
  formatDate: (date: string) => new Date(date).toLocaleDateString('en-US'),
}));

const mockPosts: PostMeta[] = [
  {
    slug: 'post-3',
    title: 'Latest Post 3',
    date: '2025-04-27',
    excerpt: 'Excerpt for post 3...',
    readingTime: '3 min read',
    tags: ['latest'],
  },
  {
    slug: 'post-2',
    title: 'Second Post 2',
    date: '2025-04-26',
    excerpt: 'Excerpt for post 2...',
    readingTime: '5 min read',
  },
  {
    slug: 'post-1',
    title: 'Third Post 1',
    date: '2025-04-25',
    excerpt: 'Excerpt for post 1...',
    readingTime: '2 min read',
    tags: ['old', 'test'],
  },
  {
    slug: 'post-0',
    title: 'Fourth Post 0 (Should not appear)',
    date: '2025-04-24',
    excerpt: 'Excerpt for post 0...',
    readingTime: '1 min read',
  },
];

describe('BlogFooterSnippets', () => {
  it('renders the latest 3 posts', async () => {
    // Setup mock return value for getAllPosts
    (getAllPosts as vi.Mock).mockReturnValue(mockPosts);

    // Render the component (it's async, so use await with findBy* or waitFor)
    render(<BlogFooterSnippets />);

    // Wait for the component to render the posts
    // Check for the heading
    await screen.findByRole('heading', { name: /from the blog/i });

    // Check that exactly 3 links are rendered (one for each snippet card)
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);

    // Check titles and hrefs of the rendered posts
    expect(screen.getByText('Latest Post 3')).toBeInTheDocument();
    expect(screen.getByText('Second Post 2')).toBeInTheDocument();
    expect(screen.getByText('Third Post 1')).toBeInTheDocument();
    expect(screen.queryByText('Fourth Post 0 (Should not appear)')).not.toBeInTheDocument();

    expect(links[0]).toHaveAttribute('href', '/blog/post-3');
    expect(links[1]).toHaveAttribute('href', '/blog/post-2');
    expect(links[2]).toHaveAttribute('href', '/blog/post-1');
  });

  it('renders nothing if there are no posts', async () => {
    (getAllPosts as vi.Mock).mockReturnValue([]);

    const { container } = render(<BlogFooterSnippets />);

    // Wait slightly to ensure async operations could complete
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
    expect(screen.queryByRole('heading', { name: /from the blog/i })).not.toBeInTheDocument();
  });
});
