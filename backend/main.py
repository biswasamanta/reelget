from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import yt_dlp
import httpx
import re
import os
import json
import time
import tempfile
import asyncio
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import psycopg2
    from psycopg2.extras import DictCursor
    _PG_AVAILABLE = True
except ImportError:
    _PG_AVAILABLE = False

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="VidSave API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://192.168.86.229:3000,http://192.168.86.229:3001,https://reelget.com,https://www.reelget.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

SUPPORTED_PATTERN = re.compile(
    r"(instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co|pinterest\.com|pin\.it|snapchat\.com|story\.snapchat\.com|linkedin\.com|reddit\.com|redd\.it|vimeo\.com|dailymotion\.com|dai\.ly|twitch\.tv|clips\.twitch\.tv|threads\.net)"
)

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
# Universal cookie jar (Netscape format) exported from a browser logged into all platforms.
# Platform-specific vars override it for their respective domains.
COOKIES = os.environ.get("COOKIES", "")
YOUTUBE_COOKIES = os.environ.get("YOUTUBE_COOKIES", COOKIES)
INSTAGRAM_COOKIES = os.environ.get("INSTAGRAM_COOKIES", COOKIES)
# Outbound proxy for yt-dlp requests (helps bypass datacenter IP blocks).
# Format: http://user:pass@host:port  — leave unset to use direct connection.
PROXY_URL = os.environ.get("PROXY_URL", "")
# Telegram alerting — set both vars to enable cookie-expiry notifications
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_TTL = 6 * 3600  # 6 hours

ALLOWED_REGIONS = {"IN", "PK", "ID", "BR", "SA", "VN", "US", "NG", "KE"}

# In-memory download counter — resets on restart but starts from a base
_COUNTER_BASE = 52_000
_counter_session = 0

# ── PostgreSQL counter ────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ── Cloudflare R2 video cache ─────────────────────────────────────────────────
R2_ACCOUNT_ID  = os.environ.get("R2_ACCOUNT_ID",  "")
R2_ACCESS_KEY  = os.environ.get("R2_ACCESS_KEY",  "")
R2_SECRET_KEY  = os.environ.get("R2_SECRET_KEY",  "")
R2_BUCKET      = os.environ.get("R2_BUCKET",      "")
R2_PUBLIC_BASE = os.environ.get("R2_PUBLIC_BASE", "")   # e.g. https://cdn.reelget.com
R2_CACHE_THRESHOLD = int(os.environ.get("R2_CACHE_THRESHOLD", "3"))  # requests before caching

_r2_client = None

def _get_r2():
    """Lazy-init boto3 S3 client pointed at Cloudflare R2."""
    global _r2_client
    if _r2_client is not None:
        return _r2_client
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET]):
        return None
    try:
        import boto3
        _r2_client = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            region_name="auto",
        )
        print("[r2] client initialised", flush=True)
        return _r2_client
    except Exception as ex:
        print(f"[r2] init failed: {ex}", flush=True)
        return None

def _get_db_conn():
    if not _PG_AVAILABLE or not DATABASE_URL:
        return None
    try:
        return psycopg2.connect(DATABASE_URL, connect_timeout=5)
    except Exception as ex:
        print(f"[db] connect failed: {ex}", flush=True)
        return None

def _init_db():
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS counter (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    count BIGINT NOT NULL DEFAULT 0
                );
                INSERT INTO counter (id, count)
                VALUES (1, %s)
                ON CONFLICT (id) DO NOTHING;

                CREATE TABLE IF NOT EXISTS page_stats (
                    page VARCHAR(255) PRIMARY KEY,
                    count BIGINT NOT NULL DEFAULT 0,
                    last_seen TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS cookie_alerts (
                    platform   VARCHAR(50)  PRIMARY KEY,
                    fail_count INTEGER      NOT NULL DEFAULT 0,
                    first_seen TIMESTAMPTZ  DEFAULT NOW(),
                    last_seen  TIMESTAMPTZ  DEFAULT NOW(),
                    alerted_at TIMESTAMPTZ
                );

                CREATE TABLE IF NOT EXISTS app_config (
                    key   VARCHAR(100) PRIMARY KEY,
                    value TEXT
                );

                CREATE TABLE IF NOT EXISTS ip_quota (
                    ip   VARCHAR(50) NOT NULL,
                    date DATE        NOT NULL,
                    count INTEGER    NOT NULL DEFAULT 0,
                    PRIMARY KEY (ip, date)
                );

                CREATE TABLE IF NOT EXISTS url_request_count (
                    url_hash  VARCHAR(64) PRIMARY KEY,
                    url       TEXT        NOT NULL,
                    count     INTEGER     NOT NULL DEFAULT 0,
                    r2_key    TEXT,
                    r2_cached BOOLEAN     NOT NULL DEFAULT FALSE,
                    last_seen TIMESTAMPTZ DEFAULT NOW()
                );
            """, (_COUNTER_BASE,))
        print("[db] tables ready", flush=True)
    except Exception as ex:
        print(f"[db] init failed: {ex}", flush=True)
    finally:
        conn.close()


def _db_track_page(page: str):
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO page_stats (page, count, last_seen)
                VALUES (%s, 1, NOW())
                ON CONFLICT (page) DO UPDATE
                SET count = page_stats.count + 1,
                    last_seen = NOW()
            """, (page[:255],))
    except Exception as ex:
        print(f"[db] track page failed: {ex}", flush=True)
    finally:
        conn.close()

def _db_increment() -> int | None:
    conn = _get_db_conn()
    if not conn:
        return None
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE counter SET count = count + 1 WHERE id = 1 RETURNING count"
            )
            row = cur.fetchone()
            return row[0] if row else None
    except Exception as ex:
        print(f"[db] increment failed: {ex}", flush=True)
        return None
    finally:
        conn.close()

def _db_get_count() -> int | None:
    conn = _get_db_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count FROM counter WHERE id = 1")
            row = cur.fetchone()
            return row[0] if row else None
    except Exception as ex:
        print(f"[db] get count failed: {ex}", flush=True)
        return None
    finally:
        conn.close()

_init_db()


def _db_get_config(key: str) -> str | None:
    conn = _get_db_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_config WHERE key = %s", (key,))
            row = cur.fetchone()
            return row[0] if row else None
    except Exception:
        return None
    finally:
        conn.close()


def _db_set_config(key: str, value: str) -> None:
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO app_config (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """, (key, value))
    except Exception as ex:
        print(f"[db] set_config failed: {ex}", flush=True)
    finally:
        conn.close()


import hashlib as _hashlib


def _url_hash(url: str) -> str:
    return _hashlib.sha256(url.encode()).hexdigest()[:32]


def _db_increment_url_count(url: str) -> tuple[int, str | None]:
    """Increment request count for url. Returns (new_count, r2_key_if_cached)."""
    conn = _get_db_conn()
    if not conn:
        return 1, None
    h = _url_hash(url)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO url_request_count (url_hash, url, count, last_seen)
                VALUES (%s, %s, 1, NOW())
                ON CONFLICT (url_hash) DO UPDATE
                    SET count     = url_request_count.count + 1,
                        last_seen = NOW()
                RETURNING count, r2_key, r2_cached
            """, (h, url[:2000]))
            row = cur.fetchone()
            if row:
                return row[0], row[1] if row[2] else None
        return 1, None
    except Exception as ex:
        print(f"[r2] db count failed: {ex}", flush=True)
        return 1, None
    finally:
        conn.close()


def _db_set_r2_cached(url: str, r2_key: str) -> None:
    conn = _get_db_conn()
    if not conn:
        return
    h = _url_hash(url)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                UPDATE url_request_count
                SET r2_key = %s, r2_cached = TRUE
                WHERE url_hash = %s
            """, (r2_key, h))
    except Exception as ex:
        print(f"[r2] db set_cached failed: {ex}", flush=True)
    finally:
        conn.close()


async def _r2_upload_file(local_path: str, r2_key: str, content_type: str) -> bool:
    """Upload a local file to R2. Returns True on success."""
    r2 = _get_r2()
    if not r2:
        return False
    try:
        await asyncio.to_thread(
            r2.upload_file,
            local_path,
            R2_BUCKET,
            r2_key,
            ExtraArgs={"ContentType": content_type},
        )
        print(f"[r2] uploaded {r2_key}", flush=True)
        return True
    except Exception as ex:
        print(f"[r2] upload failed: {ex}", flush=True)
        return False


def _r2_public_url(r2_key: str) -> str | None:
    if R2_PUBLIC_BASE:
        return f"{R2_PUBLIC_BASE.rstrip('/')}/{r2_key}"
    return None


async def _maybe_cache_to_r2(url: str, local_path: str, ext: str) -> None:
    """After a successful job download, upload to R2 if threshold met."""
    count, _ = _db_increment_url_count(url)
    print(f"[r2] url request count={count} threshold={R2_CACHE_THRESHOLD}", flush=True)
    if count < R2_CACHE_THRESHOLD:
        return
    r2 = _get_r2()
    if not r2:
        return
    r2_key = f"videos/{_url_hash(url)}.{ext}"
    content_type = "audio/mp4" if ext == "m4a" else "video/mp4"
    if await _r2_upload_file(local_path, r2_key, content_type):
        _db_set_r2_cached(url, r2_key)


_MAX_DOWNLOADS_PER_IP_PER_DAY = int(os.environ.get("IP_QUOTA_DAILY", "30"))


def _db_check_and_increment_quota(ip: str) -> bool:
    """Increment daily counter for ip. Return True if under quota, False if exceeded."""
    conn = _get_db_conn()
    if not conn:
        return True  # fail open — don't block if DB is down
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ip_quota (ip, date, count)
                VALUES (%s, CURRENT_DATE, 1)
                ON CONFLICT (ip, date) DO UPDATE
                    SET count = ip_quota.count + 1
                RETURNING count
            """, (ip[:50],))
            row = cur.fetchone()
            return (row[0] if row else 1) <= _MAX_DOWNLOADS_PER_IP_PER_DAY
    except Exception as ex:
        print(f"[quota] check failed: {ex}", flush=True)
        return True
    finally:
        conn.close()


