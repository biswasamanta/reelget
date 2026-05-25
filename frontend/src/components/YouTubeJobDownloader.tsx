'use client';

import { useState, useEffect, useRef } from 'react';

type JobStatus = 'idle' | 'pending' | 'processing' | 'done' | 'error';

interface Props {
  videoUrl: string;
  quality: 'hd' | 'sd' | 'audio';
  trimStart?: string;
  trimEnd?: string;
  apiBase: string;
}

export default function YouTubeJobDownloader({ videoUrl, quality, trimStart, trimEnd, apiBase }: Props) {
  const [jobId,    setJobId]    = useState<string | null>(null);
  const [status,   setStatus]   = useState<JobStatus>('idle');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function reset() {
    esRef.current?.close();
    setJobId(null); setStatus('idle');
    setFileSize(null); setFilename(null); setError(null);
  }

  async function startJob() {
    reset();
    setStatus('pending');
    const p = new URLSearchParams({ url: videoUrl, quality });
    if (trimStart) p.set('start', trimStart);
    if (trimEnd)   p.set('end', trimEnd);

    try {
      const res  = await fetch(`${apiBase}/api/job?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to queue job');
      setJobId(data.job_id);
      // Open SSE stream
      const es = new EventSource(`${apiBase}/api/job/${data.job_id}/events`);
      esRef.current = es;
      es.onmessage = (e) => {
        const d = JSON.parse(e.data);
        setStatus(d.status);
        if (d.file_size) setFileSize(d.file_size);
        if (d.error)     setError(d.error);
        if (d.status === 'done' || d.status === 'error') es.close();
      };
      es.onerror = () => {
        es.close();
        // Fall back to polling if SSE fails
        pollStatus(data.job_id);
      };
    } catch (ex: unknown) {
      setStatus('error');
      setError(ex instanceof Error ? ex.message : 'Unknown error');
    }
  }

  async function pollStatus(jid: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res  = await fetch(`${apiBase}/api/job/${jid}`);
        const data = await res.json();
        setStatus(data.status);
        if (data.file_size) setFileSize(data.file_size);
        if (data.filename)  setFilename(data.filename);
        if (data.error)     setError(data.error);
        if (data.status === 'done' || data.status === 'error') return;
      } catch { /* ignore */ }
    }
    setStatus('error');
    setError('Timed out waiting for download');
  }

  useEffect(() => () => esRef.current?.close(), []);

  const fmtBytes = (n: number) =>
    n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${(n / 1000).toFixed(0)} KB`;

  const qualityLabels = { hd: 'HD 720p', sd: 'SD 360p', audio: 'Audio M4A' };

  if (status === 'idle') {
    return (
      <button
        onClick={startJob}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-teal-400/50 text-teal-600 font-semibold py-2.5 px-4 rounded-xl text-sm hover:bg-teal-50 transition"
      >
        🔄 Queue background download ({qualityLabels[quality]})
      </button>
    );
  }

  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-700">
          {status === 'pending'    && '⏳ Queued…'}
          {status === 'processing' && '⚙️ Downloading in background…'}
          {status === 'done'       && '✅ Ready to save'}
          {status === 'error'      && '❌ Failed'}
        </span>
        <button onClick={reset} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      {(status === 'pending' || status === 'processing') && (
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full w-2/5 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full animate-dl-progress" />
        </div>
      )}

      {status === 'done' && jobId && (
        <a
          href={`${apiBase}/api/job/${jobId}/stream`}
          download={filename || undefined}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-2.5 px-4 rounded-xl hover:opacity-90 transition"
        >
          ⬇ Save file {fileSize ? `(${fmtBytes(fileSize)})` : ''}
        </a>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-red-600 text-xs">{error}</p>
          <button onClick={startJob} className="text-xs text-teal-600 underline">Retry</button>
        </div>
      )}
    </div>
  );
}
