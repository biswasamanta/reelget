import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #22d3ee 0%, #14b8a6 100%)',
          borderRadius: '40px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontWeight: 900,
            fontSize: 120,
            fontFamily: 'sans-serif',
            lineHeight: 1,
          }}
        >
          R
        </span>
      </div>
    ),
    { ...size },
  );
}