async def _cookie_reminder_loop() -> None:
    """Background task: check every hour, send a Telegram reminder every 14 days."""
    INTERVAL_DAYS = 14
    INTERVAL_SEC  = INTERVAL_DAYS * 24 * 3600
    CHECK_SEC     = 3600  # check hourly

    while True:
        await asyncio.sleep(CHECK_SEC)
        try:
            last_str = _db_get_config("cookie_reminder_sent_at")
            last_ts  = float(last_str) if last_str else 0.0
            if time.time() - last_ts >= INTERVAL_SEC:
                msg = (
                    f"⏰ <b>Cookie Refresh Reminder</b>\n\n"
                    f"It has been {INTERVAL_DAYS} days — platform cookies may be expiring.\n\n"
                    f"<b>Please export fresh cookies</b> from your browser and update:\n"
                    f"• <code>YOUTUBE_COOKIES</code>\n"
                    f"• <code>INSTAGRAM_COOKIES</code>\n"
                    f"• <code>COOKIES</code> (Facebook, TikTok, Twitter, etc.)\n\n"
                    f"<i>Scheduled reminder — not an error.</i>"
                )
                await _send_telegram_alert(msg)
                _db_set_config("cookie_reminder_sent_at", str(time.time()))
        except Exception as ex:
            print(f"[reminder] loop error: {ex}", flush=True)


@app.on_event("startup")
async def _startup():
    asyncio.create_task(_cookie_reminder_loop())
    print("[startup] cookie reminder loop started", flush=True)


# In-memory result cache — avoids repeated yt-dlp calls for the same URL
_CACHE: dict[str, tuple[float, dict]] = {}  # url -> (timestamp, data)
_CACHE_TTL = 600  # 10 minutes

# Separate cache for transcript results (longer TTL — subtitles rarely change)
_SUBTITLE_CACHE: dict[str, tuple[float, dict]] = {}
_SUBTITLE_CACHE_TTL = 3600  # 1 hour


def _cache_get(url: str) -> dict | None:
    entry = _CACHE.get(url)
    if entry and time.time() - entry[0] < _CACHE_TTL:
        return entry[1]
    if entry:
        del _CACHE[url]
    return None


def _cache_set(url: str, data: dict):
    # Keep cache small — evict oldest if over 200 entries
    if len(_CACHE) >= 200:
        oldest = min(_CACHE, key=lambda k: _CACHE[k][0])
        del _CACHE[oldest]
    _CACHE[url] = (time.time(), data)


def _subtitle_cache_get(url: str) -> dict | None:
    entry = _SUBTITLE_CACHE.get(url)
    if entry and time.time() - entry[0] < _SUBTITLE_CACHE_TTL:
        return entry[1]
    if entry:
        del _SUBTITLE_CACHE[url]
    return None


def _subtitle_cache_set(url: str, data: dict):
    if len(_SUBTITLE_CACHE) >= 100:
        oldest = min(_SUBTITLE_CACHE, key=lambda k: _SUBTITLE_CACHE[k][0])
        del _SUBTITLE_CACHE[oldest]
    _SUBTITLE_CACHE[url] = (time.time(), data)


def _parse_vtt(text: str) -> str:
    """Convert WebVTT subtitle text to plain readable text, deduplicating overlapping lines."""
    lines = text.splitlines()
    result = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Skip WEBVTT header and metadata blocks
        if re.match(r'^(WEBVTT|NOTE|STYLE|REGION)', line):
            continue
        # Skip timing lines like "00:00:01.000 --> 00:00:04.000 ..."
        if re.match(r'^\d{1,2}:\d{2}[\d:.]+\s*-->', line):
            continue
        # Skip bare sequence numbers
        if re.match(r'^\d+$', line):
            continue
        # Strip VTT tags: <00:00:01.000>, <c>, </c>, <i>, etc.
        line = re.sub(r'<[^>]+>', '', line).strip()
        if line:
            result.append(line)
    # Deduplicate consecutive identical lines (YouTube repeats the rolling caption)
    deduped: list[str] = []
    prev = None
    for ln in result:
        if ln != prev:
            deduped.append(ln)
            prev = ln
    return ' '.join(deduped)


def _parse_json3(text: str) -> str:
    """Parse YouTube json3 subtitle format to plain text."""
    try:
        data = json.loads(text)
        parts: list[str] = []
        for event in data.get('events', []):
            for seg in event.get('segs', []):
                t = seg.get('utf8', '')
                if t and t.strip() and t != '\n':
                    parts.append(t.strip())
        joined = ' '.join(parts)
        # Collapse runs of whitespace
        return re.sub(r'\s+', ' ', joined).strip()
    except Exception:
        return ''


def _find_subtitle(sub_dict: dict) -> tuple[str, str, str]:
    """
    Given a subtitles or automatic_captions dict from yt-dlp, pick the best
    English track.  Returns (lang_code, ext, url) or ('', '', '').
    """
    preferred_langs = ['en', 'en-US', 'en-GB', 'en-orig', 'en-CA', 'en-AU']
    en_variants = [k for k in sub_dict if k.startswith('en') and k not in preferred_langs]
    candidates = preferred_langs + en_variants

    for lang in candidates:
        if lang not in sub_dict:
            continue
        formats = sub_dict[lang]
        for pref_ext in ['json3', 'vtt', 'ttml', 'srv3', 'srv2', 'srv1']:
            for fmt in formats:
                if fmt.get('ext') == pref_ext and fmt.get('url'):
                    return lang, pref_ext, fmt['url']
        # Any format with a URL
        for fmt in formats:
            if fmt.get('url'):
                return lang, fmt.get('ext', 'vtt'), fmt['url']
    return '', '', ''


class DownloadRequest(BaseModel):
    url: str

class FormatInfo(BaseModel):
    label: str
    url: str
    ext: str

class DownloadResponse(BaseModel):
    title: str
    thumbnail: str | None
    formats: list[FormatInfo]
    duration: int | None = None       # seconds
    error_code: str | None = None     # structured error code for frontend mapping


