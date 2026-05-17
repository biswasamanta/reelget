'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'or', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ar', label: 'العربية', flag: '🌍' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'tl', label: 'Filipino', flag: '🇵🇭' },
  // African languages
  { code: 'sw', label: 'Kiswahili', flag: '🌍' },
  { code: 'ha', label: 'Hausa', flag: '🌍' },
  { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
  { code: 'yo', label: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig', label: 'Igbo', flag: '🇳🇬' },
  { code: 'zu', label: 'isiZulu', flag: '🇿🇦' },
  { code: 'xh', label: 'isiXhosa', flag: '🇿🇦' },
  { code: 'af', label: 'Afrikaans', flag: '🇿🇦' },
  { code: 'so', label: 'Soomaali', flag: '🇸🇴' },
  { code: 'om', label: 'Oromoo', flag: '🇪🇹' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
  { code: 'mg', label: 'Malagasy', flag: '🇲🇬' },
  { code: 'ny', label: 'Chichewa', flag: '🇲🇼' },
  { code: 'sn', label: 'ChiShona', flag: '🇿🇼' },
  { code: 'st', label: 'Sesotho', flag: '🇱🇸' },
  { code: 'tn', label: 'Setswana', flag: '🇧🇼' },
  { code: 'ln', label: 'Lingála', flag: '🇨🇩' },
  { code: 'wo', label: 'Wolof', flag: '🇸🇳' },
  { code: 'ff', label: 'Fulfulde', flag: '🌍' },
  { code: 'ti', label: 'ትግርኛ', flag: '🇪🇷' },
  { code: 'ak', label: 'Akan / Twi', flag: '🇬🇭' },
];

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === currentLocale) || LANGUAGES[0];

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
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-teal-600 font-medium border border-gray-200 rounded-lg px-2 py-1"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-y-auto max-h-72">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLocale(lang.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-teal-50 text-left ${
                lang.code === currentLocale ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-700'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
