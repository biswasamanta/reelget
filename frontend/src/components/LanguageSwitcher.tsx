'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const LANGUAGE_GROUPS = [
  {
    group: 'Global',
    languages: [
      { code: 'en', label: 'English', flag: '🇬🇧' },
      { code: 'es', label: 'Español', flag: '🇪🇸' },
      { code: 'fr', label: 'Français', flag: '🇫🇷' },
      { code: 'pt', label: 'Português', flag: '🇧🇷' },
      { code: 'ru', label: 'Русский', flag: '🇷🇺' },
      { code: 'ar', label: 'العربية', flag: '🌍' },
    ],
  },
  {
    group: 'Asia',
    languages: [
      { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
      { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
      { code: 'or', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
      { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
      { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
      { code: 'ur', label: 'اردو', flag: '🇵🇰' },
      { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
      { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
      { code: 'tl', label: 'Filipino', flag: '🇵🇭' },
      { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
      { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
      { code: 'ko', label: '한국어', flag: '🇰🇷' },
    ],
  },
  {
    group: 'Africa',
    languages: [
      { code: 'sw', label: 'Kiswahili', flag: '🌍' },
      { code: 'ha', label: 'Hausa', flag: '🌍' },
      { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
      { code: 'yo', label: 'Yorùbá', flag: '🇳🇬' },
      { code: 'ig', label: 'Igbo', flag: '🇳🇬' },
      { code: 'ff', label: 'Fulfulde', flag: '🌍' },
      { code: 'wo', label: 'Wolof', flag: '🇸🇳' },
      { code: 'ak', label: 'Akan / Twi', flag: '🇬🇭' },
      { code: 'ln', label: 'Lingála', flag: '🇨🇩' },
      { code: 'mg', label: 'Malagasy', flag: '🇲🇬' },
      { code: 'ny', label: 'Chichewa', flag: '🇲🇼' },
      { code: 'sn', label: 'ChiShona', flag: '🇿🇼' },
      { code: 'zu', label: 'isiZulu', flag: '🇿🇦' },
      { code: 'xh', label: 'isiXhosa', flag: '🇿🇦' },
      { code: 'af', label: 'Afrikaans', flag: '🇿🇦' },
      { code: 'st', label: 'Sesotho', flag: '🇱🇸' },
      { code: 'tn', label: 'Setswana', flag: '🇧🇼' },
      { code: 'so', label: 'Soomaali', flag: '🇸🇴' },
      { code: 'om', label: 'Oromoo', flag: '🇪🇹' },
      { code: 'ti', label: 'ትግርኛ', flag: '🇪🇷' },
      { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
    ],
  },
];

const ALL_LANGUAGES = LANGUAGE_GROUPS.flatMap((g) => g.languages);

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);

  const current = ALL_LANGUAGES.find((l) => l.code === currentLocale) || ALL_LANGUAGES[0];

  const q = query.trim().toLowerCase();

  // When searching, flatten into a single filtered list; otherwise show groups
  const isSearching = q.length > 0;
  const filteredFlat = isSearching
    ? ALL_LANGUAGES.filter(
        (l) => l.label.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
      )
    : [];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // Close on Escape, clear search on Escape if query present
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (query) {
          setQuery('');
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, query]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
      setQuery('');
      setAtBottom(false);
    }
  }, [open]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop <= el.clientHeight + 4);
  }

  function switchLocale(code: string) {
    const segments = pathname.split('/');
    segments[1] = code;
    router.push(segments.join('/') || '/');
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-teal-600 font-medium border border-gray-200 rounded-lg px-2 py-1"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 flex flex-col"
          style={{ maxHeight: 'min(480px, 70vh)' }}
        >
          {/* Search box */}
          <div className="p-2 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <span className="text-gray-400 text-xs">🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); listRef.current?.scrollTo(0, 0); }}
                placeholder="Search language..."
                className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                  className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable list */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="overflow-y-auto flex-1 rounded-b-xl"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#99f6e4 transparent' }}
          >
            {isSearching ? (
              // Flat filtered results
              filteredFlat.length > 0 ? (
                filteredFlat.map((lang) => (
                  <LanguageRow
                    key={lang.code}
                    lang={lang}
                    active={lang.code === currentLocale}
                    query={q}
                    onClick={() => switchLocale(lang.code)}
                  />
                ))
              ) : (
                <p className="text-center text-gray-400 text-xs py-6">No languages found</p>
              )
            ) : (
              // Grouped list
              LANGUAGE_GROUPS.map(({ group, languages }) => (
                <div key={group}>
                  <div className="sticky top-0 bg-gray-50 px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    {group}
                  </div>
                  {languages.map((lang) => (
                    <LanguageRow
                      key={lang.code}
                      lang={lang}
                      active={lang.code === currentLocale}
                      onClick={() => switchLocale(lang.code)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Bottom fade */}
          {!atBottom && !isSearching && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-xl bg-gradient-to-t from-white to-transparent" />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component — highlights matching query text
// ---------------------------------------------------------------------------
function LanguageRow({
  lang,
  active,
  query = '',
  onClick,
}: {
  lang: { code: string; label: string; flag: string };
  active: boolean;
  query?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-teal-50 text-left transition-colors ${
        active ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-700'
      }`}
    >
      <span className="text-base leading-none">{lang.flag}</span>
      <span className="flex-1">
        {query ? <Highlight text={lang.label} query={query} /> : lang.label}
      </span>
      {active && <span className="text-teal-500 text-xs">✓</span>}
    </button>
  );
}

// Highlights matching characters in the label
function Highlight({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-teal-100 text-teal-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