@app.post("/api/download", response_model=DownloadResponse)
@limiter.limit("20/minute")
async def download(request: Request, req: DownloadRequest):
    if not SUPPORTED_PATTERN.search(req.url):
        raise HTTPException(status_code=400, detail="Unsupported platform")

    # Per-IP daily quota (configurable via IP_QUOTA_DAILY env var, default 30)
    client_ip = request.client.host if request.client else "unknown"
    if not _db_check_and_increment_quota(client_ip):
        raise HTTPException(
            status_code=429,
            detail=f"Daily download limit reached ({_MAX_DOWNLOADS_PER_IP_PER_DAY}/day). "
                   "Please try again tomorrow.",
        )

    # Return cached result if fresh
    cached = _cache_get(req.url)
    if cached:
        print(f"[cache] HIT for {req.url[:60]}", flush=True)
        return DownloadResponse(**cached)

    class _SilentLogger:
        def debug(self, msg): pass
        def warning(self, msg): pass
        def error(self, msg): pass

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "logger": _SilentLogger(),
        # Don't validate format URLs during extraction — just get the list
        "check_formats": False,
        # Maximally permissive cascade so we never get "format not available"
        # during metadata extraction.  We only need the info dict (title,
        # thumbnail, formats[]), not a downloadable file.
        "format": (
            "bestvideo*+bestaudio"
            "/best"
            "/bestvideo+bestaudio"
            "/bestvideo"
            "/bestaudio"
        ),
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
        # tv_embedded was removed in yt-dlp Jan 2026.
        # tv_downgraded avoids SABR-only/DRM formats; web_embedded skips
        # po_token requirement; web_safari + ios round out compatibility.
        "extractor_args": {
            "youtube": {
                "player_client": ["tv_downgraded", "web_embedded", "web_safari", "ios"],
            }
        },
        # Reliability: retry on transient network/extractor failures
        "extractor_retries": 5,
        "fragment_retries": 10,
        "socket_timeout": 30,
    }
    if PROXY_URL:
        ydl_opts["proxy"] = PROXY_URL
        print(f"[proxy] Using proxy: {PROXY_URL.split('@')[-1]}", flush=True)  # log host only, hide creds

    # Pick cookie jar: platform-specific override → universal COOKIES → none
    if re.search(r"instagram\.com", req.url):
        cookie_content = INSTAGRAM_COOKIES or None
        label = "INSTAGRAM_COOKIES"
    elif re.search(r"youtube\.com|youtu\.be", req.url):
        cookie_content = YOUTUBE_COOKIES or None
        label = "YOUTUBE_COOKIES"
    else:
        # Facebook, TikTok, Twitter, Pinterest, Snapchat all use universal jar
        cookie_content = COOKIES or None
        label = "COOKIES"
    print(f"[cookies] {label}: {'set' if cookie_content else 'not configured'}", flush=True)

    cookies_file = None
    if cookie_content:
        try:
            tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            tmp.write(cookie_content)
            tmp.close()
            cookies_file = tmp.name
            ydl_opts["cookiefile"] = cookies_file
        except Exception as ex:
            print(f"[cookies] Failed to write cookies file: {ex}", flush=True)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
    except yt_dlp.utils.DownloadError as e:
        err_str = str(e)
        print(f"[yt-dlp DownloadError] {err_str}", flush=True)
        # Fire-and-forget cookie alert check (won't block the error response)
        asyncio.create_task(_check_and_alert_cookie_error(req.url, err_str))
        # ── YouTube oEmbed fallback ──────────────────────────────────────────
        # When yt-dlp fails for a YouTube URL (bot-detection, VEVO region block,
        # Shorts bot-check, etc.), silently call YouTube's public oEmbed endpoint
        # which always works for any public video regardless of IP or auth.
        # The result card will show correctly; the download buttons already call
        # /api/download-youtube directly so they are unaffected by yt-dlp failing here.
        if re.search(r"youtube\.com|youtu\.be", req.url):
            try:
                import urllib.parse as _up
                # Normalise the URL for oEmbed: Shorts and youtu.be links are
                # converted to the standard watch URL, which oEmbed always accepts.
                # oEmbed does NOT reliably handle /shorts/, /live/, ?si= etc.
                _vid_m = re.search(
                    r"(?:shorts/|watch\?v=|youtu\.be/|embed/|v/)([A-Za-z0-9_-]{11})",
                    req.url,
                )
                _oembed_target = (
                    f"https://www.youtube.com/watch?v={_vid_m.group(1)}"
                    if _vid_m else req.url
                )
                _oembed_url = (
                    "https://www.youtube.com/oembed"
                    f"?url={_up.quote(_oembed_target, safe='')}&format=json"
                )
                async with httpx.AsyncClient(timeout=6.0) as _hc:
                    _r = await _hc.get(_oembed_url)
                if _r.status_code == 200:
                    _d = _r.json()
                    _title = _d.get("title") or "YouTube Video"
                    _thumb = _d.get("thumbnail_url")
                    print(f"[oembed] fallback OK → {_title!r}", flush=True)
                    # Return a stub result — the real download goes via /api/download-youtube
                    return DownloadResponse(
                        title=_title,
                        thumbnail=_thumb,
                        formats=[FormatInfo(label="Video", url="", ext="mp4")],
                    )
                else:
                    print(f"[oembed] fallback HTTP {_r.status_code}", flush=True)
            except Exception as _oe:
                print(f"[oembed] fallback error: {_oe}", flush=True)
        # ── non-YouTube (or oEmbed also failed): surface structured error ──
        _code = "unknown"
        _s = err_str.lower()
        if any(k in _s for k in ("sign in", "bot", "confirm you're not", "use --cookies")):
            _code = "sign_in_required"
        elif any(k in _s for k in ("unavailable", "not available", "video unavailable")):
            _code = "unavailable"
        elif "private" in _s:
            _code = "private"
        elif any(k in _s for k in ("age-restricted", "age restricted", "age_restricted", "age gate", "confirm your age")):
            _code = "age_restricted"
        elif any(k in _s for k in ("not found", "no video", "404")):
            _code = "not_found"
        elif "region" in _s or "country" in _s:
            _code = "geo_blocked"
        raise HTTPException(status_code=422, detail={"message": err_str, "code": _code})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if cookies_file:
            try:
                os.unlink(cookies_file)
            except Exception:
                pass

    if not info:
        raise HTTPException(status_code=404, detail={"message": "Video not found", "code": "not_found"})

    formats: list[FormatInfo] = []

    raw_formats = info.get("formats") or []
    entries = info.get("entries") or []  # carousel / playlist (Instagram multi-photo, etc.)

    IMAGE_EXTS = {"jpg", "jpeg", "webp", "png", "gif", "avif"}

    if entries:
        # ── Carousel / album (Instagram multi-photo post, etc.) ──────────────
        for i, entry in enumerate(entries[:12], 1):
            if not entry:
                continue
            e_url = entry.get("url")
            e_ext = (entry.get("ext") or "jpg").lower()
            e_fmts = entry.get("formats") or []
            if not e_url and e_fmts:
                best_e = e_fmts[-1]
                e_url = best_e.get("url")
                e_ext = (best_e.get("ext") or e_ext).lower()
            if not e_url:
                continue
            is_img = e_ext in IMAGE_EXTS
            label = f"{'Image' if is_img else 'Video'} {i}"
            formats.append(FormatInfo(label=label, url=e_url, ext=e_ext))
    else:
        # ── Single item: video/audio first ───────────────────────────────────
        best = (
            _pick_format(raw_formats, vcodec=True, acodec=True, ext="mp4")
            or _pick_format(raw_formats, vcodec=True, acodec=True)
            or _pick_format(raw_formats, vcodec=True, acodec=False)
        )
        if best:
            ext = best.get("ext") or "mp4"
            formats.append(FormatInfo(label="HD Video (MP4)", url=best["url"], ext=ext))

        # SD fallback: same cascade, max 480p
        sd = (
            _pick_format(raw_formats, vcodec=True, acodec=True, ext="mp4", max_height=480)
            or _pick_format(raw_formats, vcodec=True, acodec=True, max_height=480)
            or _pick_format(raw_formats, vcodec=True, acodec=False, max_height=480)
        )
        if sd and sd.get("url") != (best or {}).get("url"):
            ext = sd.get("ext") or "mp4"
            formats.append(FormatInfo(label="SD Video (MP4)", url=sd["url"], ext=ext))

        audio = _pick_format(raw_formats, vcodec=False, acodec=True)
        if audio:
            formats.append(FormatInfo(label="Audio Only (M4A)", url=audio["url"], ext="m4a"))

        # ── Image fallback (Pinterest pin, Instagram photo, etc.) ─────────────
        if not formats:
            for f in raw_formats:
                if f.get("url") and (f.get("ext") or "").lower() in IMAGE_EXTS:
                    formats.append(FormatInfo(
                        label="Download Image",
                        url=f["url"],
                        ext=(f.get("ext") or "jpg").lower(),
                    ))
                    break
            # Last resort: info["url"] (yt-dlp direct URL for simple extractors)
            if not formats and info.get("url"):
                raw_ext = (info.get("ext") or "jpg").lower()
                formats.append(FormatInfo(
                    label="Download Image" if raw_ext in IMAGE_EXTS else "Download",
                    url=info["url"],
                    ext=raw_ext,
                ))

    if not formats:
        raise HTTPException(status_code=404, detail={"message": "No downloadable formats found", "code": "no_formats"})

    global _counter_session
    _counter_session += 1
    _db_increment()  # persist to DB (fire and forget — fallback to in-memory if fails)

    # Track which platform was downloaded
    for pattern, label in [
        (r"instagram\.com", "download:instagram"),
        (r"youtube\.com|youtu\.be", "download:youtube"),
        (r"tiktok\.com|vm\.tiktok\.com", "download:tiktok"),
        (r"facebook\.com|fb\.watch", "download:facebook"),
        (r"twitter\.com|x\.com|t\.co", "download:twitter"),
        (r"pinterest\.com|pin\.it", "download:pinterest"),
        (r"snapchat\.com", "download:snapchat"),
        (r"linkedin\.com", "download:linkedin"),
        (r"reddit\.com|redd\.it", "download:reddit"),
        (r"vimeo\.com", "download:vimeo"),
        (r"dailymotion\.com|dai\.ly", "download:dailymotion"),
        (r"twitch\.tv", "download:twitch"),
    ]:
        if re.search(pattern, req.url):
            _db_track_page(label)
            break

    response_data = {
        "title": info.get("title", "Video"),
        "thumbnail": info.get("thumbnail"),
        "formats": formats,
        "duration": info.get("duration"),  # seconds (int) or None
    }
    _cache_set(req.url, response_data)

    return DownloadResponse(**response_data)


@app.get("/api/trending")
async def trending(region: str = Query("IN")):
    region = region.upper()
    if region not in ALLOWED_REGIONS:
        region = "IN"

    if not YOUTUBE_API_KEY:
        return {"region": region, "videos": [], "error": "no_key"}

    CACHE_DIR.mkdir(exist_ok=True)
    cache_file = CACHE_DIR / f"trending_{region}.json"

    if cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < CACHE_TTL:
            return json.loads(cache_file.read_text(encoding="utf-8"))

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "part": "snippet",
                "chart": "mostPopular",
                "regionCode": region,
                "maxResults": 20,
                "key": YOUTUBE_API_KEY,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="YouTube API error")

    data = resp.json()
    videos = []
    for item in data.get("items", []):
        snippet = item.get("snippet", {})
        thumbs = snippet.get("thumbnails", {})
        thumb = (
            thumbs.get("medium", {}).get("url")
            or thumbs.get("default", {}).get("url")
            or ""
        )
        videos.append({
            "videoId": item["id"],
            "title": snippet.get("title", ""),
            "thumbnail": thumb,
            "channelTitle": snippet.get("channelTitle", ""),
        })

    result = {"region": region, "videos": videos, "cached_at": int(time.time())}
    cache_file.write_text(json.dumps(result), encoding="utf-8")
    return result


