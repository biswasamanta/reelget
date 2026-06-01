'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Stats {
  total_downloads: number;
  real_downloads?: number;
  total_visits?: number;
  top_pages?: { page: string; count: number; last_seen: string | null }[];
  conversions?: Record<string, number>;
  push_subscribers?: number;
  platform_counts: { platform: string; count: number; last_seen: string | null }[];
  top_ips_today:   { ip: string; today: number }[];
  cookie_alerts:   { platform: string; fail_count: number; last_seen: string | null; alerted_at: string | null }[];
  proxy_configured: boolean;
  telegram_configured: boolean;
  active_jobs: Record<string, string>;
  job_queue_size: number;
}

export default function AdminPage() {
  const [password, setPassword]   = useState('');
  const [authed,   setAuthed]     = useState(false);
  const [stats,    setStats]      = useState<Stats | null>(null);
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async (pw: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/admin/stats`, {
        headers: pw ? { Authorization: `Bearer ${pw}` } : {},
      });
      if (res.status === 401) { setError('Wrong password'); setAuthed(false); return; }
      if (!res.ok)            { setError(`Error ${res.status}`); return; }
      setStats(await res.json());
      setAuthed(true);
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30s when authenticated
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => fetchStats(password), 30_000);
    return () => clearInterval(id);
  }, [authed, password, fetchStats]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats(password);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm space-y-4 shadow-2xl border border-slate-700">
          <h1 className="text-white text-xl font-bold text-center">🔐 Admin Dashboard</h1>
          <input
            type="password"
            placeholder="Admin password (or leave blank if not set)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
          />
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    );
  }

  if (!stats) return null;

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString() : '—';

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">📊 ReelGet Admin</h1>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-slate-400 text-xs">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchStats(password)}
              disabled={loading}
              className="text-xs bg-slate-700 hover:bg-slate-600 transition px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {loading ? '…' : '↻ Refresh'}
            </button>
            <button
              onClick={() => setAuthed(false)}
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Downloads (real)', value: (stats.real_downloads ?? 0).toLocaleString(), icon: '⬇' },
            { label: 'Page Visits',      value: (stats.total_visits ?? 0).toLocaleString(), icon: '👁' },
            { label: 'Push Subscribers', value: (stats.push_subscribers ?? 0).toLocaleString(), icon: '🔔' },
            { label: 'PWA Installs',     value: (stats.conversions?.pwa_installed ?? 0).toLocaleString(), icon: '📲' },
          ].map(k => (
            <div key={k.label} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">{k.icon} {k.label}</p>
              <p className="text-white text-xl font-bold">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Secondary status row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Counter (vanity)', value: stats.total_downloads.toLocaleString(), icon: '🔢' },
            { label: 'Proxy',           value: stats.proxy_configured ? '✅ Configured' : '⚠️ Direct', icon: '🌐' },
            { label: 'Telegram Alerts', value: stats.telegram_configured ? '✅ On' : '❌ Off', icon: '📬' },
            { label: 'Active Jobs',     value: stats.job_queue_size,  icon: '⚙️' },
          ].map(k => (
            <div key={k.label} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-slate-400 text-xs mb-1">{k.icon} {k.label}</p>
              <p className="text-white text-base font-semibold">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Platform breakdown */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">📱 Downloads by Platform</h2>
          {stats.platform_counts.length === 0
            ? <p className="text-slate-500 text-sm">No data yet</p>
            : (
              <div className="space-y-2">
                {stats.platform_counts.map(p => {
                  const max = stats.platform_counts[0]?.count || 1;
                  return (
                    <div key={p.platform} className="flex items-center gap-3">
                      <span className="w-20 text-xs text-slate-400 capitalize">{p.platform}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500"
                          style={{ width: `${Math.round((p.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-12 text-right">{p.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Traffic — top pages by visits */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">👁 Traffic — Top Pages by Visits</h2>
          {(!stats.top_pages || stats.top_pages.length === 0)
            ? <p className="text-slate-500 text-sm">No visit data yet</p>
            : (
              <div className="space-y-2">
                {stats.top_pages.map(p => {
                  const max = stats.top_pages?.[0]?.count || 1;
                  return (
                    <div key={p.page} className="flex items-center gap-3">
                      <span className="w-44 text-xs text-slate-400 truncate" title={p.page}>{p.page}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                          style={{ width: `${Math.round((p.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-12 text-right">{p.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Conversions — retention funnel */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">🚀 Conversions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              { label: 'PWA Installs',   value: stats.conversions?.pwa_installed ?? 0 },
              { label: 'Push Subs',      value: stats.conversions?.push_subscribed ?? 0 },
              { label: 'Telegram Clicks',value: stats.conversions?.promo_click_telegram ?? 0 },
              { label: 'Extension Clicks',value: stats.conversions?.promo_click_extension ?? 0 },
            ].map(c => (
              <div key={c.label} className="bg-slate-900/50 rounded-xl py-3">
                <p className="text-white text-lg font-bold">{c.value.toLocaleString()}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cookie alerts */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">🍪 Cookie Alert Status</h2>
          {stats.cookie_alerts.length === 0
            ? <p className="text-slate-500 text-sm">No cookie errors recorded</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="pb-2">Platform</th>
                    <th className="pb-2">Failures</th>
                    <th className="pb-2 hidden sm:table-cell">Last seen</th>
                    <th className="pb-2 hidden sm:table-cell">Last alerted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {stats.cookie_alerts.map(a => (
                    <tr key={a.platform} className="py-1">
                      <td className="py-1.5 capitalize font-medium">{a.platform}</td>
                      <td className="py-1.5">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                          a.fail_count >= 3 ? 'bg-red-900/50 text-red-300' : 'bg-slate-700 text-slate-300'
                        }`}>{a.fail_count}</span>
                      </td>
                      <td className="py-1.5 text-slate-400 hidden sm:table-cell">{fmtDate(a.last_seen)}</td>
                      <td className="py-1.5 text-slate-400 hidden sm:table-cell">{fmtDate(a.alerted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Active jobs */}
        {Object.keys(stats.active_jobs).length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">⚙️ Active Jobs</h2>
            <div className="space-y-1">
              {Object.entries(stats.active_jobs).map(([jid, jstatus]) => (
                <div key={jid} className="flex items-center justify-between text-xs">
                  <code className="text-slate-400">{jid}</code>
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${
                    jstatus === 'done' ? 'bg-green-900/50 text-green-300' :
                    jstatus === 'error' ? 'bg-red-900/50 text-red-300' :
                    'bg-yellow-900/50 text-yellow-300'
                  }`}>{jstatus}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top IPs */}
        {stats.top_ips_today.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">🌍 Top IPs Today</h2>
            <div className="space-y-1">
              {stats.top_ips_today.map(r => (
                <div key={r.ip} className="flex items-center justify-between text-xs">
                  <code className="text-slate-400">{r.ip}</code>
                  <span className="text-slate-300 font-semibold">{r.today} downloads</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
