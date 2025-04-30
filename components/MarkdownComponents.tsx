import Link from 'next/link';
import type { Components } from 'react-markdown';

// Define custom renderers for Markdown elements
export const markdownComponents: Components = {
  // Paragraphs
  p: (props) => <p className="mb-4" {...props} />,

  // Headings (adjust spacing/sizing as needed)
  h1: (props) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
  h2: (props) => <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />,
  h3: (props) => <h3 className="text-xl font-semibold mt-5 mb-2" {...props} />,
  h4: (props) => <h4 className="text-lg font-semibold mt-4 mb-1" {...props} />,

  // Links
  a: (props) => {
    const { href, children } = props;
    // Use NextLink for internal links, standard anchor for external
    if (href && href.startsWith('/')) {
      return (
        <Link href={href}>
          <span className="text-primary hover:underline cursor-pointer">{children}</span>
        </Link>
      );
    }
    return (
      <a
        href={href}
        className="text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    );
  },

  // Lists
  ul: (props) => <ul className="list-disc list-inside mb-4 pl-4" {...props} />,
  ol: (props) => <ol className="list-decimal list-inside mb-4 pl-4" {...props} />,
  li: (props) => <li className="mb-2" {...props} />,

  // Blockquotes
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-4"
      {...props}
    />
  ),

  // Inline Code
  code: (props) => (
    <code className="bg-slate-100 rounded px-1 py-0.5 text-sm font-mono text-pink-600" {...props} />
  ),

  // Code Blocks (basic wrapper, needs syntax highlighting solution separately)
  pre: (props) => (
    <pre
      className="bg-slate-900 text-white rounded p-4 my-4 overflow-x-auto font-mono text-sm"
      {...props}
    />
  ),

  // Add other elements like hr, strong, em, img as needed
  hr: (props) => <hr className="my-8 border-slate-200" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  // Basic image styling (might need more advanced handling for Next Image)
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="my-4 rounded max-w-full h-auto mx-auto" alt={props.alt || ''} {...props} />
  ),
};
