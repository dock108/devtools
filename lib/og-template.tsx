import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };

export default function template({
  title,
  subtitle,
  accent = '#38bdf8',
}: {
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return new ImageResponse(
    (
      <div
        tw="flex h-full w-full flex-col justify-center bg-white px-24"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.03), transparent 60%)',
        }}
      >
        <div tw="flex items-center text-[42px] font-bold uppercase text-gray-900 mb-10 tracking-[.2em]">
          DOCK108
        </div>
        <div
          tw="text-[60px] leading-[1.1] font-black text-gray-900"
          style={{ color: accent }}
        >
          {title}
        </div>
        {subtitle && (
          <div tw="mt-8 text-[32px] text-gray-700 max-w-[900px]">{subtitle}</div>
        )}
      </div>
    ),
    { ...size }
  );
} 