# Trending Now — uses yt-dlp to scrape YouTube trending, no API key required.
_TRENDING_NOW_URLS: dict[str, str] = {
    "all":    "https://www.youtube.com/feed/trending",
    "music":  "https://www.youtube.com/feed/trending?bp=4gInChMIARABGAAgBSgA",
    "gaming": "https://www.youtube.com/feed/trending?bp=4gIcChMIARABGAAgDCgA",
    "films":  "https://www.youtube.com/feed/trending?bp=4gIcChMIARABGAAgCCgA",
}
_TRENDING_NOW_CACHE_TTL = 2 * 3600  # 2 hours


@app.get("/api/trending-now")
async def trending_now(category: str = Query("all")):
    category = category.lower()
    if category not in _TRENDING_NOW_URLS:
        category = "all"

    CACHE_DIR.mkdir(exist_ok=True)
    cache_file = CACHE_DIR / f"trending_now_{category}.json"

    if cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < _TRENDING_NOW_CACHE_TTL:
            return json.loads(cache_file.read_text(encoding="utf-8"))

    url = _TRENDING_NOW_URLS[category]
    try:
        proc = await asyncio.wait_for(
            asyncio.create_subprocess_exec(
                "yt-dlp",
                "--flat-playlist",
                "--dump-json",
                "-I", "1:12",
                "--no-warnings",
                "--quiet",
                url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            ),
            timeout=30,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch trending data")

    videos = []
    for line in stdout.decode(errors="replace").strip().splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        video_id = item.get("id") or item.get("url", "").split("v=")[-1]
        if not video_id:
            continue
        thumbnail = (
            item.get("thumbnail")
            or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
        )
        videos.append({
            "videoId": video_id,
            "title": item.get("title", ""),
            "thumbnail": thumbnail,
            "channelTitle": item.get("uploader") or item.get("channel", ""),
        })

    result = {"category": category, "videos": videos, "cached_at": int(time.time())}
    cache_file.write_text(json.dumps(result), encoding="utf-8")
    return result


# ── Cookie expiry tracking & Telegram alerts ──────────────────────────────────

# Per-platform cookie error signatures (case-insensitive)
_COOKIE_ERROR_PATTERNS: dict[str, list[str]] = {
    "youtube": [
        r"cookies are no longer valid",
        r"provided .{0,30} cookies are no longer valid",
        r"sign in to confirm you.re not a bot",
        r"please sign in",
        r"This video is only available to Music Premium",
        r"HTTP Error 403.*cookie",
    ],
    "instagram": [
        r"login.?required",
        r"not authenticated",
        r"checkpoint.?required",
        r"Please wait a few minutes before",
        r"401 Unauthorized",
        r"cookie",
    ],
    "facebook": [
        r"login.?required",
        r"not authenticated",
        r"please log in",
        r"cookie",
    ],
    "tiktok": [
        r"login.?required",
        r"not authenticated",
        r"cookie",
    ],
    "twitter": [
        r"Could not authenticate",
        r"login.?required",
        r"not authenticated",
        r"cookie",
    ],
}

# Map URL patterns → platform name
_URL_PLATFORM: list[tuple[str, str]] = [
    (r"youtube\.com|youtu\.be", "youtube"),
    (r"instagram\.com",          "instagram"),
    (r"facebook\.com|fb\.watch", "facebook"),
    (r"tiktok\.com",             "tiktok"),
    (r"twitter\.com|x\.com|t\.co", "twitter"),
]


def _detect_cookie_error_platform(url: str, error_text: str) -> str | None:
    """Return the platform name if error_text looks like an expired-cookie error, else None."""
    platform: str | None = None
    for pat, plat in _URL_PLATFORM:
        if re.search(pat, url, re.IGNORECASE):
            platform = plat
            break
    if not platform:
        return None
    for pattern in _COOKIE_ERROR_PATTERNS.get(platform, []):
        if re.search(pattern, error_text, re.IGNORECASE):
            return platform
    return None


def _db_record_cookie_failure(platform: str) -> bool:
    """Upsert failure counter; return True when alert threshold met and cooldown passed."""
    conn = _get_db_conn()
    if not conn:
        return False
    try:
        with conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO cookie_alerts (platform, fail_count, first_seen, last_seen, alerted_at)
                VALUES (%s, 1, NOW(), NOW(), NULL)
                ON CONFLICT (platform) DO UPDATE
                    SET fail_count = cookie_alerts.fail_count + 1,
                        last_seen  = NOW()
                RETURNING fail_count, alerted_at
            """, (platform,))
            row = cur.fetchone()
            if not row:
                return False
            fail_count, alerted_at = row
            # Require ≥3 failures to suppress transient glitches
            if fail_count < 3:
                return False
            if alerted_at is None:
                return True
            import datetime
            now = datetime.datetime.now(tz=datetime.timezone.utc)
            if alerted_at.tzinfo is None:
                alerted_at = alerted_at.replace(tzinfo=datetime.timezone.utc)
            return (now - alerted_at).total_seconds() > 6 * 3600
    except Exception as ex:
        print(f"[db] cookie_alerts upsert failed: {ex}", flush=True)
        return False
    finally:
        conn.close()


def _db_mark_cookie_alerted(platform: str) -> None:
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE cookie_alerts SET alerted_at = NOW() WHERE platform = %s",
                (platform,),
            )
    except Exception as ex:
        print(f"[db] mark_alerted failed: {ex}", flush=True)
    finally:
        conn.close()


def _db_get_cookie_status() -> list[dict]:
    conn = _get_db_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT platform, fail_count, first_seen, last_seen, alerted_at
                FROM cookie_alerts
                ORDER BY last_seen DESC
            """)
            rows = []
            for r in cur.fetchall():
                rows.append({
                    "platform":   r[0],
                    "fail_count": r[1],
                    "first_seen": r[2].isoformat() if r[2] else None,
                    "last_seen":  r[3].isoformat() if r[3] else None,
                    "alerted_at": r[4].isoformat() if r[4] else None,
                })
            return rows
    except Exception as ex:
        print(f"[db] cookie_status query failed: {ex}", flush=True)
        return []
    finally:
        conn.close()


def _db_reset_cookie_alerts(platform: str) -> None:
    """Reset the alert counter for a platform after cookies are refreshed."""
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM cookie_alerts WHERE platform = %s",
                (platform,),
            )
    except Exception as ex:
        print(f"[db] reset_cookie_alerts failed: {ex}", flush=True)
    finally:
        conn.close()


async def _send_telegram_alert(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print(f"[alert] Telegram not configured — {message[:120]}", flush=True)
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id":    TELEGRAM_CHAT_ID,
                    "text":       message,
                    "parse_mode": "HTML",
                },
            )
        if resp.status_code == 200:
            print("[alert] Telegram message sent", flush=True)
        else:
            print(f"[alert] Telegram error {resp.status_code}: {resp.text[:200]}", flush=True)
    except Exception as ex:
        print(f"[alert] Telegram send failed: {ex}", flush=True)


async def _check_proxy_health(proxy_url: str) -> bool:
    """Return True if the proxy can reach the internet within 6 seconds."""
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=6) as client:
            await client.get("http://www.google.com")
        return True
    except Exception as ex:
        print(f"[proxy] health check failed: {ex}", flush=True)
        return False


async def _check_and_alert_cookie_error(url: str, error_text: str) -> None:
    """Detect a cookie-expiry error, persist it, and fire a Telegram alert if needed."""
    platform = _detect_cookie_error_platform(url, error_text)
    if not platform:
        return
    print(f"[cookie-alert] {platform} cookie error detected", flush=True)
    should_alert = _db_record_cookie_failure(platform)
    if not should_alert:
        return
    env_var = f"{platform.upper()}_COOKIES"
    msg = (
        f"🍪 <b>Cookie Alert — {platform.title()}</b>\n\n"
        f"Cookies for <b>{platform.title()}</b> appear to be expired or invalid.\n\n"
        f"<b>Action required:</b>\n"
        f"1. Open your browser and log in to {platform.title()}\n"
        f"2. Export cookies (use a browser extension like EditThisCookie or Cookie-Editor)\n"
        f"3. Update the <code>{env_var}</code> environment variable on Railway\n\n"
        f"<i>Error snippet:</i>\n<code>{error_text[:400]}</code>"
    )
    await _send_telegram_alert(msg)
    _db_mark_cookie_alerted(platform)


# ─────────────────────────────────────────────────────────────────────────────

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')

def _clean_error(msg: str) -> str:
    """Strip ANSI colour codes, carriage returns, and yt-dlp prefixes from error strings."""
    msg = _ANSI_RE.sub('', str(msg))
    msg = msg.replace('\r', ' ')                        # carriage returns → space
    msg = re.sub(r'\s+', ' ', msg)                      # collapse whitespace
    msg = re.sub(r'^(ERROR|WARNING):\s*', '', msg)      # strip yt-dlp prefix
    # Also remove progress noise like "[download] Got error: "
    msg = re.sub(r'\[download\]\s*Got error:\s*', '', msg)
    return msg.strip()


