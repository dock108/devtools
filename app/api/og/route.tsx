import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'DOCK108'; // Default title

  // Optional: Load custom font
  // const interRegular = fetch(new URL('../../assets/Inter-Regular.ttf', import.meta.url)).then((res) => res.arrayBuffer());
  // const interBold = fetch(new URL('../../assets/Inter-Bold.ttf', import.meta.url)).then((res) => res.arrayBuffer());

  try {
    // Fetch font data if using custom fonts
    // const [regularFontData, boldFontData] = await Promise.all([interRegular, interBold]);

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
            backgroundColor: '#0f172a', // slate-900
            color: '#cbd5e1', // slate-300
            fontFamily: 'sans-serif', // Use default or specify loaded font
            padding: '60px',
          }}
        >
          {/* Optional: Add Logo */}
          {/* <img 
                src={`${process.env.NEXT_PUBLIC_SITE_URL}/logo-dark-mode.png`} 
                alt="DOCK108 Logo"
                width={150} // Adjust size
                style={{ marginBottom: '30px' }} 
            /> */}
          <h1
            style={{
              fontSize: '60px',
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: '20px',
              color: '#f8fafc', // slate-50
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: '24px', color: '#94a3b8' /* slate-400 */ }}>dock108.ai</p>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Optional: Add fonts if loaded
        // fonts: [
        //     { name: 'Inter', data: regularFontData, weight: 400, style: 'normal' },
        //     { name: 'Inter', data: boldFontData, weight: 700, style: 'normal' },
        // ],
      },
    );
  } catch (e: any) {
    console.error('Failed to generate OG image:', e.message);
    // Optional: Fallback to redirecting to the static default image
    // return Response.redirect(new URL('/images/og-default.png', process.env.NEXT_PUBLIC_SITE_URL).toString(), 302);
    return new Response(`Failed to generate the image`, { status: 500 });
  }
}
