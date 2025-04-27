import React from 'react';
import Link from 'next/link';
import { PostMeta } from '@/lib/blog'; // Import the PostMeta type
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { formatDate } from '@/lib/date'; // Corrected path

interface BlogCardProps {
  post: PostMeta;
}

const BlogCard: React.FC<BlogCardProps> = ({ post }) => {
  const imageUrl = post.image || '/images/og-default.png'; // Use post image or default

  return (
    <Card className="flex flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <Link
        href={`/blog/${post.slug}`}
        aria-label={post.title}
        className="block focus:outline-none"
      >
        {/* Optional Image Section */}
        {/* 
        <div className="relative h-40 w-full">
            <Image 
                src={imageUrl}
                alt={`Cover image for ${post.title}`}
                fill
                style={{ objectFit: 'cover'}} 
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
             />
        </div> 
        */}
        <CardHeader>
          <CardTitle className="text-lg font-semibold leading-tight tracking-tight">
            {post.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <CardDescription className="text-sm text-muted-foreground line-clamp-3">
            {post.excerpt}
          </CardDescription>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {/* Optionally add reading time here if needed */}
          {/* <span className="mx-2">•</span> */}
          {/* <span>{post.readingTime}</span> */}
        </CardFooter>
      </Link>
    </Card>
  );
};

export default BlogCard;
