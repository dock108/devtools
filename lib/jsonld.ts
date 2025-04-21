export function productLD({
  name,
  description,
  url,
  image,
  price,
}: {
  name: string;
  description: string;
  url: string;
  image: string;
  price: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: [image],
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/PreOrder',
      price,
      priceCurrency: 'USD',
      url,
    },
    brand: {
      '@type': 'Brand',
      name: 'DOCK108',
    },
  } as const;
}

export function blogLD({
  title,
  description,
  url,
  image,
  date,
}: {
  title: string;
  description: string;
  url: string;
  image: string;
  date: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    image: [image],
    url,
    datePublished: date,
    author: {
      '@type': 'Organization',
      name: 'DOCK108',
    },
    publisher: {
      '@type': 'Organization',
      name: 'DOCK108',
    },
  } as const;
} 