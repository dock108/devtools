import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const postsDirectory = path.join(process.cwd(), 'content/blog');

export interface PostFrontMatter {
  title: string;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  excerpt: string;
  tags?: string[];
  image?: string; // Optional path to OG image
}

export interface PostMeta extends PostFrontMatter {
  slug: string;
  readingTime: string; // e.g., "5 min read"
}

export interface Post extends PostMeta {
  content: string; // MDX content string
}

export function getSortedPostsData(): PostMeta[] {
  // Get file names under /content/blog
  const fileNames = fs.readdirSync(postsDirectory);
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.mdx')) // Filter for MDX files
    .map((fileName) => {
      // Remove ".mdx" from file name to get id (slug)
      const slug = fileName.replace(/\.mdx$/, '');

      // Read markdown file as string
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      // Use gray-matter to parse the post metadata section
      const matterResult = matter(fileContents);

      // Combine the data with the slug and mandatory fields check
      if (!matterResult.data.title || !matterResult.data.date) {
        throw new Error(`Post "${slug}" is missing required frontmatter fields (title, date).`);
      }

      return {
        slug,
        ...(matterResult.data as Omit<PostFrontMatter, 'slug' | 'readingTime'>),
        readingTime: readingTime(matterResult.content).text,
      };
    });

  // Sort posts by date
  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getAllPostSlugs(): { params: { slug: string } }[] {
  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith('.mdx'))
    .map((fileName) => {
      return {
        params: {
          slug: fileName.replace(/\.mdx$/, ''),
        },
      };
    });
}

export async function getPostData(slug: string): Promise<Post | null> {
  const fullPath = path.join(postsDirectory, `${slug}.mdx`);
  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');

    // Use gray-matter to parse the post metadata section
    const matterResult = matter(fileContents);

    if (!matterResult.data.title || !matterResult.data.date) {
      throw new Error(`Post "${slug}" is missing required frontmatter fields (title, date).`);
    }

    // Combine the data with the slug and content
    const stats = readingTime(matterResult.content);
    return {
      slug,
      content: matterResult.content,
      ...(matterResult.data as Omit<PostFrontMatter, 'slug' | 'readingTime'>),
      readingTime: stats.text,
    };
  } catch (err) {
    // If file doesn't exist or other error, return null (or handle as needed)
    console.error(`Error reading post ${slug}:`, err);
    return null;
  }
}

// Helper function to get slugs
function getPostSlugs(): string[] {
  try {
    return fs.readdirSync(postsDirectory).filter((file) => /\.mdx?$/.test(file));
  } catch (e) {
    console.warn(`Could not read blog directory at ${postsDirectory}. No posts found.`);
    return [];
  }
}

// Get single post data by slug
export function getPostBySlug(slug: string): Post | null {
  const realSlug = slug.replace(/\.mdx?$/, '');
  const fileName = fs.readdirSync(postsDirectory).find((file) => file.startsWith(realSlug));

  if (!fileName) {
    console.warn(`Blog post not found for slug: ${realSlug}`);
    return null;
  }

  const fullPath = path.join(postsDirectory, fileName);

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    const stats = readingTime(content);

    return {
      slug: realSlug,
      readingTime: stats.text,
      ...(data as PostFrontMatter),
      content,
    };
  } catch (error) {
    console.error(`Error reading or parsing blog post ${fileName}:`, error);
    return null;
  }
}

// Get all posts, sorted by date
export function getAllPosts(): PostMeta[] {
  const slugs = getPostSlugs();
  const posts = slugs
    .map((slug) => {
      const post = getPostBySlug(slug);
      // Return only metadata, excluding content
      if (post) {
        const { content, ...meta } = post;
        return meta;
      }
      return null;
    })
    .filter((post): post is PostMeta => post !== null) // Type guard to remove nulls
    .sort((post1, post2) => (new Date(post1.date) > new Date(post2.date) ? -1 : 1)); // Sort descending

  return posts;
}

// Get Previous / Next post
export function getPrevNextPosts(currentSlug: string): {
  prev: PostMeta | null;
  next: PostMeta | null;
} {
  const allPosts = getAllPosts(); // Already sorted
  const currentIndex = allPosts.findIndex((post) => post.slug === currentSlug);

  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  const prev = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const next = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  return { prev, next };
}