def _extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats, or return 'youtube_video'."""
    # youtu.be/VIDEO_ID
    m = re.search(r'youtu\.be/([A-Za-z0-9_-]{11})', url)
    if m:
        return m.group(1)
    # youtube.com/watch?v=VIDEO_ID
    m = re.search(r'[?&]v=([A-Za-z0-9_-]{11})', url)
    if m:
        return m.group(1)
    # youtube.com/shorts/VIDEO_ID
    m = re.search(r'/shorts/([A-Za-z0-9_-]{11})', url)
    if m:
        return m.group(1)
    return "youtube_video"


def _make_sticky_proxy(proxy_url: str) -> str:
    """Convert a Webshare rotating proxy URL to a sticky-session URL.

    Webshare rotating format: http://user-rotate:pass@p.webshare.io:80
    Webshare sticky format:   http://user-NNNNN:pass@p.webshare.io:80
                                           ^^^^^
                              numeric session ID — NOT a string like "session-xxx"

    The -rotate mode suffix is stripped and replaced with a random integer.
    All connections sharing the same numeric ID are routed through the same
    egress residential IP, so the CDN URL (signed to extraction IP) stays valid.
    """
    if not proxy_url:
        return proxy_url
    import random
    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(proxy_url)
        session_id = random.randint(10000, 99999)
        # Strip Webshare mode suffixes (-rotate, -res, -residential) then append numeric ID
        base_user = re.sub(r'-(rotate|res|residential)$', '', parsed.username, flags=re.IGNORECASE)
        sticky_user = f"{base_user}-{session_id}"
        netloc = f"{sticky_user}:{parsed.password}@{parsed.hostname}:{parsed.port}"
        result = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
        print(f"[proxy] sticky: {sticky_user} @ {parsed.hostname}:{parsed.port}", flush=True)
        return result
    except Exception as exc:
        print(f"[proxy] sticky build failed: {exc}", flush=True)
        return proxy_url


# ─── Playlist endpoint ────────────────────────────────────────────────────────

_PLAYLIST_PATTERN = re.compile(
    r"youtube\.com/(playlist|watch)\?.*list=|youtu\.be/.*\?.*list="
)

@app.get("/api/formats")
@limiter.limit("30/minute")
async def get_formats(request: Request, url: str = Query(...)):
    """Return available download formats for a URL without downloading.

    YouTube: returns the progressive (combined A/V) formats available plus
    an audio-only option.  Other platforms: mirrors /api/download format list.
    """
    if not SUPPORTED_PATTERN.search(url):
        raise HTTPException(status_code=400, detail="Unsupported platform")

    cached = _cache_get(url)

    class _SilentLogger:
        def debug(self, msg): pass
        def warning(self, msg): pass
        def error(self, msg): pass

    ydl_opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "check_formats": False,
        "logger": _SilentLogger(),
        "extractor_args": {
            "youtube": {"player_client": ["tv_downgraded", "web_embedded", "ios"]},
        },
        "extractor_retries": 5,
        "fragment_retries": 10,
        "socket_timeout": 30,
    }
    if PROXY_URL:
        ydl_opts["proxy"] = PROXY_URL

    # Attach cookies for the relevant platform
    cookie_content: str | None = None
    if re.search(r"youtube\.com|youtu\.be", url):
        cookie_content = YOUTUBE_COOKIES or None
    elif re.search(r"instagram\.com", url):
        cookie_content = INSTAGRAM_COOKIES or None
    else:
        cookie_content = COOKIES or None

    cookies_file: str | None = None
    if cookie_content:
        try:
            tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
            tmp.write(cookie_content); tmp.close()
            cookies_file = tmp.name
            ydl_opts["cookiefile"] = cookies_file
        except Exception:
            pass

    try:
        if cached:
            info = None  # use cached data below
        else:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=422, detail=_clean_error(str(e)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if cookies_file:
            try: os.unlink(cookies_file)
            except Exception: pass

    # For YouTube, build a quality menu from the progressive formats
    is_youtube = bool(re.search(r"youtube\.com|youtu\.be", url))
    if is_youtube:
        raw_fmts = (info or {}).get("formats", []) if info else []

        def _yt_progressive(fid: str) -> dict | None:
            return next((f for f in raw_fmts if f.get("format_id") == fid
                         and f.get("url")), None)

        options: list[dict] = []
        for fid, label, height in [("22", "HD 720p", 720), ("18", "SD 360p", 360)]:
            f = _yt_progressive(fid)
            options.append({
                "quality":   fid == "22" and "hd" or "sd",
                "label":     label,
                "ext":       "mp4",
                "height":    height,
                "filesize":  f.get("filesize") or f.get("filesize_approx") if f else None,
                "available": f is not None,
            })
        # Audio-only option
        options.append({
            "quality":   "audio",
            "label":     "Audio only (M4A)",
            "ext":       "m4a",
            "height":    None,
            "filesize":  None,
            "available": True,
        })
        title = (info or {}).get("title", "YouTube Video") if info else cached.get("title", "")
        thumb = (info or {}).get("thumbnail") if info else cached.get("thumbnail")
        return {"platform": "youtube", "title": title, "thumbnail": thumb, "options": options}

    # Non-YouTube: return same format list as /api/download
    if cached:
        return {"platform": "other", "cached": True, **cached}
    if not info:
        raise HTTPException(status_code=404, detail="Video not found")
    return {
        "platform": "other",
        "title": info.get("title", "Video"),
        "thumbnail": info.get("thumbnail"),
        "formats": [
            {"label": "HD Video", "url": f.get("url", ""), "ext": f.get("ext", "mp4")}
            for f in (info.get("formats") or [])
            if f.get("url") and f.get("vcodec") != "none"
        ][-3:],  # top 3 video formats
    }


@app.get("/api/playlist")
async def get_playlist(url: str = Query(...)):
    """Return metadata + up to 50 video stubs for a YouTube playlist."""
    if not _PLAYLIST_PATTERN.search(url):
        raise HTTPException(status_code=400, detail="Only YouTube playlist URLs are supported.")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": 50,
        "socket_timeout": 30,
        "extractor_retries": 5,
        "extractor_args": {
            "youtube": {"player_client": ["tv_downgraded", "web_embedded", "web"]},
        },
    }

    def _extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)

    try:
        info = await asyncio.wait_for(asyncio.to_thread(_extract), timeout=45)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out. The playlist may be too large or YouTube is slow.")
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=422, detail=_clean_error(str(e)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=_clean_error(f"Could not fetch playlist: {e}"))

    entries = info.get("entries") or []
    items = []
    for entry in entries[:50]:
        if not entry:
            continue
        vid_id = entry.get("id") or ""
        thumb = (
            entry.get("thumbnail")
            or (f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg" if vid_id else "")
        )
        items.append({
            "id": vid_id,
            "title": entry.get("title") or "Untitled",
            "thumbnail": thumb,
            "url": entry.get("url") or f"https://www.youtube.com/watch?v={vid_id}",
            "duration": entry.get("duration"),
            "uploader": entry.get("uploader") or entry.get("channel") or "",
        })

    return {
        "title": info.get("title") or "Playlist",
        "thumbnail": info.get("thumbnail") or "",
        "uploader": info.get("uploader") or info.get("channel") or "",
        "total": len(items),
        "items": items,
    }


# ─── Profile endpoint ─────────────────────────────────────────────────────────

_PROFILE_PATTERN = re.compile(
    r"instagram\.com/(?!p/|reel/|stories/)([^/?#]+)/?$"
    r"|youtube\.com/(@[^/?#]+|c/[^/?#]+|user/[^/?#]+|channel/[^/?#]+)"
)

@app.get("/api/profile")
async def get_profile(url: str = Query(...)):
    """Return recent public videos from an Instagram profile or YouTube channel."""
    # Allow bare @handle or username → normalise to Instagram URL
    raw = url.strip()
    if not raw.startswith("http"):
        handle = raw.lstrip("@")
        raw = f"https://www.instagram.com/{handle}/"

    if not _PROFILE_PATTERN.search(raw):
        raise HTTPException(
            status_code=400,
            detail="Enter an Instagram profile URL or YouTube channel URL.",
        )

    is_instagram = "instagram.com" in raw
    ydl_opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": 30,
        "socket_timeout": 30,
        "extractor_retries": 5,
        "extractor_args": {
            "youtube": {"player_client": ["tv_downgraded", "web_embedded", "web"]},
        },
    }

    # Attach cookies for Instagram when available
    cookies_file = None
    if is_instagram:
        cookie_content = INSTAGRAM_COOKIES or COOKIES or ""
        if cookie_content:
            try:
                tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
                tmp.write(cookie_content)
                tmp.close()
                cookies_file = tmp.name
                ydl_opts["cookiefile"] = cookies_file
            except Exception:
                pass

    def _extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(raw, download=False)

    try:
        info = await asyncio.wait_for(asyncio.to_thread(_extract), timeout=45)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out. The profile may be private or YouTube is slow.")
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=422, detail=_clean_error(str(e)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=_clean_error(f"Could not fetch profile: {e}"))
    finally:
        if cookies_file:
            try:
                os.unlink(cookies_file)
            except Exception:
                pass

    entries = info.get("entries") or []
    videos = []
    seen_ids: set = set()
    for entry in entries[:60]:  # scan more to get 30 unique
        if not entry:
            continue
        vid_id = entry.get("id") or ""
        if vid_id and vid_id in seen_ids:
            continue
        if vid_id:
            seen_ids.add(vid_id)
        if len(videos) >= 30:
            break
        thumb = entry.get("thumbnail") or ""
        if not thumb and not is_instagram and vid_id:
            thumb = f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg"
        vid_url = entry.get("url") or entry.get("webpage_url") or ""
        if not vid_url and not is_instagram and vid_id:
            vid_url = f"https://www.youtube.com/watch?v={vid_id}"
        videos.append({
            "id": vid_id,
            "title": entry.get("title") or "Untitled",
            "thumbnail": thumb,
            "url": vid_url,
            "duration": entry.get("duration"),
        })

    platform = "Instagram" if is_instagram else "YouTube"
    return {
        "platform": platform,
        "name": info.get("uploader") or info.get("channel") or info.get("title") or "",
        "thumbnail": info.get("thumbnail") or "",
        "total": len(videos),
        "videos": videos,
    }


def _effective_height(f: dict) -> int:
    h = f.get("height")
    if h:
        return h
    fid = f.get("format_id", "")
    if fid == "hd":
        return 1080
    if fid == "sd":
        return 480
    return 0


def _pick_format(
    formats: list,
    vcodec: bool,
    acodec: bool,
    ext: str | None = None,
    max_height: int | None = None,
) -> dict | None:
    candidates = []
    for f in formats:
        # "none" string = explicitly absent; None = unknown/combined (treat as present)
        has_video = f.get("vcodec") != "none"
        has_audio = f.get("acodec") != "none"
        if vcodec and not has_video:
            continue
        if not vcodec and has_video:
            continue
        if acodec and not has_audio:
            continue
        if ext and f.get("ext") != ext:
            continue
        eff_h = _effective_height(f)
        if max_height and eff_h > max_height:
            continue
        if not f.get("url"):
            continue
        candidates.append(f)

    if not candidates:
        return None

    def _score(f: dict):
        has_v = f.get("vcodec") != "none"
        has_a = f.get("acodec") != "none"
        return (has_v and has_a, _effective_height(f))

    candidates.sort(key=_score, reverse=True)
    return candidates[0]


def _referer_for(url: str) -> str:
    if "tiktok" in url or "tiktokcdn" in url or "muscdn" in url:
        return "https://www.tiktok.com/"
    if "instagram" in url or "cdninstagram" in url:
        return "https://www.instagram.com/"
    if "facebook" in url or "fbcdn" in url:
        return "https://www.facebook.com/"
    if "pinterest" in url or "pinimg" in url or "pin.it" in url:
        return "https://www.pinterest.com/"
    if "snapchat" in url:
        return "https://www.snapchat.com/"
    return "https://www.youtube.com/"

@app.get("/api/download-youtube")
async def download_youtube(
    url: str = Query(...),
    quality: str = Query("hd"),
    start: str = Query("", description="Start time, e.g. '00:01:30' or '90'"),
    end:   str = Query("", description="End time,   e.g. '00:03:00' or '180'"),
):
    """Stream YouTube video via yt-dlp subprocess piped to stdout.

    Uses a sticky-session proxy (Webshare format: username-NNNNN) so that every
    TCP CONNECT tunnel inside the subprocess — YouTube extraction AND CDN download
    — exits through the same residential IP.  The CDN URL is IP-bound to the
    extraction IP, so a matching download IP is required to avoid HTTP 403.

    Format selector uses progressive (combined A/V) mp4 formats (18=360p, 22=720p)
    that need no ffmpeg merging and pipe cleanly to stdout.
    """
    import sys

    safe_title = _extract_youtube_id(url)

    if quality == "audio":
        fmt_sel = "bestaudio[ext=m4a]/bestaudio"
        out_ext, media_type = "m4a", "audio/mp4"
    elif quality == "sd":
        fmt_sel = "18"
        out_ext, media_type = "mp4", "video/mp4"
    else:
        fmt_sel = "22/18"
        out_ext, media_type = "mp4", "video/mp4"

    cookies_file = None
    if YOUTUBE_COOKIES:
        try:
            tmp_c = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
            tmp_c.write(YOUTUBE_COOKIES)
            tmp_c.close()
            cookies_file = tmp_c.name
        except Exception:
            pass

    # Check R2 cache first — if this URL was previously cached, redirect to CDN
    _r2_count, _r2_cached_key = _db_increment_url_count(url)
    if _r2_cached_key:
        cdn_url = _r2_public_url(_r2_cached_key)
        if cdn_url:
            print(f"[r2] serving from CDN: {cdn_url}", flush=True)
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=cdn_url, status_code=302)

    # Sticky session: same numeric ID → same Webshare egress IP for all connections
    sticky_proxy = _make_sticky_proxy(PROXY_URL) if PROXY_URL else None

    stdout_target = "-"  # yt-dlp's built-in stdout flag — Railway /dev/stdout is not writable

    # Log whether deno is available (required for n-challenge solver)
    import shutil as _shutil
    deno_path = _shutil.which("deno")
    print(f"[deno] path={deno_path}", flush=True)
    print(f"[download-youtube] proxy={sticky_proxy.split('@')[-1] if sticky_proxy else 'none'} url={url}", flush=True)

    # Retry ladder: try progressively more compatible (fmt, player_client) pairs.
    #
    # Tier 1 — progressive (pre-muxed mp4, no ffmpeg, pipes cleanly to stdout)
    # Tier 2 — progressive fallback with different player client
    # Tier 3 — DASH (separate video+audio merged by ffmpeg → fragmented mp4)
    #           Required for VEVO / official music videos that have no format 18/22.
    #           yt-dlp uses frag_keyframe+empty_moov so piping to stdout works.
    _DASH_HD = (
        "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]"
        "/bestvideo[height<=720]+bestaudio"
        "/best[height<=720]"
    )
    _DASH_SD = (
        "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]"
        "/bestvideo[height<=480]+bestaudio"
        "/best[height<=480]"
    )
    _BASE_FORMATS = {
        "hd":    [("22/18", "web"), ("18", "tv_downgraded,web_embedded,ios"), (_DASH_HD, "tv_downgraded,web_embedded")],
        "sd":    [("18",    "web"), ("18", "tv_downgraded,web_embedded,ios"), (_DASH_SD, "tv_downgraded,web_embedded")],
        "audio": [(fmt_sel, "web"), (fmt_sel, "tv_downgraded,web_embedded,ios")],
    }
    _attempts = _BASE_FORMATS.get(quality, _BASE_FORMATS["hd"])

    # Build trim section string if start/end supplied
    _trim_start = start.strip()
    _trim_end   = end.strip()
    _trim_section: str | None = None
    if _trim_start or _trim_end:
        _s = _trim_start or "0"
        _e = _trim_end   or "inf"
        _trim_section = f"*{_s}-{_e}"

    def _build_cmd(fmt: str, client: str) -> list[str]:
        c = [
            sys.executable, "-m", "yt_dlp",
            "--format", fmt,
            "--output", stdout_target,
            "--no-part", "--no-progress",
            "--socket-timeout", "20",
            "--extractor-args", f"youtube:player_client={client}",
            "--remote-components", "ejs:github",
        ]
        if _trim_section:
            c += ["--download-sections", _trim_section,
                  "--force-keyframes-at-cuts"]
        if sticky_proxy: c += ["--proxy", sticky_proxy]
        if cookies_file: c += ["--cookies", cookies_file]
        c.append(url)
        return c

    async def stream_subprocess():
        bytes_sent = 0
        all_procs: list[asyncio.subprocess.Process] = []

        try:
            for attempt_num, (fmt, client) in enumerate(_attempts):
                print(f"[download-youtube] attempt {attempt_num+1}/{len(_attempts)} "
                      f"fmt={fmt} client={client}", flush=True)

                proc = await asyncio.create_subprocess_exec(
                    *_build_cmd(fmt, client),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                all_procs.append(proc)

                try:
                    first_chunk = await asyncio.wait_for(
                        proc.stdout.read(65536), timeout=25
                    )
                except asyncio.TimeoutError:
                    first_chunk = b""

                if not first_chunk:
                    # Read stderr, log it, check cookie alert, then try next attempt
                    try:
                        stderr_bytes = await asyncio.wait_for(
                            proc.stderr.read(), timeout=5
                        )
                        stderr_text = stderr_bytes.decode(errors="replace").strip()
                        if stderr_text:
                            print(f"[attempt {attempt_num+1} stderr] "
                                  f"{stderr_text[:500]}", flush=True)
                            asyncio.create_task(
                                _check_and_alert_cookie_error(url, stderr_text)
                            )
                    except Exception:
                        pass
                    try: proc.kill()
                    except Exception: pass
                    try: await proc.wait()
                    except Exception: pass
                    all_procs.remove(proc)

                    if attempt_num < len(_attempts) - 1:
                        print(f"[download-youtube] retrying…", flush=True)
                        continue
                    else:
                        print(f"[download-youtube] all attempts failed for {url}",
                              flush=True)
                        return

                # ── We have data — stream it ──────────────────────────────
                _MAX_BYTES = 500 * 1024 * 1024  # 500 MB hard cap (abuse prevention)
                yield first_chunk
                bytes_sent += len(first_chunk)

                while True:
                    chunk = await proc.stdout.read(65536)
                    if not chunk:
                        break
                    bytes_sent += len(chunk)
                    if bytes_sent > _MAX_BYTES:
                        print(f"[download-youtube] 500 MB cap reached — aborting {url}",
                              flush=True)
                        break
                    yield chunk

                # Drain stderr after successful stream
                try:
                    stderr_bytes = await asyncio.wait_for(
                        proc.stderr.read(), timeout=5
                    )
                    stderr_text = stderr_bytes.decode(errors="replace").strip()
                    if stderr_text:
                        print(f"[yt-dlp stderr] {stderr_text[:2000]}", flush=True)
                        asyncio.create_task(
                            _check_and_alert_cookie_error(url, stderr_text)
                        )
                except Exception:
                    pass
                break  # success — no more attempts needed

        finally:
            print(f"[download-youtube] sent {bytes_sent} bytes for {url}", flush=True)
            for p in all_procs:
                try: p.kill()
                except Exception: pass
                try: await p.wait()
                except Exception: pass
            if cookies_file:
                try: os.unlink(cookies_file)
                except Exception: pass

    return StreamingResponse(
        stream_subprocess(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_title}.{out_ext}"',
            "Cache-Control": "no-store",
        },
    )


# ── Async job queue (YouTube downloads that survive client disconnects) ────────

import uuid as _uuid
import shutil as _shutil2

_JOBS: dict[str, dict] = {}          # job_id → job state dict
_JOB_DIR = Path(tempfile.gettempdir()) / "rg_jobs"
_JOB_TTL = 3600  # seconds before completed jobs are cleaned up


def _job_path(job_id: str, ext: str) -> Path:
    _JOB_DIR.mkdir(exist_ok=True)
    return _JOB_DIR / f"{job_id}.{ext}"


def _prune_old_jobs() -> None:
    now = time.time()
    dead = [jid for jid, j in _JOBS.items()
            if now - j.get("created_at", 0) > _JOB_TTL]
    for jid in dead:
        fp = _JOBS[jid].get("file_path")
        if fp:
            try: Path(fp).unlink(missing_ok=True)
            except Exception: pass
        del _JOBS[jid]


async def _run_youtube_job(job_id: str, url: str, quality: str,
                           start: str, end: str) -> None:
    """Background task: run yt-dlp, write output to disk, update job state."""
    import sys as _sys

    job = _JOBS[job_id]
    job["status"] = "processing"

    safe_title = _extract_youtube_id(url)
    out_ext = "m4a" if quality == "audio" else "mp4"
    out_file = _job_path(job_id, out_ext)
    job["file_path"] = str(out_file)
    job["ext"] = out_ext
    job["filename"] = f"{safe_title}.{out_ext}"

    if quality == "audio":
        fmt_sel = "bestaudio[ext=m4a]/bestaudio"
    elif quality == "sd":
        # 18 = progressive 360p; fall back to DASH if not available (e.g. VEVO)
        fmt_sel = (
            "18"
            "/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]"
            "/bestvideo[height<=480]+bestaudio"
            "/best[height<=480]"
        )
    else:
        # 22 = progressive 720p, 18 = 360p; fall back to DASH if not available (e.g. VEVO)
        fmt_sel = (
            "22/18"
            "/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]"
            "/bestvideo[height<=720]+bestaudio"
            "/best[height<=720]"
        )

    cookies_file: str | None = None
    if YOUTUBE_COOKIES:
        try:
            tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
            tmp.write(YOUTUBE_COOKIES); tmp.close()
            cookies_file = tmp.name
        except Exception:
            pass

    sticky_proxy = _make_sticky_proxy(PROXY_URL) if PROXY_URL else None

    import shutil as _sh
    deno_path = _sh.which("deno")

    trim_section: str | None = None
    if start or end:
        trim_section = f"*{start or '0'}-{end or 'inf'}"

    cmd = [
        _sys.executable, "-m", "yt_dlp",
        "--format", fmt_sel,
        "--merge-output-format", "mp4",          # keep mp4 when DASH tracks are merged
        "--output", str(out_file),
        "--no-part", "--no-progress",
        "--socket-timeout", "20",
        "--extractor-args", "youtube:player_client=web",
        "--remote-components", "ejs:github",
        "--print", "after_move:filepath",        # print final path after download
    ]
    if trim_section:
        cmd += ["--download-sections", trim_section, "--force-keyframes-at-cuts"]
    if sticky_proxy:
        cmd += ["--proxy", sticky_proxy]
    if cookies_file:
        cmd += ["--cookies", cookies_file]
    cmd.append(url)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=300
        )
        stderr_text = stderr_bytes.decode(errors="replace").strip()
        if stderr_text:
            print(f"[job {job_id}] stderr: {stderr_text[:1000]}", flush=True)
            asyncio.create_task(_check_and_alert_cookie_error(url, stderr_text))

        if proc.returncode != 0 or not out_file.exists() or out_file.stat().st_size < 1000:
            job["status"] = "error"
            job["error"] = _clean_error(stderr_text) or "Download failed"
        else:
            job["status"] = "done"
            job["file_size"] = out_file.stat().st_size
            print(f"[job {job_id}] done — {job['file_size']} bytes", flush=True)
            # Fire-and-forget: cache to R2 if threshold met
            asyncio.create_task(_maybe_cache_to_r2(url, str(out_file), out_ext))

    except asyncio.TimeoutError:
        job["status"] = "error"
        job["error"] = "Download timed out (5 min limit)"
    except Exception as ex:
        job["status"] = "error"
        job["error"] = str(ex)
    finally:
        if cookies_file:
            try: os.unlink(cookies_file)
            except Exception: pass


@app.get("/api/cached-url")
async def check_cached_url(url: str = Query(...)):
    """Return R2 CDN URL if this URL has been cached, else null."""
    _, r2_key = _db_increment_url_count(url)
    if r2_key:
        cdn = _r2_public_url(r2_key)
        if cdn:
            return {"cached": True, "url": cdn}
    return {"cached": False, "url": None}


@app.post("/api/job")
@limiter.limit("10/minute")
async def create_job(
    request: Request,
    url:     str = Query(...),
    quality: str = Query("hd"),
    start:   str = Query(""),
    end:     str = Query(""),
):
    """Queue a YouTube download as a background job. Returns a job_id to poll."""
    if not re.search(r"youtube\.com|youtu\.be", url):
        raise HTTPException(status_code=400, detail="Job queue is for YouTube URLs only.")
    _prune_old_jobs()
    job_id = _uuid.uuid4().hex[:10]
    _JOBS[job_id] = {
        "status":     "pending",
        "created_at": time.time(),
        "url":        url,
        "quality":    quality,
        "file_path":  None,
        "file_size":  None,
        "ext":        None,
        "filename":   None,
        "error":      None,
    }
    asyncio.create_task(_run_youtube_job(job_id, url, quality, start, end))
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/job/{job_id}")
async def get_job(job_id: str):
    """Poll job status. Returns status, file_size when done, error when failed."""
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return {
        "job_id":    job_id,
        "status":    job["status"],       # pending | processing | done | error
        "file_size": job.get("file_size"),
        "filename":  job.get("filename"),
        "ext":       job.get("ext"),
        "error":     job.get("error"),
        "age":       int(time.time() - job["created_at"]),
    }


@app.get("/api/job/{job_id}/stream")
async def stream_job_file(job_id: str):
    """Download the completed job file. Deletes it from disk after streaming."""
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"Job not ready (status: {job['status']}).")
    fp = Path(job["file_path"])
    if not fp.exists():
        raise HTTPException(status_code=410, detail="File has already been downloaded or expired.")

    ext      = job.get("ext", "mp4")
    filename = job.get("filename", f"{job_id}.{ext}")
    media_type = "audio/mp4" if ext == "m4a" else "video/mp4"
    file_size  = fp.stat().st_size

    def iterfile():
        try:
            with open(fp, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk
        finally:
            try: fp.unlink(missing_ok=True)
            except Exception: pass

    return StreamingResponse(
        iterfile(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(file_size),
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/job/{job_id}/events")
async def job_events(job_id: str):
    """SSE stream — pushes status updates every second until the job finishes."""
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_stream():
        while True:
            j = _JOBS.get(job_id)
            if not j:
                yield f"data: {json.dumps({'status': 'expired'})}\n\n"
                return
            payload = {
                "status":    j["status"],
                "file_size": j.get("file_size"),
                "error":     j.get("error"),
            }
            yield f"data: {json.dumps(payload)}\n\n"
            if j["status"] in ("done", "error"):
                return
            await asyncio.sleep(1)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/download-tiktok")
async def download_tiktok(url: str = Query(...), quality: str = Query("hd")):
    """Download TikTok video server-side via yt-dlp and stream to browser."""
    safe_filename = re.sub(r'[^\w\-.]', '_', url.split('/')[-1].split('?')[0], flags=re.ASCII)[:40] or 'tiktok'

    tmp_dir = tempfile.mkdtemp()
    out_path = os.path.join(tmp_dir, f"{safe_filename}.mp4")

    fmt = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" if quality == "hd" \
        else "worstvideo[ext=mp4]+worstaudio/worst[ext=mp4]/worst"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "format": fmt,
        "outtmpl": out_path,
        "merge_output_format": "mp4",
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://www.tiktok.com/",
        },
        "extractor_retries": 5,
        "fragment_retries": 10,
        "concurrent_fragments": 4,
        "socket_timeout": 60,
    }
    if PROXY_URL:
        ydl_opts["proxy"] = PROXY_URL

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
        title = info.get("title", "tiktok_video")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Download failed: {str(e)}")

    # Find the actual output file (yt-dlp may adjust extension)
    actual = out_path
    if not os.path.exists(actual):
        candidates = list(Path(tmp_dir).glob("*.mp4"))
        if not candidates:
            raise HTTPException(status_code=500, detail="Output file not found")
        actual = str(candidates[0])

    clean_title = re.sub(r'[^\w\-.]', '_', title, flags=re.ASCII).strip('_')[:80] or safe_filename

    def iterfile():
        try:
            with open(actual, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk
        finally:
            try:
                os.unlink(actual)
                os.rmdir(tmp_dir)
            except Exception:
                pass

    file_size = os.path.getsize(actual)
    return StreamingResponse(
        iterfile(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_title}.mp4"',
            "Content-Length": str(file_size),
        },
    )


@app.get("/api/proxy")
async def proxy_download(url: str = Query(...), filename: str = Query("video"), ext: str = Query("mp4")):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": _referer_for(url),
    }
    safe_filename = re.sub(r'[^\w\-.]', '_', filename, flags=re.ASCII).strip('_')[:80] or 'video'
    _CT = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "webp": "image/webp", "png": "image/png", "gif": "image/gif",
        "m4a": "audio/mp4", "mp3": "audio/mpeg",
    }
    content_type = _CT.get(ext.lower(), "video/mp4")

    async def stream():
        async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
            async with client.stream("GET", url, headers=headers) as r:
                if r.status_code != 200:
                    raise HTTPException(status_code=r.status_code, detail="CDN fetch failed")
                async for chunk in r.aiter_bytes(chunk_size=65536):
                    yield chunk

    return StreamingResponse(
        stream(),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}.{ext}"'},
    )


@app.get("/api/counter")
def get_counter():
    db_count = _db_get_count()
    if db_count is not None:
        return {"count": db_count}
    return {"count": _COUNTER_BASE + _counter_session}


class TrackRequest(BaseModel):
    page: str

@app.post("/api/track")
async def track_page(req: TrackRequest):
    """Lightweight page-view / event tracker — fire-and-forget from frontend."""
    if req.page:
        _db_track_page(req.page.strip()[:255])
    return {"ok": True}


@app.get("/api/analytics")
def get_analytics():
    """Return page stats sorted by count descending."""
    conn = _get_db_conn()
    if not conn:
        return {"error": "db_unavailable", "rows": []}
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT page, count, last_seen
                FROM page_stats
                ORDER BY count DESC
                LIMIT 200
            """)
            rows = [
                {"page": r[0], "count": r[1], "last_seen": r[2].isoformat() if r[2] else None}
                for r in cur.fetchall()
            ]
        return {"rows": rows, "total_pages": len(rows)}
    except Exception as ex:
        return {"error": str(ex), "rows": []}
    finally:
        conn.close()


ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


