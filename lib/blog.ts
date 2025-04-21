import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const postsDirectory = path.join(process.cwd(), 'content/blog')

export interface PostMeta {
  title: string
  description: string
  date: string // Keep as string for easier serialization
  tags: string[]
  image?: string
  slug: string
  url: string
}

export interface PostData extends PostMeta {
  content: string
}

export function getSortedPostsData(): PostMeta[] {
  // Get file names under /content/blog
  const fileNames = fs.readdirSync(postsDirectory)
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.mdx')) // Filter for MDX files
    .map((fileName) => {
      // Remove ".mdx" from file name to get id (slug)
      const slug = fileName.replace(/\.mdx$/, '')

      // Read markdown file as string
      const fullPath = path.join(postsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')

      // Use gray-matter to parse the post metadata section
      const matterResult = matter(fileContents)

      // Combine the data with the slug and mandatory fields check
      if (!matterResult.data.title || !matterResult.data.description || !matterResult.data.date) {
        throw new Error(`Post "${slug}" is missing required frontmatter fields (title, description, date).`);
      }

      return {
        slug,
        ...(matterResult.data as Omit<PostMeta, 'slug' | 'url'>),
        url: `/blog/${slug}`,
      }
    })

  // Sort posts by date
  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1
    } else {
      return -1
    }
  })
}

export function getAllPostSlugs(): { params: { slug: string } }[] {
  const fileNames = fs.readdirSync(postsDirectory)
  return fileNames
    .filter((fileName) => fileName.endsWith('.mdx'))
    .map((fileName) => {
      return {
        params: {
          slug: fileName.replace(/\.mdx$/, ''),
        },
      }
    })
}

export async function getPostData(slug: string): Promise<PostData | null> {
  const fullPath = path.join(postsDirectory, `${slug}.mdx`)
  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8')

    // Use gray-matter to parse the post metadata section
    const matterResult = matter(fileContents)

    if (!matterResult.data.title || !matterResult.data.description || !matterResult.data.date) {
       throw new Error(`Post "${slug}" is missing required frontmatter fields (title, description, date).`);
    }

    // Combine the data with the slug and content
    return {
      slug,
      content: matterResult.content,
      ...(matterResult.data as Omit<PostMeta, 'slug' | 'url'>),
      url: `/blog/${slug}`,
    }
  } catch (err) {
    // If file doesn't exist or other error, return null (or handle as needed)
    console.error(`Error reading post ${slug}:`, err);
    return null;
  }
} 