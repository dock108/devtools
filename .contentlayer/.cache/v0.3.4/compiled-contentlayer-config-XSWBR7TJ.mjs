// contentlayer.config.ts
import { defineDocumentType, makeSource } from "contentlayer/source-files";

// lib/contentlayer.ts
var computedFields = {
  slug: {
    type: "string",
    resolve: (doc) => doc._raw.flattenedPath.replace(/^blog\/?/, "")
    // Remove 'blog/' prefix
  },
  slugAsParams: {
    type: "string",
    resolve: (doc) => doc._raw.flattenedPath.split("/").slice(1).join("/")
    // Extract slug parts after 'blog'
  },
  url: {
    type: "string",
    resolve: (doc) => `/blog/${doc._raw.flattenedPath.replace(/^blog\/?/, "")}`
  }
};

// contentlayer.config.ts
var Blog = defineDocumentType(() => ({
  name: "Blog",
  filePathPattern: `blog/**/*.mdx`,
  // Path relative to contentDirPath
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    description: { type: "string", required: true },
    date: { type: "date", required: true },
    tags: { type: "list", of: { type: "string" }, default: [] },
    image: { type: "string", required: false }
  },
  computedFields
  // Add slug, url etc.
}));
var contentlayer_config_default = makeSource({
  contentDirPath: "content",
  // Root directory for content
  documentTypes: [Blog],
  mdx: {
    // Add remark/rehype plugins if needed, e.g. for syntax highlighting
    // remarkPlugins: [],
    // rehypePlugins: [],
  }
});
export {
  Blog,
  contentlayer_config_default as default
};
//# sourceMappingURL=compiled-contentlayer-config-XSWBR7TJ.mjs.map