def _require_admin(request: Request) -> None:
    """Raise 401 if the request doesn't supply the correct admin password."""
    if not ADMIN_PASSWORD:
        return  # no password configured → open access (Railway private network)
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    if token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    """Admin-only: aggregate stats for dashboard."""
    _require_admin(request)
    conn = _get_db_conn()
    rows: list[dict] = []
    total_count = _COUNTER_BASE + _counter_session
    platform_counts: list[dict] = []
    top_ips: list[dict] = []
    cookie_status: list[dict] = []

    if conn:
        try:
            with conn.cursor() as cur:
                # Total downloads
                cur.execute("SELECT count FROM counter WHERE id=1")
                r = cur.fetchone()
                if r:
                    total_count = r[0]

                # Per-platform breakdown
                cur.execute("""
                    SELECT page, count, last_seen FROM page_stats
                    WHERE page LIKE 'download:%'
                    ORDER BY count DESC
                """)
                platform_counts = [
                    {"platform": r[0].replace("download:", ""), "count": r[1],
                     "last_seen": r[2].isoformat() if r[2] else None}
                    for r in cur.fetchall()
                ]

                # Top IPs by today's quota usage
                cur.execute("""
                    SELECT ip, count FROM ip_quota
                    WHERE date = CURRENT_DATE
                    ORDER BY count DESC LIMIT 20
                """)
                top_ips = [{"ip": r[0], "today": r[1]} for r in cur.fetchall()]

                # Cookie alert status
                cur.execute("""
                    SELECT platform, fail_count, last_seen, alerted_at
                    FROM cookie_alerts ORDER BY last_seen DESC
                """)
                cookie_status = [
                    {"platform": r[0], "fail_count": r[1],
                     "last_seen": r[2].isoformat() if r[2] else None,
                     "alerted_at": r[3].isoformat() if r[3] else None}
                    for r in cur.fetchall()
                ]
        except Exception as ex:
            print(f"[admin] stats query failed: {ex}", flush=True)
        finally:
            conn.close()

    active_jobs = {jid: j["status"] for jid, j in _JOBS.items()}

    return {
        "total_downloads":  total_count,
        "platform_counts":  platform_counts,
        "top_ips_today":    top_ips,
        "cookie_alerts":    cookie_status,
        "proxy_configured": bool(PROXY_URL),
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        "active_jobs":      active_jobs,
        "job_queue_size":   len(_JOBS),
    }


