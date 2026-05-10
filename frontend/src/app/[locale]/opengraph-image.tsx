import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PLATFORMS = ['📸 Instagram', '🎵 TikTok', '👍 Facebook', '▶️ YouTube', '🐦 Twitter'];

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 420, height: 420, borderRadius: '50%',
          background: 'rgba(34,211,238,0.18)',
          filter: 'blur(60px)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, right: -80,
          width: 420, height: 420, borderRadius: '50%',
          background: 'rgba(139,92,246,0.18)',
          filter: 'blur(60px)',
          display: 'flex',
        }} />

        {/* Logo box */}
        <div style={{
          width: 72, height: 72,
          background: 'linear-gradient(135deg, #22d3ee, #14b8a6)',
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          fontSize: 36,
          color: 'white',
          fontWeight: 900,
        }}>
          V
        </div>

        {/* Title */}
        <div style={{
          fontSize: 88,
          fontWeight: 900,
          color: '#ffffff',
          marginBottom: 14,
          letterSpacing: -3,
          display: 'flex',
        }}>
          Reel<span style={{ color: '#22d3ee' }}>Get</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 26,
          color: '#94a3b8',
          marginBottom: 44,
          textAlign: 'center',
          maxWidth: 680,
          display: 'flex',
        }}>
          Download videos free · No login · No app needed
        </div>

        {/* Platform pills */}
        <div style={{ display: 'flex', gap: 10 }}>
          {PLATFORMS.map((p) => (
            <div
              key={p}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 50,
                padding: '8px 20px',
                color: '#e2e8f0',
                fontSize: 17,
                display: 'flex',
              }}
            >
              {p}
            </div>
          ))}
        </div>

        {/* Domain watermark */}
        <div style={{
          position: 'absolute',
          bottom: 36,
          right: 56,
          color: '#334155',
          fontSize: 20,
          display: 'flex',
        }}>
          reelget.com
        </div>
      </div>
    ),
    { ...size }
  );
}
