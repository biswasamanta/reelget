'use client';
import { useEffect, useRef, useState } from 'react';

const FALLBACK = 52_000;

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toString();
}

export default function StatsBar() {
  const [totalDownloads, setTotalDownloads] = useState(FALLBACK);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${api}/api/counter`)
      .then((r) => r.json())
      .then((d) => { if (d.count > 0) setTotalDownloads(d.count); })
      .catch(() => {});
  }, []);

  const downloads = useCountUp(totalDownloads);
  const countries = useCountUp(50);

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-6">
      {/* Download counter */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
        </span>
        <span className="text-sm font-semibold text-white">
          {formatCount(downloads)}+
        </span>
        <span className="text-xs text-slate-400">videos downloaded</span>
      </div>

      {/* Countries */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
        <span className="text-sm">🌍</span>
        <span className="text-sm font-semibold text-white">{countries}+</span>
        <span className="text-xs text-slate-400">countries</span>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
        <span className="text-yellow-400 text-sm tracking-tight">★★★★★</span>
        <span className="text-xs text-slate-400">free forever</span>
      </div>
    </div>
  );
}
