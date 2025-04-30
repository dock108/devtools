import { ImageResponse } from '@vercel/og';

export const size = { width: 1200, height: 630 };

interface OgTemplateProps {
  title: string;
  subtitle?: string;
  accent?: string; // Keep accent for potential future use
}

export default function template({ title, subtitle }: OgTemplateProps) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a', // Dark background (slate-900 approx)
          color: 'white',
          fontFamily: '"Inter", sans-serif', // Assuming Inter font
          padding: '60px',
        }}
      >
        {/* Logo Placeholder - Assumes logo.png is in public/ */}
        <img
          src={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/logo.png`}
          width="140" // Match header logo width
          height="32" // Match header logo height
          style={{
            position: 'absolute',
            top: 40,
            left: 60,
          }}
        />

        {/* Main Content Area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '900px',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: '20px',
              color: '#f8fafc', // Lighter text (slate-50 approx)
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: '36px',
                color: '#94a3b8', // Muted text (slate-400 approx)
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      // TODO: Add font fetching if needed
      // fonts: [
      //   {
      //     name: 'Inter',
      //     data: await fetch(new URL('../../assets/Inter-Regular.woff', import.meta.url)).then((res) => res.arrayBuffer()),
      //     weight: 400,
      //     style: 'normal',
      //   },
      // ],
    }
  );
} 