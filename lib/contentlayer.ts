import type { ComputedFields } from 'contentlayer/source-files'

export const computedFields: ComputedFields = {
  slug: {
    type: 'string',
    resolve: (doc) => doc._raw.flattenedPath.replace(/^blog\/?/, ''), // Remove 'blog/' prefix
  },
  slugAsParams: {
    type: 'string',
    resolve: (doc) => doc._raw.flattenedPath.split('/').slice(1).join('/'), // Extract slug parts after 'blog'
  },
  url: {
    type: 'string',
    resolve: (doc) => `/blog/${doc._raw.flattenedPath.replace(/^blog\/?/, '')}`,
  },
} 