import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { generateRssFeed } from './generate-rss';
import { getAllPosts } from '../lib/blog'; // Adjust path if necessary

// Mock the fs.writeFileSync to avoid actual file writing during tests
vi.mock('fs');

describe('generateRssFeed', () => {
  let posts: any[];
  let generatedXml: string | undefined;

  beforeEach(async () => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Mock the implementation of writeFileSync
    const writeFileSyncMock = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    // Get actual posts
    posts = getAllPosts();

    // Generate the feed (and capture the XML content)
    generatedXml = await generateRssFeed();

    // Optionally check if writeFileSync was called (can be removed if only XML content is needed)
    // expect(writeFileSyncMock).toHaveBeenCalled();
  });

  it('should generate a non-empty XML feed', () => {
    expect(generatedXml).toBeDefined();
    expect(generatedXml).not.toBe('');
  });

  it('should contain the correct number of items corresponding to posts', () => {
    expect(generatedXml).toBeDefined();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feedData = parser.parse(generatedXml!);

    // Depending on the RSS library's output structure, path might be rss.channel.item or feed.entry
    const items = feedData?.rss?.channel?.item || feedData?.feed?.entry || [];

    expect(items).toBeInstanceOf(Array);
    expect(items.length).toBe(posts.length);
  });

  it('should include the title of the latest post in the feed', () => {
    expect(generatedXml).toBeDefined();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feedData = parser.parse(generatedXml!);
    const items = feedData?.rss?.channel?.item || feedData?.feed?.entry || [];

    expect(items.length).toBeGreaterThan(0);

    // Assuming getAllPosts returns posts sorted newest first
    const latestPostTitle = posts[0].title;
    const firstFeedItemTitle = items[0].title;

    expect(firstFeedItemTitle).toBe(latestPostTitle);
  });

  // Optional: Add more specific checks for other fields if needed
  it('should contain expected feed metadata (title, link)', () => {
    expect(generatedXml).toBeDefined();
    const parser = new XMLParser({ ignoreAttributes: false });
    const feedData = parser.parse(generatedXml!);

    const channel = feedData?.rss?.channel;
    const feed = feedData?.feed;

    if (channel) {
      expect(channel.title).toBe('Stripe Guardian Blog');
      expect(channel.link).toBe(process.env.SITE_URL || 'http://localhost:3000');
    } else if (feed) {
      expect(feed.title).toBe('Stripe Guardian Blog');
      // Atom feeds might use link[@rel='alternate']
      const siteLink = Array.isArray(feed.link)
        ? feed.link.find((l: any) => l['@_rel'] === 'alternate')
        : feed.link;
      expect(siteLink['@_href']).toBe(process.env.SITE_URL || 'http://localhost:3000');
    }
  });
});
