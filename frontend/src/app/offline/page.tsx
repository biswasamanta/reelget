export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30">
        <span className="text-white font-black text-3xl">R</span>
      </div>
      <h1 className="text-3xl font-black text-white mb-3">You&apos;re offline</h1>
      <p className="text-slate-400 text-base max-w-sm mb-8">
        No internet connection. Connect to Wi-Fi or mobile data to download videos.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold px-8 py-3 rounded-xl hover:opacity-90 transition"
      >
        Try again
      </button>
    </div>
  );
}
