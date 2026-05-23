export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white text-center px-4">
      <div>
        <p className="text-5xl mb-4">📡</p>
        <h1 className="text-2xl font-bold mb-2">You're offline</h1>
        <p className="text-gray-400 text-sm">Check your connection and try again.</p>
      </div>
    </div>
  );
}
