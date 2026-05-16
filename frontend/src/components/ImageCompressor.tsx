'use client';

import { useState } from 'react';

type ImageFormat = { label: string; url: string; ext: string };

interface Props {
  formats: ImageFormat[];
  title: string;
}

const PLATFORM_PRESETS = [
  { name: 'WhatsApp',    icon: '💬', maxW: 1600, maxH: 1600, quality: 0.72, desc: '< 5 MB' },
  { name: 'Instagram',   icon: '📸', maxW: 1080, maxH: 1350, quality: 0.85, desc: '1080 px' },
  { name: 'Story',       icon: '🎬', maxW: 1080, maxH: 1920, quality: 0.85, desc: '9 : 16' },
  { name: 'Twitter / X', icon: '🐦', maxW: 1200, maxH: 900,  quality: 0.82, desc: '1200 px' },
  { name: 'Facebook',    icon: '👍', maxW: 1200, maxH: 630,  quality: 0.82, desc: '1200 px' },
  { name: 'Pinterest',   icon: '📌', maxW: 1000, maxH: 1500, quality: 0.82, desc: '2 : 3' },
] as const;

type Preset = typeof PLATFORM_PRESETS[number];

export default function ImageCompressor({ formats, title }: Props) {
  const [mode, setMode] = useState<'platform' | 'compress'>('platform');
  const [quality, setQuality] = useState(70);
  const [selectedPreset, setSelectedPreset] = useState<Preset>(PLATFORM_PRESETS[0]);
  const [selectedFmt, setSelectedFmt] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [info, setInfo] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  async function handleProcess() {
    setProcessing(true);
    setInfo('');
    try {
      const fmt = formats[selectedFmt];
      // Fetch through our proxy to bypass CDN CORS restrictions
      const proxyUrl = `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=image&ext=${fmt.ext}`;

      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error('fetch failed');
      const blob = await resp.blob();
      const originalSize = blob.size;

      // Load into an Image element via blob URL
      const blobUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = blobUrl;
      });
      URL.revokeObjectURL(blobUrl);

      // Calculate target dimensions — maintain aspect ratio, cap at preset limits
      let tw = img.naturalWidth;
      let th = img.naturalHeight;
      const ratio = tw / th;

      if (mode === 'platform') {
        const { maxW, maxH } = selectedPreset;
        if (tw > maxW) { tw = maxW; th = Math.round(maxW / ratio); }
        if (th > maxH) { th = maxH; tw = Math.round(maxH * ratio); }
      }

      // Draw resized image on canvas
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; // white background for transparency
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(img, 0, 0, tw, th);

      const q = mode === 'compress' ? quality / 100 : selectedPreset.quality;
      const outBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', q)
      );

      // Trigger download
      const dlUrl = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      a.href = dlUrl;
      const safeName = title.slice(0, 40).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'image';
      const suffix = mode === 'platform' ? selectedPreset.name.replace(/\s/g, '_') : `q${quality}`;
      a.download = `${safeName}_${suffix}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);

      const savings = Math.round((1 - outBlob.size / originalSize) * 100);
      const kb = (outBlob.size / 1024).toFixed(0);
      setInfo(`✅ ${kb} KB · ${tw}×${th} px${savings > 0 ? ` · ${savings}% smaller` : ''}`);
    } catch {
      setInfo('❌ Could not process. Try downloading first and using a local app.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    /* Gradient border wrapper — catches the eye */
    <div className="mt-3 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 p-[2px] shadow-lg shadow-violet-500/30">
      <div className="bg-white rounded-[14px] p-4">

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🗜️</span>
          <span className="font-bold text-gray-800 text-sm">Compress &amp; Resize</span>
          <span className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
            FREE
          </span>
          <span className="ml-auto text-[11px] text-gray-400 font-medium">No upload needed</span>
        </div>

        {/* Image selector — only for carousels with multiple images */}
        {formats.length > 1 && (
          <select
            value={selectedFmt}
            onChange={(e) => setSelectedFmt(+e.target.value)}
            className="w-full mb-3 text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-violet-400"
          >
            {formats.map((f, i) => (
              <option key={i} value={i}>{f.label}</option>
            ))}
          </select>
        )}

        {/* Mode tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-3 gap-1">
          <button
            onClick={() => setMode('platform')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition ${
              mode === 'platform' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📐 Platform Size
          </button>
          <button
            onClick={() => setMode('compress')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition ${
              mode === 'compress' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🎚️ Custom Quality
          </button>
        </div>

        {/* Platform preset grid */}
        {mode === 'platform' && (
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {PLATFORM_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelectedPreset(p)}
                className={`flex flex-col items-center p-2 rounded-xl border-2 transition text-center ${
                  selectedPreset.name === p.name
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-100 hover:border-violet-200 hover:bg-violet-50/40'
                }`}
              >
                <span className="text-base leading-none">{p.icon}</span>
                <span className="text-[11px] font-semibold text-gray-700 leading-tight mt-1">{p.name}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Custom quality slider */}
        {mode === 'compress' && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>
                Quality:{' '}
                <span className="font-bold text-gray-700">{quality}%</span>
              </span>
              <span className="text-gray-400">
                {quality >= 80 ? 'High quality' : quality >= 55 ? 'Balanced' : 'Smallest file'}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={95}
              step={5}
              value={quality}
              onChange={(e) => setQuality(+e.target.value)}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleProcess}
          disabled={processing}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>⬇ Download Compressed Image</>
          )}
        </button>

        {info && (
          <p className="mt-2 text-center text-xs text-gray-500 font-medium">{info}</p>
        )}
      </div>
    </div>
  );
}
