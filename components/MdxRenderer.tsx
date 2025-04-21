'use client'

import { useMDXComponent } from 'next-contentlayer/hooks'
import { mdxComponents } from './mdx-components' // Assuming mdx-components is in the same directory or adjust path
import type { MDXComponents as MDXComponentsType } from 'mdx/types'

interface MdxRendererProps {
  code: string
  // Allow passing custom components if needed, merging with default
  components?: MDXComponentsType 
}

export function MdxRenderer({ code, components }: MdxRendererProps) {
  const MDXContent = useMDXComponent(code)

  // Merge default components with any custom ones passed as props
  const finalComponents = { ...mdxComponents, ...components }

  return <MDXContent components={finalComponents} />
} 