@app.get("/api/cookie-status")
def get_cookie_status():
    """Return per-platform cookie failure stats and alert history."""
    rows = _db_get_cookie_status()
    return {
        "platforms": rows,
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
    }


@app.post("/api/cookie-reset")
async def reset_cookie_alerts(platform: str = Query(...)):
    """Reset failure counter for a platform after you've updated the cookies."""
    platform = platform.lower().strip()
    known = {"youtube", "instagram", "facebook", "tiktok", "twitter"}
    if platform not in known:
        raise HTTPException(status_code=400, detail=f"Unknown platform. Valid: {', '.join(sorted(known))}")
    _db_reset_cookie_alerts(platform)
    print(f"[cookie-alert] Reset alerts for {platform}", flush=True)
    return {"ok": True, "platform": platform}


@app.get("/api/transcript")
@limiter.limit("10/minute")
async def get_transcript(request: Request, url: str = Query(...)):
    """
    Return a plain-text transcript for a video URL using yt-dlp subtitle data.
    Tries manual captions first, then auto-generated captions.
    Only English tracks are returned; other languages return {transcript: null, error: "no_captions"}.
    """
    if not SUPPORTED_PATTERN.search(url):
        return {"transcript": None, "error": "unsupported_platform"}

    # Check subtitle cache first
    cached = _subtitle_cache_get(url)
    if cached:
        print(f"[subtitle cache] HIT for {url[:60]}", flush=True)
        return cached

    class _SilentLogger:
        def debug(self, msg): pass
        def warning(self, msg): pass
        def error(self, msg): pass

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "logger": _SilentLogger(),
        "check_formats": False,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
        "extractor_args": {
            "youtube": {
                "player_client": ["tv_downgraded", "web_embedded", "web_safari", "ios"],
            }
        },
        "extractor_retries": 5,
        "socket_timeout": 30,
    }
    if PROXY_URL:
        ydl_opts["proxy"] = PROXY_URL

    # Apply same cookie logic as the download endpoint
    if re.search(r"instagram\.com", url):
        cookie_content = INSTAGRAM_COOKIES or None
    elif re.search(r"youtube\.com|youtu\.be", url):
        cookie_content = YOUTUBE_COOKIES or None
    else:
        cookie_content = COOKIES or None

    cookies_file = None
    if cookie_content:
        try:
            tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            tmp.write(cookie_content)
            tmp.close()
            cookies_file = tmp.name
            ydl_opts["cookiefile"] = cookies_file
        except Exception:
            pass

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        result = {"transcript": None, "error": f"extraction_failed"}
        print(f"[transcript] extraction error: {e}", flush=True)
        return result
    finally:
        if cookies_file:
            try:
                os.unlink(cookies_file)
            except Exception:
                pass

    if not info:
        return {"transcript": None, "error": "no_info"}

    # Try manual subtitles first, then automatic captions
    subs = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}

    lang, ext, sub_url = _find_subtitle(subs)
    source = "manual"
    if not sub_url:
        lang, ext, sub_url = _find_subtitle(auto)
        source = "auto"

    if not sub_url:
        result = {"transcript": None, "error": "no_captions"}
        _subtitle_cache_set(url, result)
        return result

    # Fetch the subtitle file content
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(sub_url, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code != 200:
                return {"transcript": None, "error": "subtitle_fetch_failed"}
            content = r.text
    except Exception as e:
        return {"transcript": None, "error": "subtitle_fetch_error"}

    # Parse to plain text
    if ext == "json3":
        transcript = _parse_json3(content)
    else:
        transcript = _parse_vtt(content)

    if not transcript or not transcript.strip():
        result = {"transcript": None, "error": "empty_captions"}
        _subtitle_cache_set(url, result)
        return result

    # Truncate very long transcripts (e.g. 2-hour videos)
    MAX_CHARS = 8000
    truncated = False
    if len(transcript) > MAX_CHARS:
        transcript = transcript[:MAX_CHARS].rsplit(' ', 1)[0]
        truncated = True

    result = {
        "transcript": transcript,
        "lang": lang,
        "source": source,
        "truncated": truncated,
    }
    _subtitle_cache_set(url, result)
    print(f"[transcript] OK — {lang}/{source}, {len(transcript)} chars, truncated={truncated}", flush=True)
    return result


@app.get("/api/healthz")
def healthz():
    """Lightweight keep-warm endpoint — ping every 4 min via UptimeRobot to prevent cold starts."""
    return {"status": "ok"}

@app.get("/health")
def health():
    db_ok = False
    try:
        conn = _get_db_conn()
        if conn:
            conn.close()
            db_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "db": "ok" if db_ok else "unavailable",
        "proxy": "configured" if PROXY_URL else "none",
        "cache_entries": len(_CACHE),
    }
