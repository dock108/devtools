import { defineDocumentType, makeSource } from 'contentlayer/source-files';
import { computedFields } from './lib/contentlayer'; // Assuming helper for slug etc.

export const Blog = defineDocumentType(() => ({
  name: 'Blog',
  filePathPattern: `blog/**/*.mdx`, // Path relative to contentDirPath
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    date: { type: 'date', required: true },
    tags: { type: 'list', of: { type: 'string' }, default: [] },
    image: { type: 'string', required: false },
  },
  computedFields, // Add slug, url etc.
}));

export default makeSource({
  contentDirPath: 'content', // Root directory for content
  documentTypes: [Blog],
  mdx: { 
    // Add remark/rehype plugins if needed, e.g. for syntax highlighting
    // remarkPlugins: [],
    // rehypePlugins: [],
  },
}); 