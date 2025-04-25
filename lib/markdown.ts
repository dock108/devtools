import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'content/blog');

export interface PostData {
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
  url: string;
}

export function getAllPostSlugs() {
  try {
    const fileNames = fs.readdirSync(postsDirectory);
    return fileNames
      .filter((fileName) => fileName.endsWith('.mdx')) // Assuming files are still .mdx
      .map((fileName) => {
        return {
          params: {
            slug: fileName.replace(/\.mdx$/, ''),
          },
        };
      });
  } catch (error) {
    console.error('Error reading blog post directory:', error);
    return []; // Return empty array on error
  }
}

export async function getPostData(slug: string): Promise<PostData | null> {
  const fullPath = path.join(postsDirectory, `${slug}.mdx`); // Assuming files are still .mdx
  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');

    // Use gray-matter to parse the post metadata section
    const matterResult = matter(fileContents);

    // Basic validation
    if (!matterResult.data.title || !matterResult.data.date || !matterResult.data.description) {
        console.warn(`Post ${slug} is missing required frontmatter (title, date, description).`);
        // Optionally return null or throw an error, depending on desired handling
        // return null;
    }


    // Combine the data with the slug and content
    return {
      slug,
      title: matterResult.data.title || 'Untitled Post',
      description: matterResult.data.description || 'No description available.',
      date: matterResult.data.date || new Date().toISOString(),
      content: matterResult.content,
      url: `/blog/${slug}`,
    };
  } catch (error) {
    console.error(`Error reading or parsing blog post ${slug}:`, error);
    return null; // Return null if file reading or parsing fails
  }
}

// Optional: Function to get all posts sorted by date (useful for blog index page)
export async function getAllPostsSorted(): Promise<PostData[]> {
    const slugs = getAllPostSlugs();
    const allPostsData = await Promise.all(
        slugs.map(({ params }) => getPostData(params.slug))
    );

    // Filter out null posts (in case of errors) and sort posts by date in descending order
    return allPostsData
        .filter((post): post is PostData => post !== null)
        .sort((a, b) => {
            if (a.date < b.date) {
                return 1;
            } else {
                return -1;
            }
        });
} 