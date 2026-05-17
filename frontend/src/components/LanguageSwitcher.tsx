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

// Flat list for lookup
const ALL_LANGUAGES = LANGUAGE_GROUPS.flatMap((g) => g.languages);

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);

  const current = ALL_LANGUAGES.find((l) => l.code === currentLocale) || ALL_LANGUAGES[0];

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

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Track scroll position to hide/show bottom fade
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
  }

  return (
    <div className="relative" ref={containerRef}>
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
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 flex flex-col"
          style={{ maxHeight: 'min(480px, 70vh)' }}
        >
          {/* Scrollable list */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="overflow-y-auto flex-1 rounded-xl"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#99f6e4 transparent' }}
          >
            {LANGUAGE_GROUPS.map(({ group, languages }) => (
              <div key={group}>
                <div className="sticky top-0 bg-gray-50 px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  {group}
                </div>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => switchLocale(lang.code)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-teal-50 text-left transition-colors ${
                      lang.code === currentLocale
                        ? 'bg-teal-50 text-teal-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span>{lang.label}</span>
                    {lang.code === currentLocale && (
                      <span className="ml-auto text-teal-500 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Bottom fade — hidden when scrolled to end */}
          {!atBottom && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-xl bg-gradient-to-t from-white to-transparent" />
          )}
        </div>
      )}
    </div>
  );
}
