'use client';

import { useState } from 'react';

export type PlaylistItem = {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  duration?: number;
  uploader?: string;
};

export type PlaylistData = {
  title: string;
  thumbnail: string;
  uploader: string;
  total: number;
  items: PlaylistItem[];
};

function formatDuration(secs?: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistResult({
  data,
  apiBase,
}: {
  data: PlaylistData;
  apiBase: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(prev =>
      prev.size === data.items.length
        ? new Set()
        : new Set(data.items.map(i => i.id))
    );

  const allSelected = selected.size === data.items.length;

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        {data.thumbnail && (
          <img src={data.thumbnail} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 font-semibold text-sm truncate">{data.title}</p>
          <p className="text-gray-400 text-xs">{data.uploader} · {data.total} videos</p>
        </div>
      </div>

      {/* Select all */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <button
          onClick={toggleAll}
          className="text-xs font-semibold text-teal-600 hover:text-teal-800 transition"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-xs text-gray-400">{selected.size} selected</span>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {data.items.map(item => {
          const checked = selected.has(item.id);
          const downloadUrl = `${apiBase}/api/proxy?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.title)}&ext=mp4`;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer ${checked ? 'bg-teal-50' : ''}`}
              onClick={() => toggle(item.id)}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${checked ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
                {checked && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
              {/* Thumbnail */}
              <div className="relative shrink-0">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="w-20 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-20 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">▶</div>
                )}
                {item.duration && (
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
                    {formatDuration(item.duration)}
                  </span>
                )}
              </div>
              {/* Title */}
              <p className="flex-1 min-w-0 text-xs font-medium text-gray-700 line-clamp-2">{item.title}</p>
              {/* Direct download */}
              <a
                href={downloadUrl}
                download
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-2 text-gray-400 hover:text-teal-600 transition"
                title="Download this video"
              >
                ⬇
              </a>
            </div>
          );
        })}
      </div>

      {/* Download selected */}
      {selected.size > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-3">
            Downloading multiple files — your browser will open each one.
          </p>
          <div className="flex flex-wrap gap-2">
            {data.items
              .filter(i => selected.has(i.id))
              .map(item => (
                <a
                  key={item.id}
                  href={`${apiBase}/api/proxy?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.title)}&ext=mp4`}
                  download
                  className="flex-1 min-w-[140px] text-center text-xs font-semibold py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:opacity-90 transition truncate"
                >
                  ⬇ {item.title.slice(0, 30)}…
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
