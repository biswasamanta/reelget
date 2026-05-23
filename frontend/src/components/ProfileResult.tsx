'use client';

export type ProfileVideo = {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  duration?: number;
};

export type ProfileData = {
  platform: string;
  name: string;
  thumbnail: string;
  total: number;
  videos: ProfileVideo[];
};

function formatDuration(secs?: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ProfileResult({
  data,
  apiBase,
  onSelectVideo,
}: {
  data: ProfileData;
  apiBase: string;
  /** Called when user wants to download a single video via the main downloader. */
  onSelectVideo: (url: string) => void;
}) {
  return (
    <div className="mt-6 bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Profile header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        {data.thumbnail ? (
          <img src={data.thumbnail} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-gray-100" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {data.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 font-semibold text-sm">{data.name || 'Profile'}</p>
          <p className="text-gray-400 text-xs">{data.platform} · {data.total} recent videos</p>
        </div>
      </div>

      {/* Instagram cookie notice */}
      {data.platform === 'Instagram' && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-start gap-2">
          <span>ℹ️</span>
          <span>Instagram profile downloads work best for public accounts. Private accounts are not accessible.</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
        {data.videos.map((video, i) => (
          <button
            key={`${video.id}-${i}`}
            onClick={() => onSelectVideo(video.url)}
            className="group relative bg-white hover:bg-gray-50 transition"
            title={video.title}
          >
            <div className="relative aspect-square overflow-hidden bg-gray-200">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">▶</div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  ⬇ Download
                </div>
              </div>
              {video.duration && (
                <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                  {formatDuration(video.duration)}
                </span>
              )}
            </div>
            <p className="px-2 py-1.5 text-[10px] text-gray-600 line-clamp-1 text-left">{video.title}</p>
          </button>
        ))}
      </div>

      <p className="text-center text-gray-400 text-xs py-3">
        Tap any video to open it in the downloader
      </p>
    </div>
  );
}
