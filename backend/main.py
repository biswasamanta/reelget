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
    # Authorization is required so the admin dashboard can send its Bearer token
    # cross-origin (reelget.com → railway.app) without CORS blocking the preflight.
    allow_headers=["Content-Type", "Authorization"],
)

SUPPORTED_PATTERN = re.compile(
    r"(instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co|pinterest\.com|pin\.it|snapchat\.com|story\.snapchat\.com|linkedin\.com|reddit\.com|redd\.it|vimeo\.com|dailymotion\.com|dai\.ly|twitch\.tv|clips\.twitch\.tv|threads\.net|threads\.com)"
)

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
# Universal cookie jar (Netscape format) exported from a browser logged into all platforms.
# Platform-specific vars override it for their respective domains.
COOKIES = os.environ.get("COOKIES", "")
YOUTUBE_COOKIES = os.environ.get("YOUTUBE_COOKIES", COOKIES)
INSTAGRAM_COOKIES = os.environ.get("INSTAGRAM_COOKIES", COOKIES)
# Facebook needs a logged-in session to server-render video data; falls back to COOKIES.
FACEBOOK_COOKIES = os.environ.get("FACEBOOK_COOKIES", COOKIES)
# Outbound proxy for yt-dlp requests (helps bypass datacenter IP blocks).
# Format: http://user:pass@host:port  — leave unset to use direct connection.
PROXY_URL = os.environ.get("PROXY_URL", "")
# HikerAPI key — managed Instagram extraction (https://hikerapi.com).
# When set, Instagram reels are resolved via HikerAPI (reliable, no proxy/cookies
# needed). ~$0.0006/request. Leave unset to fall back to free scraping methods.
HIKER_API_KEY = os.environ.get("HIKER_API_KEY", "")
# RapidAPI Facebook downloader — managed Facebook extraction (Facebook never
# embeds the video URL in page HTML, so a managed API is required).
# Set FB_RAPIDAPI_KEY (your RapidAPI key) and FB_RAPIDAPI_HOST (the API's host).
# Defaults target the "Social Media Video Downloader" (facebook-reel-and-video-downloader).
FB_RAPIDAPI_KEY  = os.environ.get("FB_RAPIDAPI_KEY", "")
FB_RAPIDAPI_HOST = os.environ.get("FB_RAPIDAPI_HOST", "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com")
FB_RAPIDAPI_PATH = os.environ.get("FB_RAPIDAPI_PATH", "/get-info-rapidapi")
# Telegram alerting — set both vars to enable cookie-expiry notifications
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
# Web Push (VAPID) — set all three to enable browser push notifications.
# Generate a keypair once; private key stays here, public key also goes to the
# frontend as NEXT_PUBLIC_VAPID_PUBLIC_KEY. VAPID_SUBJECT is a mailto: or https URL.
VAPID_PUBLIC_KEY  = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT     = os.environ.get("VAPID_SUBJECT", "mailto:admin@reelget.com")
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

                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    endpoint   TEXT PRIMARY KEY,
                    p256dh     TEXT NOT NULL,
                    auth       TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                -- Per-day buckets so the admin dashboard can filter by date range.
                CREATE TABLE IF NOT EXISTS daily_stats (
                    day    DATE         NOT NULL,
                    metric VARCHAR(255) NOT NULL,
                    count  BIGINT       NOT NULL DEFAULT 0,
                    PRIMARY KEY (day, metric)
                );
                CREATE INDEX IF NOT EXISTS idx_daily_stats_day ON daily_stats (day);
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
            # Per-day bucket (for date-range filtering in the admin dashboard).
            cur.execute("""
                INSERT INTO daily_stats (day, metric, count)
                VALUES (CURRENT_DATE, %s, 1)
                ON CONFLICT (day, metric) DO UPDATE
                SET count = daily_stats.count + 1
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


async def _paid_services_reminder_loop() -> None:
    """Background task: monthly Telegram reminder to review paid-service balances."""
    INTERVAL_SEC = 30 * 24 * 3600   # every 30 days
    CHECK_SEC    = 6 * 3600
    await asyncio.sleep(300)
    while True:
        try:
            last_str = _db_get_config("paid_services_reminder_sent_at")
            last_ts  = float(last_str) if last_str else 0.0
            if time.time() - last_ts >= INTERVAL_SEC:
                msg = (
                    "💳 <b>Monthly Paid-Services Review</b>\n\n"
                    "Check balances / renewals so nothing lapses:\n"
                    "• <b>Webshare</b> (residential proxy) — check data + plan renewal\n"
                    "• <b>HikerAPI</b> (Instagram) — check account balance\n"
                    "• <b>RapidAPI / fastsaverapi</b> (Facebook) — check monthly quota usage\n"
                    "• <b>Railway</b> — check usage / billing\n"
                    "• <b>Vercel</b> — check plan if traffic grew\n\n"
                    "<i>Scheduled monthly reminder — not an error.</i>"
                )
                await _send_telegram_alert(msg)
                _db_set_config("paid_services_reminder_sent_at", str(time.time()))
        except Exception as ex:
            print(f"[paid-reminder] loop error: {ex}", flush=True)
        await asyncio.sleep(CHECK_SEC)


def _get_trending_title() -> str | None:
    """Best-effort: read the freshest cached YouTube-trending title for the push."""
    try:
        if not CACHE_DIR.exists():
            return None
        files = sorted(CACHE_DIR.glob("trending_*.json"),
                       key=lambda f: f.stat().st_mtime, reverse=True)
        for f in files:
            data = json.loads(f.read_text(encoding="utf-8"))
            vids = data.get("videos") or []
            if vids and vids[0].get("title"):
                return vids[0]["title"]
    except Exception:
        pass
    return None


async def _weekly_trending_push_loop() -> None:
    """Background task: once a week, push trending content to all subscribers."""
    INTERVAL_SEC = 7 * 24 * 3600
    CHECK_SEC    = 6 * 3600
    await asyncio.sleep(600)
    while True:
        try:
            if VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY:
                last_str = _db_get_config("weekly_push_sent_at")
                last_ts  = float(last_str) if last_str else 0.0
                if time.time() - last_ts >= INTERVAL_SEC:
                    # Skip silently if nobody is subscribed yet.
                    if _db_get_push_subscriptions():
                        title = _get_trending_title()
                        if title:
                            t = "🔥 Trending this week"
                            body = f"“{title[:80]}” and more — tap to download free on ReelGet."
                        else:
                            t = "🔥 This week's trending videos"
                            body = "The most-shared clips are waiting — tap to grab them on ReelGet."
                        result = await asyncio.get_event_loop().run_in_executor(
                            None, _send_web_push_sync, t, body, "https://www.reelget.com/"
                        )
                        print(f"[weekly-push] {result}", flush=True)
                    _db_set_config("weekly_push_sent_at", str(time.time()))
        except Exception as ex:
            print(f"[weekly-push] loop error: {ex}", flush=True)
        await asyncio.sleep(CHECK_SEC)


@app.on_event("startup")
async def _startup():
    asyncio.create_task(_cookie_reminder_loop())
    print("[startup] cookie reminder loop started", flush=True)
    asyncio.create_task(_selftest_loop())
    print("[startup] daily platform self-test loop started", flush=True)
    asyncio.create_task(_paid_services_reminder_loop())
    print("[startup] paid-services reminder loop started", flush=True)
    asyncio.create_task(_weekly_trending_push_loop())
    print("[startup] weekly trending push loop started", flush=True)


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


def _cache_and_return(url: str, title: str, thumbnail, video_url: str,
                      label: str = "Video (HD)", ext: str = "mp4"):
    """Cache a single-format fallback result, then return it.

    The paid/fallback extractors (HikerAPI, RapidAPI, GraphQL, etc.) return
    directly and would otherwise bypass the in-memory result cache — meaning a
    repeat download of the same URL within the TTL re-hits the paid API. Routing
    those returns through here caches them, so repeats are served free.
    """
    response_data = {
        "title": title,
        "thumbnail": thumbnail,
        "formats": [FormatInfo(label=label, url=video_url, ext=ext)],
        "duration": None,
    }
    _cache_set(url, response_data)
    return DownloadResponse(**response_data)


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


def _normalize_url(url: str) -> str:
    """Strip tracking/share tokens that can confuse extractors.

    Removes:
      - Instagram: igsh=, utm_source=, utm_medium=, utm_campaign=
      - TikTok: _r=, _t=
      - Generic: utm_* parameters
    """
    from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse
    _STRIP_PARAMS = {
        "igsh", "utm_source", "utm_medium", "utm_campaign",
        "utm_content", "utm_term", "_r", "_t", "si", "xmt", "hl",
    }
    try:
        parsed = urlparse(url)
        qs = [(k, v) for k, v in parse_qsl(parsed.query) if k not in _STRIP_PARAMS]
        cleaned = urlunparse(parsed._replace(query=urlencode(qs)))
        if cleaned != url:
            print(f"[normalize] {url[:80]} → {cleaned[:80]}", flush=True)
        return cleaned
    except Exception:
        return url


async def _twitter_fxapi_extract(url: str) -> dict | None:
    """
    Extract Twitter/X video via the public fxtwitter API (api.fxtwitter.com).
    Free, no auth, no proxy needed. Works for any public tweet with video.

    Returns dict with title, thumbnail, video_url (highest quality) — or None.
    """
    # Tweet ID is the trailing numeric segment of /status/{id}
    id_m = re.search(r"/status(?:es)?/(\d+)", url)
    if not id_m:
        return None
    tweet_id = id_m.group(1)

    # fxtwitter mirrors (try in order); each returns JSON with media info
    hosts = ["api.fxtwitter.com", "api.vxtwitter.com"]
    for host in hosts:
        try:
            api_url = f"https://{host}/status/{tweet_id}"
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as _hc:
                _r = await _hc.get(api_url, headers={"User-Agent": "Mozilla/5.0 (compatible; ReelGet/1.0)"})
            print(f"[twitter-fx] {host} → HTTP {_r.status_code}", flush=True)
            if _r.status_code != 200:
                continue
            data = _r.json()
            video_url = None
            title = "Twitter Video"
            thumb = None
            if host == "api.fxtwitter.com":
                tweet = data.get("tweet") or {}
                title = (tweet.get("text") or "Twitter Video")[:120]
                media = tweet.get("media") or {}
                videos = media.get("videos") or []
                if videos:
                    # pick highest bitrate variant
                    best = max(videos, key=lambda v: v.get("bitrate", 0) or 0)
                    video_url = best.get("url")
                    thumb = best.get("thumbnail_url") or videos[0].get("thumbnail_url")
            else:  # vxtwitter format
                title = (data.get("text") or "Twitter Video")[:120]
                mediaurls = data.get("mediaURLs") or []
                # vxtwitter media_extended has type info
                ext = data.get("media_extended") or []
                vids = [m for m in ext if m.get("type") == "video"]
                if vids:
                    video_url = vids[0].get("url")
                    thumb = vids[0].get("thumbnail_url")
                elif mediaurls:
                    video_url = mediaurls[0]
            if video_url:
                print(f"[twitter-fx] success ({host}) → {title[:50]!r}", flush=True)
                return {"title": title, "thumbnail": thumb, "video_url": video_url}
            print(f"[twitter-fx] {host}: no video in tweet", flush=True)
        except Exception as _te:
            print(f"[twitter-fx] {host} error: {_te}", flush=True)
    return None


async def _dailymotion_extract(url: str) -> dict | None:
    """Resolve a Dailymotion video via the public player metadata endpoint,
    bypassing yt-dlp's OAuth-token path (currently broken upstream — every
    request 401s because Dailymotion rotated the bundled client token, see
    yt-dlp issue #4727).

    GET https://www.dailymotion.com/player/metadata/video/{id} returns JSON with
    a `qualities` map: progressive MP4 entries keyed by height, plus an `auto`
    HLS manifest. We prefer a direct MP4 when present (simplest download), else
    return the HLS manifest URL to be streamed via /api/download-hls.

    Returns {title, thumbnail, mp4_url?|hls_url?} or None.
    """
    m = re.search(r'(?:dailymotion\.com/(?:video|embed/video)/|dai\.ly/)([A-Za-z0-9]+)', url)
    if not m:
        return None
    vid = m.group(1)
    api = f"https://www.dailymotion.com/player/metadata/video/{vid}"
    headers = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
        "Referer": "https://www.dailymotion.com/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get(api, headers=headers)
        print(f"[dailymotion] metadata → HTTP {r.status_code}", flush=True)
        if r.status_code != 200:
            return None
        data = r.json()
        if data.get("error"):
            print(f"[dailymotion] error: {str(data.get('error'))[:120]}", flush=True)
            return None
        title = data.get("title") or "Dailymotion Video"
        posters = data.get("posters") or {}
        thumb = None
        if isinstance(posters, dict) and posters:
            # pick the highest-res poster (keys are widths as strings)
            try:
                thumb = posters[max(posters, key=lambda k: int(k))]
            except Exception:
                thumb = next(iter(posters.values()), None)

        qualities = data.get("qualities") or {}
        # Prefer a progressive MP4 (highest height that isn't 'auto').
        best_mp4 = None
        best_h = -1
        for qkey, entries in qualities.items():
            if qkey == "auto" or not isinstance(entries, list):
                continue
            for e in entries:
                if not isinstance(e, dict):
                    continue
                typ = (e.get("type") or "").lower()
                u = e.get("url")
                if u and "mp4" in typ:
                    try:
                        h = int(re.sub(r"\D", "", qkey) or 0)
                    except Exception:
                        h = 0
                    if h > best_h:
                        best_h, best_mp4 = h, u
        if best_mp4:
            print(f"[dailymotion] success (mp4 {best_h}p) → {str(title)[:50]!r}", flush=True)
            return {"title": str(title)[:120], "thumbnail": thumb, "mp4_url": best_mp4}

        # Fall back to the adaptive HLS manifest.
        auto = qualities.get("auto") or []
        hls = auto[0].get("url") if auto and isinstance(auto[0], dict) else None
        if hls:
            print(f"[dailymotion] success (hls) → {str(title)[:50]!r}", flush=True)
            return {"title": str(title)[:120], "thumbnail": thumb, "hls_url": hls}

        print("[dailymotion] no playable quality in metadata", flush=True)
        return None
    except Exception as ex:
        print(f"[dailymotion] error: {ex}", flush=True)
        return None


async def _rapidapi_extract(url: str) -> dict | None:
    """
    Resolve a video via the RapidAPI (fastsaverapi) universal downloader.
    fastsaverapi supports ~50 platforms (Facebook, Instagram, TikTok, YouTube,
    Twitter, Vimeo, Reddit, Pinterest, Snapchat, Threads, etc.), so this doubles
    as a universal LAST-RESORT fallback for any platform whose primary method fails.
    Configurable via FB_RAPIDAPI_KEY / FB_RAPIDAPI_HOST / FB_RAPIDAPI_PATH.

    Parses a wide range of response shapes (medias/links/formats arrays, hd/sd
    fields) so it's resilient across providers.
    """
    if not FB_RAPIDAPI_KEY:
        return None
    import urllib.parse as _up
    api_url = f"https://{FB_RAPIDAPI_HOST}{FB_RAPIDAPI_PATH}?url={_up.quote(url, safe='')}"
    headers = {
        "x-rapidapi-key": FB_RAPIDAPI_KEY,
        "x-rapidapi-host": FB_RAPIDAPI_HOST,
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(api_url, headers=headers)
        print(f"[fb-api] {FB_RAPIDAPI_HOST} → HTTP {r.status_code}", flush=True)
        if r.status_code != 200:
            print(f"[fb-api] body: {r.text[:200]}", flush=True)
            return None
        data = r.json()
        # Unwrap a "data"/"result" envelope if present.
        if isinstance(data.get("data"), dict):
            data = {**data, **data["data"]}

        # Collect candidate (label, url, is_video) tuples from many shapes.
        candidates: list[tuple[str, str, bool]] = []

        def _add(label, val, is_video=True):
            if isinstance(val, str) and val.startswith("http"):
                candidates.append((str(label).lower(), val, is_video))

        # fastsaverapi shape: {"medias": [{"url","quality","type","extension"}]}
        for arrkey in ("medias", "media", "formats", "result", "videos", "links"):
            arr = data.get(arrkey)
            if isinstance(arr, list):
                for item in arr:
                    if isinstance(item, dict):
                        _typ = (item.get("type") or "").lower()
                        is_vid = ("video" in _typ) or (not _typ and not item.get("is_audio"))
                        _add(item.get("quality") or item.get("label") or arrkey,
                             item.get("url") or item.get("link") or item.get("src"),
                             is_vid)
            elif isinstance(arr, dict):
                for k, v in arr.items():
                    _add(k, v)
        # flat hd/sd fields
        for k in ("hd", "sd", "hd_url", "sd_url", "url", "video", "video_url",
                  "download", "downloadUrl", "download_url", "downloadURL",
                  "videoUrl", "play", "play_url", "hdplay", "high", "low"):
            _add(k, data.get(k))

        # Prefer actual video entries.
        video_cands = [c for c in candidates if c[2]] or candidates
        candidates = video_cands

        if not candidates:
            _err = data.get("error") or data.get("message") or data.get("msg")
            print(f"[fb-api] no video url in response keys: {list(data.keys())[:12]}"
                  f" error={_err!r} body={r.text[:300]}", flush=True)
            return None

        # Prefer HD/high quality.
        def _score(label):
            l = label.lower()
            if "hd" in l or "high" in l or "720" in l or "1080" in l: return 2
            if "sd" in l or "low" in l: return 0
            return 1
        candidates.sort(key=lambda c: _score(c[0]), reverse=True)
        video_url = candidates[0][1]

        title = (data.get("title") or data.get("caption")
                 or (data.get("meta") or {}).get("title") or "Facebook Video")
        thumb = (data.get("thumbnail") or data.get("thumb")
                 or data.get("image") or (data.get("meta") or {}).get("image"))
        print(f"[fb-api] success → {str(title)[:50]!r}", flush=True)
        return {"title": str(title)[:120], "thumbnail": thumb, "video_url": video_url}
    except Exception as ex:
        print(f"[fb-api] error: {ex}", flush=True)
        return None


def _fb_walk_json(obj):
    """Yield every dict in a nested JSON structure (for scanning Relay blobs)."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _fb_walk_json(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _fb_walk_json(v)


async def _facebook_html_extract(url: str) -> dict | None:
    """
    Extract a public Facebook video URL using curl_cffi (Chrome TLS impersonation)
    to fetch the page, then walk the embedded `data-sjs`/ScheduledServerJS Relay
    JSON for videoDeliveryResponseFragment → progressive_urls[].progressive_url.

    Facebook serves the real video JSON ONLY to clients with a real browser TLS
    fingerprint — plain httpx/requests get a stripped page (hence the prior
    "no video url" failures). Routed through the residential proxy + cookies
    (fbcdn URLs are IP-bound, so the download must use the same proxy).

    Returns dict with title, thumbnail, video_url — or None.
    """
    cookies = _parse_netscape_cookies(FACEBOOK_COOKIES) if FACEBOOK_COOKIES else {}

    def _sync_fb() -> dict | None:
        try:
            from curl_cffi import requests as cf_requests
        except ImportError:
            print("[fb] curl_cffi not available", flush=True)
            return None
        try:
            session = cf_requests.Session(impersonate="chrome124")
            if PROXY_URL:
                session.proxies = {"http": PROXY_URL, "https": PROXY_URL}
            for k, v in cookies.items():
                session.cookies.set(k, v, domain=".facebook.com")
            resp = session.get(
                url,
                headers={"Accept-Language": "en-US,en;q=0.9"},
                timeout=30,
            )
            print(f"[fb] page → HTTP {resp.status_code} ({len(resp.text)} bytes)", flush=True)
            if resp.status_code != 200:
                return None
            html = resp.text

            # Diagnostics: detect login wall + whether video data is present at all.
            _has_frag = "videoDeliveryResponseFragment" in html
            _has_prog = "progressive_url" in html
            _login_wall = ("You must log in to continue" in html
                           or '"loginredirect"' in html.lower()
                           or "login_form" in html)
            blobs = re.findall(r'data-sjs>({.*?ScheduledServerJS.*?})</script>', html, re.DOTALL)
            print(f"[fb] diag: sjs_blobs={len(blobs)} has_frag={_has_frag} "
                  f"has_progressive={_has_prog} login_wall={_login_wall}", flush=True)

            best = {}   # quality -> url
            legacy = {}
            for blob in blobs:
                try:
                    data = json.loads(blob)
                except Exception:
                    continue
                for node in _fb_walk_json(data):
                    if not isinstance(node, dict):
                        continue
                    # Modern delivery fragment (2026)
                    frag = node.get("videoDeliveryResponseFragment")
                    vr = frag.get("videoDeliveryResponseResult") if isinstance(frag, dict) else None
                    if isinstance(vr, dict):
                        for p in (vr.get("progressive_urls") or []):
                            q = ((p.get("metadata") or {}).get("quality") or "?")
                            if p.get("progressive_url"):
                                best[q] = p["progressive_url"]
                    # Legacy flat keys (older/embedded videos)
                    for k in ("playable_url_quality_hd", "playable_url",
                              "browser_native_hd_url", "browser_native_sd_url"):
                        if node.get(k) and k not in legacy:
                            legacy[k] = node[k]

            # Prefer HD progressive, then SD, then legacy HD→SD.
            video_url = (
                best.get("HD") or best.get("SD")
                or (next(iter(best.values())) if best else None)
                or legacy.get("playable_url_quality_hd")
                or legacy.get("browser_native_hd_url")
                or legacy.get("playable_url")
                or legacy.get("browser_native_sd_url")
            )
            # Raw-regex fallback: search the whole HTML (and an unescaped copy)
            # for progressive_url / playable_url even if JSON parsing missed it.
            if not video_url:
                norm = html.replace('\\/', '/').replace('\\u0025', '%')
                for src in (html, norm):
                    for key in ("progressive_url", "playable_url_quality_hd",
                                "playable_url", "browser_native_hd_url",
                                "browser_native_sd_url"):
                        m = re.search(rf'"{key}"\s*:\s*"(https?:[^"\\]+(?:\\.[^"\\]*)*)"', src)
                        if m:
                            video_url = m.group(1)
                            break
                    if video_url:
                        break

            if not video_url:
                print(f"[fb] no progressive/legacy url found", flush=True)
                return None
            video_url = video_url.replace("\\/", "/").replace("\\u0026", "&").replace("&amp;", "&")

            # Title/thumbnail from og: meta tags (not escaped)
            _tm = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html)
            _im = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html)
            title = (_tm.group(1) if _tm else "Facebook Video").replace("&amp;", "&")
            thumb = (_im.group(1).replace("\\/", "/").replace("&amp;", "&") if _im else None)
            print(f"[fb] success ({'/'.join(best.keys()) or 'legacy'}) → {title[:50]!r}", flush=True)
            return {"title": title[:120], "thumbnail": thumb, "video_url": video_url}
        except Exception as _fe:
            print(f"[fb] error: {_fe}", flush=True)
            return None

    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _sync_fb)


def _parse_netscape_cookies(cookie_str: str) -> dict:
    """Parse a Netscape cookie file string into a name→value dict."""
    cookies = {}
    for line in cookie_str.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) >= 7:
            cookies[parts[5]] = parts[6]
    return cookies


async def _instagram_hiker_extract(url: str) -> dict | None:
    """
    Resolve an Instagram reel via HikerAPI (managed Instagram API).
    Reliable — HikerAPI handles all proxy/cookie/bot-detection on their side.
    Requires HIKER_API_KEY. ~$0.0006/request.

    Endpoint: GET https://api.hikerapi.com/v2/media/info/by/code?code={shortcode}
    Auth: x-access-key header
    """
    if not HIKER_API_KEY:
        return None
    shortcode_m = re.search(r"/(reel|reels|p|tv)/([A-Za-z0-9_-]+)", url)
    if not shortcode_m:
        return None
    shortcode = shortcode_m.group(2)

    headers = {"x-access-key": HIKER_API_KEY, "accept": "application/json"}
    # v2 endpoint preferred; v1 as fallback (different response shape)
    endpoints = [
        f"https://api.hikerapi.com/v2/media/info/by/code?code={shortcode}",
        f"https://api.hikerapi.com/v1/media/by/code?code={shortcode}",
    ]
    for api_url in endpoints:
        try:
            async with httpx.AsyncClient(timeout=30.0) as _hc:
                _r = await _hc.get(api_url, headers=headers)
            print(f"[ig-hiker] {api_url.split('?')[0]} → HTTP {_r.status_code}", flush=True)
            if _r.status_code != 200:
                continue
            data = _r.json()
            # v2 wraps the media in a "media" key; v1 returns it at top level
            media = data.get("media") or data
            # Find video URL across known shapes
            video_url = (
                media.get("video_url")
                or ((media.get("video_versions") or [{}])[0].get("url"))
            )
            if not video_url:
                print(f"[ig-hiker] no video_url in response keys: {list(media.keys())[:12]}", flush=True)
                continue
            title = (
                media.get("caption_text")
                or (media.get("caption") or {}).get("text")
                or media.get("title")
                or "Instagram Reel"
            )
            thumb = (
                media.get("thumbnail_url")
                or media.get("display_url")
                or ((media.get("image_versions2") or {}).get("candidates") or [{}])[0].get("url")
            )
            print(f"[ig-hiker] success → {str(title)[:60]!r}", flush=True)
            return {"title": str(title)[:120], "thumbnail": thumb, "video_url": video_url}
        except Exception as _he:
            print(f"[ig-hiker] error for {api_url}: {_he}", flush=True)
    return None


async def _instagram_graphql_extract(url: str, cookie_str: str) -> dict | None:
    """
    Extract Instagram reel video URL via the internal GraphQL endpoint.
    Uses curl_cffi for TLS fingerprint spoofing (required — Instagram blocks
    standard Python TLS before even checking auth).

    Endpoint: POST https://www.instagram.com/api/graphql
    doc_id rotates every 2–4 weeks; try all known values.
    """
    shortcode_m = re.search(r"/(reel|p|tv)/([A-Za-z0-9_-]+)", url)
    if not shortcode_m:
        return None
    shortcode = shortcode_m.group(2)

    cookies = _parse_netscape_cookies(cookie_str) if cookie_str else {}

    def _sync_graphql() -> dict | None:
        try:
            from curl_cffi import requests as cf_requests
        except ImportError:
            print("[ig-gql] curl_cffi not available", flush=True)
            return None

        session = cf_requests.Session(impersonate="chrome124")
        if PROXY_URL:
            session.proxies = {"http": PROXY_URL, "https": PROXY_URL}

        # Seed session first (do NOT inject user cookies yet — seed sets Instagram's
        # own anonymous cookies; we inject ours AFTER so they take precedence).
        csrf = cookies.get("csrftoken", "")
        lsd = ""
        try:
            _seed = session.get(
                "https://www.instagram.com/",
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Upgrade-Insecure-Requests": "1",
                },
                timeout=15,
            )
            # Extract lsd token from page HTML (format: "LSD":{"token":"VALUE"})
            _lsd_m = re.search(r'"LSD"\s*,\s*\[\s*\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"', _seed.text) \
                  or re.search(r'"token"\s*:\s*"([^"]+)"[^}]*"LSD"', _seed.text) \
                  or re.search(r'"lsd["\s:,\[]+([A-Za-z0-9_-]{8,})', _seed.text)
            if _lsd_m:
                lsd = _lsd_m.group(1)
                print(f"[ig-gql] extracted lsd={lsd[:12]}...", flush=True)
            else:
                lsd = session.cookies.get("lsd", "")
                print(f"[ig-gql] lsd from cookie={lsd[:12] if lsd else 'not found'}", flush=True)
        except Exception as _se:
            print(f"[ig-gql] seed error: {_se}", flush=True)

        # NOW inject user session cookies (overrides any anonymous ones from seed)
        for k, v in cookies.items():
            session.cookies.set(k, v, domain=".instagram.com")
        # Use our csrf if available (more trusted than anonymous one)
        if cookies.get("csrftoken"):
            csrf = cookies["csrftoken"]
            session.cookies.set("csrftoken", csrf, domain=".instagram.com")

        # doc_id rotates every 2-4 weeks; try all known working values
        DOC_IDS = [
            "10015901848480474",   # active early 2026 (socialcrawl.dev)
            "8845758582119845",    # yt-dlp current
            "24368985919464652",   # instapydl
            "25981206651899035",   # alternate
        ]

        for doc_id in DOC_IDS:
            try:
                resp = session.post(
                    "https://www.instagram.com/api/graphql",
                    data={
                        "variables": json.dumps({"shortcode": shortcode}),
                        "doc_id": doc_id,
                        "lsd": lsd,
                    },
                    headers={
                        "Accept": "application/json",
                        "X-IG-App-ID": "936619743392459",
                        "X-FB-LSD": lsd,
                        "X-ASBD-ID": "129477",
                        "X-CSRFToken": csrf,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Sec-Fetch-Site": "same-origin",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Dest": "empty",
                        "Referer": f"https://www.instagram.com/reel/{shortcode}/",
                        "Origin": "https://www.instagram.com",
                    },
                    timeout=20,
                )
                _ct = resp.headers.get("content-type", "?")[:40]
                print(f"[ig-gql] doc_id={doc_id} HTTP {resp.status_code} ct={_ct} len={len(resp.text)}", flush=True)
                print(f"[ig-gql] doc_id={doc_id} → HTTP {resp.status_code}", flush=True)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                d = data.get("data") or {}
                # Path 1: xdt_shortcode_media (GraphQL v1)
                media = d.get("xdt_shortcode_media")
                if media:
                    video_url = media.get("video_url")
                    if video_url:
                        edges = ((media.get("edge_media_to_caption") or {}).get("edges") or [])
                        caption = edges[0].get("node", {}).get("text", "") if edges else ""
                        thumb = media.get("thumbnail_src") or media.get("display_url")
                        print(f"[ig-gql] path1 success → {caption[:50]!r}", flush=True)
                        return {"title": caption[:100] or "Instagram Reel", "thumbnail": thumb, "video_url": video_url}
                # Path 2: xdt_api__v1__media__shortcode__web_info (API v2)
                items = (d.get("xdt_api__v1__media__shortcode__web_info") or {}).get("items") or []
                if items:
                    m2 = items[0]
                    vv = m2.get("video_versions") or []
                    if vv:
                        video_url = vv[0].get("url")
                        if video_url:
                            cap = (m2.get("caption") or {}).get("text") or "Instagram Reel"
                            thumb = ((m2.get("image_versions2") or {}).get("candidates") or [{}])[0].get("url")
                            print(f"[ig-gql] path2 success → {cap[:50]!r}", flush=True)
                            return {"title": cap[:100], "thumbnail": thumb, "video_url": video_url}
                print(f"[ig-gql] doc_id={doc_id} no video in response keys: {list(d.keys())}", flush=True)
            except Exception as _e:
                print(f"[ig-gql] doc_id={doc_id} error: {_e}", flush=True)
        return None

    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _sync_graphql)


async def _instagram_web_api_extract(url: str, cookie_str: str) -> dict | None:
    """
    Scrape the Instagram reel page directly (with session cookies + proxy) and
    extract video URL from og:video meta tag. Instagram always sets this for
    public reels. Works because we present as a browser from a residential IP.

    Also tries the /api/v1/media/shortcode/web_info/ endpoint.
    """
    shortcode_m = re.search(r"/(reel|p|tv)/([A-Za-z0-9_-]+)", url)
    if not shortcode_m:
        return None
    shortcode = shortcode_m.group(2)

    cookies = _parse_netscape_cookies(cookie_str) if cookie_str else {}

    # Instagram only includes og:video in the SSR HTML when it thinks a social
    # media crawler is fetching the page. With a browser UA it serves a JS shell.
    # Try several known crawler UAs that Instagram serves full SSR to.
    _crawler_uas = [
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Twitterbot/1.0",
        "WhatsApp/2.22.8.79 A",
        "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient/4.1.1 +http://www.linkedin.com)",
    ]

    def _scrape_og(html: str) -> dict | None:
        _vu = (re.search(r'<meta\s+property=["\']og:video["\']\s+content=["\']([^"\']+)["\']', html)
               or re.search(r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:video["\']', html))
        if not _vu:
            return None
        video_url = _vu.group(1).replace("&amp;", "&")
        _tu = (re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']', html)
               or re.search(r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:title["\']', html))
        _im = (re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
               or re.search(r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html))
        title = (_tu.group(1).replace("&amp;", "&") if _tu else "Instagram Reel")
        thumb = (_im.group(1).replace("&amp;", "&") if _im else None)
        return {"title": title, "thumbnail": thumb, "video_url": video_url}

    # Approach 1: fetch reel page with crawler UAs to get SSR with og:video
    for ua in _crawler_uas:
        for page_url in [
            f"https://www.instagram.com/reel/{shortcode}/",
            f"https://www.instagram.com/p/{shortcode}/",
        ]:
            try:
                _hdrs = {
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                }
                async with httpx.AsyncClient(
                    proxy=PROXY_URL if PROXY_URL else None,
                    headers=_hdrs, cookies=cookies,
                    follow_redirects=True, timeout=25.0
                ) as _hc:
                    _r = await _hc.get(page_url)
                has_og = "og:video" in _r.text
                print(f"[ig-page] {ua[:30]} → HTTP {_r.status_code} has_og:{has_og}", flush=True)
                if _r.status_code == 200 and has_og:
                    result = _scrape_og(_r.text)
                    if result:
                        print(f"[ig-page] og:video found → {result['title'][:60]!r}", flush=True)
                        return result
            except Exception as _pe:
                print(f"[ig-page] error ({ua[:20]}): {_pe}", flush=True)

    # Approach 2: web_info API endpoint (newer, still active)
    _api_hdrs = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "x-ig-app-id": "936619743392459",
        "x-csrftoken": cookies.get("csrftoken", ""),
        "Accept": "application/json",
        "Referer": f"https://www.instagram.com/reel/{shortcode}/",
    }
    try:
        _wi_url = f"https://www.instagram.com/api/v1/media/shortcode/web_info/?shortcode={shortcode}"
        async with httpx.AsyncClient(
            proxy=PROXY_URL if PROXY_URL else None,
            headers=_api_hdrs, cookies=cookies,
            follow_redirects=True, timeout=20.0
        ) as _hc:
            _r = await _hc.get(_wi_url)
        print(f"[ig-wi] web_info → HTTP {_r.status_code}", flush=True)
        if _r.status_code == 200:
            data = _r.json()
            items = data.get("items") or []
            if items:
                media = items[0]
                video_versions = media.get("video_versions") or []
                if video_versions:
                    video_url = video_versions[0].get("url")
                    if video_url:
                        caption_obj = media.get("caption") or {}
                        title = caption_obj.get("text") or "Instagram Reel"
                        thumb = ((media.get("image_versions2") or {})
                                 .get("candidates") or [{}])[0].get("url")
                        print(f"[ig-wi] success → {title[:60]!r}", flush=True)
                        return {"title": title[:100], "thumbnail": thumb, "video_url": video_url}
    except Exception as _wie:
        print(f"[ig-wi] error: {_wie}", flush=True)

    return None


async def _instagram_mobile_api_extract(url: str) -> dict | None:
    """
    Bypass yt-dlp for Instagram by using:
    1. Instagram's public oEmbed endpoint  →  get media_id
    2. Instagram mobile API  →  get video URL

    Works for PUBLIC reels/posts without a logged-in session.
    Returns a dict with keys: title, thumbnail, video_url — or None on failure.
    """
    shortcode_m = re.search(r"/(reel|p|tv)/([A-Za-z0-9_-]+)", url)
    if not shortcode_m:
        return None
    shortcode = shortcode_m.group(2)

    # Step 1: oembed → get media_id (no auth needed, always works for public posts)
    try:
        import urllib.parse as _up
        oembed_url = (
            "https://api.instagram.com/oembed/"
            f"?url={_up.quote(f'https://www.instagram.com/reel/{shortcode}/', safe='')}"
            "&format=json"
        )
        async with httpx.AsyncClient(timeout=10.0) as _hc:
            _r = await _hc.get(oembed_url)
        if _r.status_code != 200:
            print(f"[ig-api] oembed failed: HTTP {_r.status_code}", flush=True)
            return None
        oembed = _r.json()
        media_id = oembed.get("media_id")
        title = oembed.get("title") or "Instagram Reel"
        thumbnail = oembed.get("thumbnail_url")
        print(f"[ig-api] oembed OK media_id={media_id} title={title!r}", flush=True)
    except Exception as _oe:
        print(f"[ig-api] oembed error: {_oe}", flush=True)
        return None

    if not media_id:
        return None

    # Step 2a: Try Instagram mobile API (works without auth on some proxy IPs)
    _mobile_headers = {
        "User-Agent": (
            "Instagram 275.0.0.27.98 Android "
            "(26/8.0.0; 440dpi; 1080x1920; Xiaomi; MI 5s; capricorn; qcom; en_US; 314665256)"
        ),
        "X-IG-App-ID": "936619743392459",
        "X-IG-Connection-Type": "WIFI",
        "Accept-Encoding": "gzip, deflate",
        "Accept": "*/*",
    }
    # Try both direct (Railway IP) and via proxy — one of them may be less restricted
    for _use_proxy in [False, True]:
        _proxy = PROXY_URL if (_use_proxy and PROXY_URL) else None
        _label = "proxy" if _proxy else "direct"
        try:
            api_url = f"https://i.instagram.com/api/v1/media/{media_id}/info/"
            async with httpx.AsyncClient(
                proxy=_proxy, headers=_mobile_headers,
                follow_redirects=True, timeout=20.0
            ) as _hc:
                _r = await _hc.get(api_url)
            print(f"[ig-api] media/info ({_label}) HTTP {_r.status_code}", flush=True)
            if _r.status_code == 200:
                data = _r.json()
                items = data.get("items") or []
                if items:
                    media = items[0]
                    video_versions = media.get("video_versions") or []
                    if video_versions:
                        video_url = video_versions[0].get("url")
                        if video_url:
                            thumb = (
                                (media.get("image_versions2") or {})
                                .get("candidates", [{}])[0]
                                .get("url") or thumbnail
                            )
                            print(f"[ig-api] success ({_label}) → {title!r}", flush=True)
                            return {"title": title, "thumbnail": thumb, "video_url": video_url}
        except Exception as _ae:
            print(f"[ig-api] media/info ({_label}) error: {_ae}", flush=True)

    # Step 2b: Try the GraphQL approach (works for some public reels)
    try:
        gql_url = (
            "https://www.instagram.com/graphql/query"
            "?query_hash=b3055c01b4b222b8a47dc12b090e4e64"
            f'&variables={{"shortcode":"{shortcode}"}}'
        )
        _gql_hdrs = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "X-IG-App-ID": "936619743392459",
            "Accept": "application/json",
            "Referer": "https://www.instagram.com/",
        }
        async with httpx.AsyncClient(
            proxy=PROXY_URL if PROXY_URL else None, headers=_gql_hdrs,
            follow_redirects=True, timeout=15.0
        ) as _hc:
            _r = await _hc.get(gql_url)
        print(f"[ig-api] graphql HTTP {_r.status_code}", flush=True)
        if _r.status_code == 200:
            gql = _r.json()
            node = (
                ((gql.get("data") or {})
                 .get("shortcode_media") or {})
            )
            video_url = node.get("video_url")
            if video_url:
                _gql_title = (node.get("edge_media_to_caption") or {}).get("edges", [{}])[0].get("node", {}).get("text") or title
                _gql_thumb = node.get("display_url") or thumbnail
                print(f"[ig-api] graphql success → {_gql_title!r}", flush=True)
                return {"title": _gql_title, "thumbnail": _gql_thumb, "video_url": video_url}
    except Exception as _ge:
        print(f"[ig-api] graphql error: {_ge}", flush=True)

    return None


@app.post("/api/download", response_model=DownloadResponse)
@limiter.limit("20/minute")
async def download(request: Request, req: DownloadRequest):
    req = req.model_copy(update={"url": _normalize_url(req.url)})
    if not SUPPORTED_PATTERN.search(req.url):
        raise HTTPException(status_code=400, detail="Unsupported platform")

    # Per-IP daily quota (configurable via IP_QUOTA_DAILY env var, default 30).
    # Exempt localhost — the internal daily self-test calls this endpoint and
    # must not consume user quota or get blocked by it.
    client_ip = request.client.host if request.client else "unknown"
    if client_ip not in ("127.0.0.1", "::1", "localhost"):
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

    # Capture logger so that yt-dlp error messages (which are routed through
    # the logger AND used to construct DownloadError) are available even when
    # DownloadError.msg is empty (a yt-dlp quirk for some extractors).
    class _CapturingLogger:
        def __init__(self): self.last_error = ""
        def debug(self, msg): pass
        def warning(self, msg): pass
        def error(self, msg):
            print(f"[yt-dlp error] {msg}", flush=True)
            self.last_error = msg

    _logger = _CapturingLogger()

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "logger": _logger,
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

    # Social-media platforms apply TLS fingerprinting + header analysis to block
    # datacenter scrapers.  impersonate="chrome" makes curl_cffi present a real
    # Chrome TLS handshake and browser headers, dramatically improving success
    # rates for public content on Instagram, Facebook, Twitter/X, and Reddit.
    # curl_cffi is already installed (requirements.txt), always safe to use.
    if re.search(r"instagram\.com|facebook\.com|fb\.watch|twitter\.com|x\.com|t\.co|reddit\.com|redd\.it", req.url):
        ydl_opts["impersonate"] = "chrome"
        print(f"[impersonate] chrome for {req.url[:60]}", flush=True)

    # Pick cookie jar: platform-specific override → universal COOKIES → none.
    # NOTE: For Instagram we deliberately skip cookies on the FIRST attempt.
    # Instagram ties sessions to IP addresses — cookies from the user's home
    # browser + a residential proxy IP = IP mismatch → bot-check page → AssertionError.
    # Public reels don't need auth; impersonation + a clean proxy IP is sufficient.
    # Cookies are only used on a second retry if the no-cookie attempt also fails.
    is_instagram = bool(re.search(r"instagram\.com", req.url))
    if re.search(r"youtube\.com|youtu\.be", req.url):
        cookie_content = YOUTUBE_COOKIES or None
        label = "YOUTUBE_COOKIES"
    elif is_instagram:
        cookie_content = None   # skip cookies on first attempt (see note above)
        label = "INSTAGRAM_COOKIES (skipped on first try)"
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

    # ── Run yt-dlp extraction (with Instagram no-cookie-first strategy) ────────
    # Instagram ties sessions to IP. Cookies from user's home browser + a
    # rotating residential proxy IP = IP mismatch → bot-check → AssertionError.
    # Strategy: try without cookies first (sufficient for public reels via proxy
    # + impersonation), then retry with cookies only if the first attempt fails.
    info = None
    _extract_err = None   # final exception after all retries

    def _run_ydl(opts):
        with yt_dlp.YoutubeDL(opts) as _ydl:
            return _ydl.extract_info(req.url, download=False)

    try:
        info = _run_ydl(ydl_opts)
    except Exception as _e1:
        is_twitter = bool(re.search(r"twitter\.com|x\.com|t\.co", req.url))
        is_facebook = bool(re.search(r"facebook\.com|fb\.watch|fb\.com", req.url))
        is_dailymotion = bool(re.search(r"dailymotion\.com|dai\.ly", req.url))
        if is_dailymotion:
            # ── Dailymotion: player metadata API (yt-dlp's OAuth path 401s) ────
            print(f"[dailymotion] yt-dlp failed ({type(_e1).__name__}), trying player metadata API", flush=True)
            _dm = await _dailymotion_extract(req.url)
            if _dm:
                from urllib.parse import quote as _q
                # Point downloads at /api/download-hls with the ORIGINAL page URL.
                # download-hls re-resolves the media URL via the metadata API at
                # download time, so its signed token is always fresh (no caching
                # of a soon-to-expire token).
                base = f"/api/download-hls?url={_q(req.url, safe='')}"
                return DownloadResponse(
                    title=_dm["title"],
                    thumbnail=_dm.get("thumbnail"),
                    formats=[
                        FormatInfo(label="HD Video (MP4)", url=f"{base}&label=hd", ext="mp4"),
                        FormatInfo(label="SD Video (MP4)", url=f"{base}&label=sd", ext="mp4"),
                    ],
                )
            _extract_err = _e1
        elif is_twitter:
            # ── Twitter/X fallback: public fxtwitter API (free, no auth) ──────
            print(f"[twitter] yt-dlp failed ({type(_e1).__name__}), trying fxtwitter API", flush=True)
            _tw_result = await _twitter_fxapi_extract(req.url)
            if _tw_result:
                return _cache_and_return(
                    req.url, _tw_result["title"],
                    _tw_result.get("thumbnail"), _tw_result["video_url"])
            _extract_err = _e1
        elif is_facebook:
            # ── Facebook fallback chain ───────────────────────────────────────
            # 1. RapidAPI managed downloader (FB never embeds the URL in HTML)
            if FB_RAPIDAPI_KEY:
                print(f"[facebook] yt-dlp failed ({type(_e1).__name__}), trying RapidAPI", flush=True)
                _fb_api = await _rapidapi_extract(req.url)
                if _fb_api:
                    return _cache_and_return(
                        req.url, _fb_api["title"],
                        _fb_api.get("thumbnail"), _fb_api["video_url"])
            # 2. HTML scrape (free fallback — works only for older/embedded videos)
            print(f"[facebook] trying HTML scrape", flush=True)
            _fb_result = await _facebook_html_extract(req.url)
            if _fb_result:
                return _cache_and_return(
                    req.url, _fb_result["title"],
                    _fb_result.get("thumbnail"), _fb_result["video_url"])
            _extract_err = _e1
        elif is_instagram:
            # ── Instagram fallback chain ──────────────────────────────────────
            # 0. HikerAPI (managed) — reliable, used first when configured
            if HIKER_API_KEY:
                print(f"[instagram] yt-dlp failed ({type(_e1).__name__}), trying HikerAPI", flush=True)
                _hiker_result = await _instagram_hiker_extract(req.url)
                if _hiker_result:
                    return _cache_and_return(
                        req.url, _hiker_result["title"],
                        _hiker_result.get("thumbnail"), _hiker_result["video_url"])
            # 1. curl_cffi GraphQL — free fallback
            print(f"[instagram] trying GraphQL", flush=True)
            _gql_result = await _instagram_graphql_extract(req.url, INSTAGRAM_COOKIES or "")
            if _gql_result:
                return _cache_and_return(
                    req.url, _gql_result["title"],
                    _gql_result.get("thumbnail"), _gql_result["video_url"])
            # 2. Page scrape + web_info fallback
            if INSTAGRAM_COOKIES:
                print(f"[instagram] GraphQL failed, trying page scrape", flush=True)
                _web_result = await _instagram_web_api_extract(req.url, INSTAGRAM_COOKIES)
                if _web_result:
                    return _cache_and_return(
                        req.url, _web_result["title"],
                        _web_result.get("thumbnail"), _web_result["video_url"])
            # 2. Mobile API (oembed → i.instagram.com) — no cookies needed
            print(f"[instagram] web API failed, trying mobile API", flush=True)
            _api_result = await _instagram_mobile_api_extract(req.url)
            if _api_result:
                return _cache_and_return(
                    req.url, _api_result["title"],
                    _api_result.get("thumbnail"), _api_result["video_url"])
            # 3. yt-dlp retry with cookies (last resort)
            if INSTAGRAM_COOKIES:
                print(f"[instagram] all API fallbacks failed, retrying yt-dlp with cookies", flush=True)
                _logger.last_error = ""
                _tmp2 = None
                try:
                    _tmp2 = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
                    _tmp2.write(INSTAGRAM_COOKIES)
                    _tmp2.close()
                    info = _run_ydl({**ydl_opts, "cookiefile": _tmp2.name})
                except Exception as _e2:
                    _extract_err = _e2
                finally:
                    if _tmp2:
                        try: os.unlink(_tmp2.name)
                        except Exception: pass
            else:
                _extract_err = _e1
        else:
            _extract_err = _e1

    # ── Universal last-resort: RapidAPI (fastsaverapi) for ANY platform ────────
    # Costs nothing when primary methods succeed (only runs after they all fail).
    # Catches breakage on platforms with no dedicated fallback (Pinterest,
    # Snapchat, Reddit, LinkedIn, Threads, Dailymotion, etc.) and any future
    # regressions in the primary extractors.
    if _extract_err is not None and FB_RAPIDAPI_KEY:
        print(f"[universal] all methods failed, trying RapidAPI fallback", flush=True)
        _uni = await _rapidapi_extract(req.url)
        if _uni:
            return _cache_and_return(
                req.url, _uni["title"], _uni.get("thumbnail"), _uni["video_url"])

    # ── Handle extraction error (DownloadError or unexpected) ──────────────────
    if _extract_err is not None:
        import traceback
        if isinstance(_extract_err, yt_dlp.utils.DownloadError):
            err_str = str(_extract_err) or _logger.last_error or repr(_extract_err)
            print(f"[yt-dlp DownloadError] {err_str}", flush=True)
            asyncio.create_task(_check_and_alert_cookie_error(req.url, err_str))
            # YouTube oEmbed fallback
            if re.search(r"youtube\.com|youtu\.be", req.url):
                try:
                    import urllib.parse as _up
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
                        return DownloadResponse(
                            title=_title,
                            thumbnail=_thumb,
                            formats=[FormatInfo(label="Video", url="", ext="mp4")],
                        )
                    else:
                        print(f"[oembed] fallback HTTP {_r.status_code}", flush=True)
                except Exception as _oe:
                    print(f"[oembed] fallback error: {_oe}", flush=True)
            _code = "unknown"
            _s = err_str.lower()
            if any(k in _s for k in ("sign in", "bot", "confirm you're not", "use --cookies",
                                       "login required", "not authenticated", "checkpoint")):
                _plat = (
                    "instagram" if re.search(r"instagram\.com", req.url) else
                    "facebook"  if re.search(r"facebook\.com|fb\.watch", req.url) else
                    "twitter"   if re.search(r"twitter\.com|x\.com|t\.co", req.url) else
                    None
                )
                _code = f"sign_in_required:{_plat}" if _plat else "sign_in_required"
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
            if cookies_file:
                try: os.unlink(cookies_file)
                except Exception: pass
            raise HTTPException(status_code=422, detail={"message": err_str, "code": _code})
        else:
            err_msg = str(_extract_err) or _logger.last_error or repr(_extract_err)
            print(f"[extract] unexpected {type(_extract_err).__name__}: {err_msg}\n{traceback.format_exc()}", flush=True)
            if cookies_file:
                try: os.unlink(cookies_file)
                except Exception: pass
            # AssertionError from yt-dlp's Instagram extractor means Instagram
            # returned a login/bot-check page — surface as sign_in_required.
            _code = "unknown"
            if isinstance(_extract_err, AssertionError) and re.search(r"instagram\.com", req.url):
                _code = "sign_in_required:instagram"
            raise HTTPException(status_code=422, detail={"message": err_msg or type(_extract_err).__name__, "code": _code})

    if cookies_file:
        try: os.unlink(cookies_file)
        except Exception: pass

    if not info:
        raise HTTPException(status_code=404, detail={"message": "Video not found", "code": "not_found"})

    formats: list[FormatInfo] = []

    raw_formats = info.get("formats") or []
    entries = info.get("entries") or []  # carousel / playlist (Instagram multi-photo, etc.)

    IMAGE_EXTS = {"jpg", "jpeg", "webp", "png", "gif", "avif"}

    def _is_hls(fmt_dict: dict) -> bool:
        """Return True if this format is an HLS/DASH stream (not a direct MP4 CDN URL)."""
        proto = (fmt_dict.get("protocol") or "").lower()
        return "m3u8" in proto or "dash" in proto or proto == "http_dash_segments"

    def _fmt_url(fmt_dict: dict, original_url: str, height_label: str) -> str:
        """Return the download URL: direct CDN URL for plain formats, /api/download-hls for streams."""
        if _is_hls(fmt_dict):
            from urllib.parse import quote
            return f"/api/download-hls?url={quote(original_url, safe='')}&label={height_label}"
        return fmt_dict.get("url", "")

    try:
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
                ext = "mp4" if _is_hls(best) else (best.get("ext") or "mp4")
                formats.append(FormatInfo(label="HD Video (MP4)", url=_fmt_url(best, req.url, "hd"), ext=ext))

            # SD fallback: same cascade, max 480p
            sd = (
                _pick_format(raw_formats, vcodec=True, acodec=True, ext="mp4", max_height=480)
                or _pick_format(raw_formats, vcodec=True, acodec=True, max_height=480)
                or _pick_format(raw_formats, vcodec=True, acodec=False, max_height=480)
            )
            if sd and sd.get("url") != (best or {}).get("url"):
                ext = "mp4" if _is_hls(sd) else (sd.get("ext") or "mp4")
                formats.append(FormatInfo(label="SD Video (MP4)", url=_fmt_url(sd, req.url, "sd"), ext=ext))

            audio = _pick_format(raw_formats, vcodec=False, acodec=True)
            if audio:
                formats.append(FormatInfo(label="Audio Only (M4A)", url=audio.get("url", ""), ext="m4a"))

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
    except Exception as _fmt_err:
        print(f"[format-build] unexpected error for {req.url}: {_fmt_err}", flush=True)
        raise HTTPException(status_code=500, detail=f"Format extraction failed: {str(_fmt_err)[:200]}")

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
        (r"threads\.net|threads\.com", "download:threads"),
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


# ── Daily platform self-test ───────────────────────────────────────────────────
# Known-good public videos per platform. Resolution + (where applicable) a
# small byte-range download are verified daily so breakages are caught early.
# mode: "proxy"  → download is served via /api/proxy, so byte-check the CDN URL.
#       "stream" → download uses a dedicated streaming endpoint (yt-dlp subprocess),
#                  so the direct CDN URL is NOT the real download path. Resolution
#                  success is the meaningful signal (byte-testing would false-fail
#                  on IP-bound CDN URLs and spawn an expensive subprocess).
SELFTEST_TARGETS = {
    "YouTube":   {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",                "mode": "stream"},
    "TikTok":    {"url": "https://www.tiktok.com/@tiktok/video/7106594312292453675",  "mode": "stream"},
    "Instagram": {"url": "https://www.instagram.com/reel/DY1vXr6iqxr/",               "mode": "proxy"},
    "Twitter/X": {"url": "https://x.com/SpaceX/status/1732824684683784516",           "mode": "proxy"},
    "Facebook":  {"url": "https://www.facebook.com/reel/1860942398211698",            "mode": "proxy"},
    "Vimeo":     {"url": "https://vimeo.com/76979871",                                "mode": "proxy"},
}


async def _selftest_one(base: str, platform: str, url: str, mode: str) -> dict:
    """Resolve a platform URL and, for proxy-mode platforms, verify bytes flow.
    Returns {platform, ok, detail}."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{base}/api/download", json={"url": url, "quality": "hd"})
            if r.status_code == 429:
                # Rate-limited/quota — inconclusive, not a platform failure. Don't alarm.
                return {"platform": platform, "ok": True, "detail": "skipped (rate-limited)"}
            if r.status_code != 200:
                return {"platform": platform, "ok": False, "detail": f"resolve HTTP {r.status_code}"}
            data = r.json()
            formats = data.get("formats") or []
            if not formats:
                return {"platform": platform, "ok": False, "detail": "no formats returned"}
            # Stream-mode platforms (YouTube/TikTok) download via a dedicated endpoint,
            # not the direct CDN URL — resolution success is the meaningful check.
            if mode == "stream":
                return {"platform": platform, "ok": True, "detail": "resolved (stream endpoint)"}
            fmt_url = formats[0].get("url") or ""
            if not fmt_url.startswith("http"):
                return {"platform": platform, "ok": True, "detail": "resolved"}
            # Proxy-mode: verify real bytes download via the proxy (Range 0-65535).
            import urllib.parse as _up
            proxy_url = f"{base}/api/proxy?url={_up.quote(fmt_url, safe='')}&filename=selftest&ext=mp4"
            pr = await client.get(proxy_url, headers={"Range": "bytes=0-65535"})
            got = len(pr.content)
            if pr.status_code not in (200, 206) or got < 1024:
                return {"platform": platform, "ok": False,
                        "detail": f"download {pr.status_code}, {got} bytes"}
            return {"platform": platform, "ok": True, "detail": f"{got} bytes ok"}
    except Exception as ex:
        return {"platform": platform, "ok": False, "detail": f"{type(ex).__name__}: {str(ex)[:80]}"}


async def _selftest_proxy() -> dict:
    """Check the residential proxy directly: can it reach the internet, and
    what exit IP does it present? A failure here is the upstream cause of
    Twitter/Vimeo/Facebook(proxy) download failures, so flagging it explicitly
    turns three confusing platform errors into one actionable alert."""
    if not PROXY_URL:
        return {"platform": "Proxy", "ok": True, "detail": "not configured (skipped)"}
    try:
        async with httpx.AsyncClient(proxy=PROXY_URL, timeout=10) as client:
            r = await client.get("https://api.ipify.org?format=json")
        if r.status_code != 200:
            return {"platform": "Proxy", "ok": False,
                    "detail": f"HTTP {r.status_code} (check Webshare data/credentials)"}
        ip = (r.json() or {}).get("ip", "?")
        return {"platform": "Proxy", "ok": True, "detail": f"exit IP {ip}"}
    except Exception as ex:
        return {"platform": "Proxy", "ok": False,
                "detail": f"DOWN — {type(ex).__name__}: {str(ex)[:70]} "
                          "(likely Webshare data cap hit or credentials/IP changed)"}


async def _run_platform_selftest() -> list[dict]:
    """Run the self-test for every platform against this server's own endpoints.
    The residential-proxy health check runs first — proxy failures cascade into
    several platform failures, so surfacing it up front makes alerts actionable."""
    port = os.environ.get("PORT", "8000")
    base = f"http://127.0.0.1:{port}"
    results = []

    proxy_res = await _selftest_proxy()
    print(f"[selftest] Proxy: {'OK' if proxy_res['ok'] else 'FAIL'} — {proxy_res['detail']}", flush=True)
    results.append(proxy_res)

    for platform, cfg in SELFTEST_TARGETS.items():
        res = await _selftest_one(base, platform, cfg["url"], cfg["mode"])
        status = "OK" if res["ok"] else "FAIL"
        print(f"[selftest] {platform}: {status} — {res['detail']}", flush=True)
        results.append(res)
    return results


async def _selftest_loop() -> None:
    """Background task: run the platform self-test once every 24h, alert on failures."""
    CHECK_SEC = 3600  # check hourly
    INTERVAL_SEC = 24 * 3600
    # Wait a bit after startup so the server is fully ready
    await asyncio.sleep(120)
    while True:
        try:
            last_str = _db_get_config("selftest_ran_at")
            last_ts = float(last_str) if last_str else 0.0
            if time.time() - last_ts >= INTERVAL_SEC:
                print("[selftest] running daily platform self-test", flush=True)
                results = await _run_platform_selftest()
                _db_set_config("selftest_ran_at", str(time.time()))
                failures = [r for r in results if not r["ok"]]
                if failures:
                    lines = "\n".join(f"❌ <b>{r['platform']}</b>: {r['detail']}" for r in failures)
                    oks = ", ".join(r["platform"] for r in results if r["ok"]) or "none"
                    # If the proxy is down, lead with it — the platform failures
                    # that route through it are almost certainly downstream symptoms.
                    proxy_down = any(r["platform"] == "Proxy" and not r["ok"] for r in failures)
                    header = (
                        "🔌 <b>ReelGet — RESIDENTIAL PROXY DOWN</b>\n\n"
                        "The proxy isn't reachable. Twitter/X &amp; Vimeo downloads "
                        "(which require it) will fail until it's restored.\n"
                        "👉 Check Webshare: data/bandwidth cap, plan status, and that "
                        "the authorized IP still matches.\n\n"
                        if proxy_down else
                        f"🚨 <b>ReelGet Daily Health Check — {len(failures)} check(s) FAILING</b>\n\n"
                    )
                    msg = (
                        f"{header}"
                        f"{lines}\n\n"
                        f"✅ Working: {oks}\n\n"
                        f"<i>Automated daily self-test.</i>"
                    )
                    await _send_telegram_alert(msg)
                else:
                    print(f"[selftest] all {len(results)} platforms OK", flush=True)
        except Exception as ex:
            print(f"[selftest] loop error: {ex}", flush=True)
        await asyncio.sleep(CHECK_SEC)


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
    if "twimg" in url or "twitter" in url or "x.com" in url:
        return "https://x.com/"
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

    # YouTube's CDN (googlevideo.com) is reachable from Railway datacenters directly.
    # Do NOT route YouTube through the residential proxy — it would burn gigabytes of
    # proxy bandwidth downloading video payloads, exhausting the monthly allowance fast.
    # The proxy is only needed for social-media extraction (Instagram / Facebook / X).
    sticky_proxy = None

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
    # IMPORTANT: when piping a merged download to stdout, yt-dlp uses an MPEG-TS
    # container (mp4 isn't pipe-streamable). AV1/VP9 video does NOT mux into
    # MPEG-TS correctly — it becomes an unrecognized "private data" stream, so
    # players fall back to audio-only. Prefer H.264 (avc1), which muxes cleanly.
    _DASH_HD = (
        "bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]"
        "/bestvideo[height<=720][ext=mp4][vcodec!*=av01]+bestaudio"
        "/best[height<=720][vcodec^=avc1]"
        "/best[height<=720]"
    )
    _DASH_SD = (
        "bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]"
        "/bestvideo[height<=480][ext=mp4][vcodec!*=av01]+bestaudio"
        "/best[height<=480][vcodec^=avc1]"
        "/best[height<=480]"
    )
    _BASE_FORMATS = {
        "hd":    [("22/18", "web"), ("18", "tv_downgraded,web_embedded,ios"), (_DASH_HD, "tv_downgraded,web_embedded")],
        "sd":    [("18",    "web"), ("18", "tv_downgraded,web_embedded,ios"), (_DASH_SD, "tv_downgraded,web_embedded")],
        "audio": [(fmt_sel, "web"), (fmt_sel, "tv_downgraded,web_embedded,ios")],
    }
    _attempts = _BASE_FORMATS.get(quality, _BASE_FORMATS["hd"])

    # YouTube Shorts never have progressive formats (18 / 22) — only DASH streams.
    # Skip the two guaranteed-to-fail progressive tiers and go straight to DASH,
    # saving up to 50 s of 25-second timeouts on a video that would otherwise
    # always end up on the third attempt anyway.
    if "/shorts/" in url:
        print(f"[download-youtube] Shorts detected — using DASH format directly", flush=True)
        if quality == "audio":
            _attempts = [(fmt_sel, "tv_downgraded,web_embedded,ios"), (fmt_sel, "web")]
        elif quality == "sd":
            _attempts = [
                (_DASH_SD, "tv_downgraded,web_embedded"),
                (_DASH_SD, "web"),
                ("best[height<=480]", "web"),
            ]
        else:
            _attempts = [
                (_DASH_HD, "tv_downgraded,web_embedded"),
                (_DASH_HD, "web"),
                ("best[height<=720]", "web"),
            ]

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
            # Ensure DASH-merged output is always MP4.  When writing to stdout
            # yt-dlp adds movflags=frag_keyframe+empty_moov so the file is
            # streamable without a complete moov atom up front.
            "--merge-output-format", "mp4",
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

    # Shorts never have progressive formats — use DASH directly to skip failures
    _is_shorts_job = "/shorts/" in url
    if quality == "audio":
        fmt_sel = "bestaudio[ext=m4a]/bestaudio"
    elif quality == "sd":
        # Prefer H.264 (avc1) for DASH merges — AV1/VP9 break in the MPEG-TS pipe.
        fmt_sel = (
            "bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]"
            "/bestvideo[height<=480][ext=mp4][vcodec!*=av01]+bestaudio"
            "/best[height<=480]"
        ) if _is_shorts_job else (
            "18"
            "/bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]"
            "/bestvideo[height<=480][ext=mp4][vcodec!*=av01]+bestaudio"
            "/best[height<=480]"
        )
    else:
        fmt_sel = (
            "bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]"
            "/bestvideo[height<=720][ext=mp4][vcodec!*=av01]+bestaudio"
            "/best[height<=720]"
        ) if _is_shorts_job else (
            "22/18"
            "/bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]"
            "/bestvideo[height<=720][ext=mp4][vcodec!*=av01]+bestaudio"
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

    # YouTube CDN is accessible from Railway directly — skip the proxy here too.
    sticky_proxy = None

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


@app.get("/api/download-hls")
async def download_hls(url: str = Query(...), label: str = Query("hd")):
    """Stream an HLS/DASH download (e.g. Twitch VODs, Dailymotion) back to the
    client as it downloads — yt-dlp+ffmpeg pipe a fragmented MP4 straight to
    stdout, so there is NO download-to-disk step and NO fixed time limit.

    This is essential for long-form content like multi-hour Twitch VODs, which
    blew past the old 5-minute disk-download timeout. Bytes now flow to the
    browser as fast as ffmpeg muxes them; the request lives as long as the
    transfer does.
    """
    import sys
    safe = re.sub(r'[^\w\-]', '_', url.split('/')[-1].split('?')[0], flags=re.ASCII)[:40] or 'video'

    # Dailymotion: yt-dlp's extractor 401s (rotated OAuth token, upstream issue
    # #4727). Resolve the page to a direct media URL via the player metadata API
    # here — at DOWNLOAD time, so the signed token is fresh — then hand yt-dlp the
    # raw m3u8/mp4, which its GENERIC handler downloads with no Dailymotion OAuth.
    is_dm = False
    if re.search(r"dailymotion\.com|dai\.ly", url):
        _dm = await _dailymotion_extract(url)
        if _dm and (_dm.get("hls_url") or _dm.get("mp4_url")):
            url = _dm.get("hls_url") or _dm.get("mp4_url")
            is_dm = True
            print(f"[download-hls] dailymotion → resolved to media URL", flush=True)
        else:
            print(f"[download-hls] dailymotion metadata resolve failed, passing page URL to yt-dlp", flush=True)

    # Prefer a single pre-muxed HLS stream when one exists (Twitch quality
    # variants are already A/V-muxed → no ffmpeg merge needed, pipes cleanly).
    # Fall back to merging separate video+audio. avc1 (H.264) is preferred so
    # fragmented-MP4-to-stdout muxes correctly (AV1/VP9 do not pipe cleanly).
    if label == "hd":
        fmt = ("best[height<=1080][vcodec^=avc1]/best[height<=1080][ext=mp4]"
               "/bestvideo[height<=1080][vcodec^=avc1]+bestaudio/best[height<=1080]/best")
    else:
        fmt = ("best[height<=480][vcodec^=avc1]/best[height<=480][ext=mp4]"
               "/worst[height>=360]/worst")

    def _build_cmd(use_proxy: bool) -> list[str]:
        c = [
            sys.executable, "-m", "yt_dlp",
            "--format", fmt,
            "--output", "-",                       # pipe to stdout (no disk)
            "--merge-output-format", "mp4",        # fragmented mp4 (frag_keyframe+empty_moov)
            "--no-part", "--no-progress",
            "--socket-timeout", "30",
            "--retries", "10",
            "--fragment-retries", "20",
            "--concurrent-fragments", "8",         # parallel HLS segment fetch (faster VODs)
            "--user-agent",
            ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
        ]
        # Dailymotion's CDN (cdndirector/dmcdn) blocks non-browser TLS handshakes
        # (plain yt-dlp/httpx → 403; Chrome TLS → 200). yt-dlp's --impersonate uses
        # curl_cffi to present a real Chrome fingerprint for the manifest + segments.
        if is_dm:
            c += ["--impersonate", "chrome"]
        if use_proxy and PROXY_URL:
            c += ["--proxy", PROXY_URL]
        c.append(url)
        return c

    # Bandwidth optimization: try a DIRECT download first. Twitch/Vimeo/Dailymotion
    # CDNs serve datacenter IPs fine, and these are the largest payloads (multi-GB
    # Twitch VODs) — routing them through the metered residential proxy would burn
    # the monthly bandwidth allowance fast. Only fall back to the proxy if the
    # direct attempt produces no data (a CDN that actually blocks datacenter IPs).
    attempts = [False] + ([True] if PROXY_URL else [])

    clean_title = safe

    async def stream_subprocess():
        bytes_sent = 0
        _MAX_BYTES = 3 * 1024 * 1024 * 1024  # 3 GB cap (long VODs need headroom)
        for attempt_num, use_proxy in enumerate(attempts):
            route = "proxy" if use_proxy else "direct"
            proc = await asyncio.create_subprocess_exec(
                *_build_cmd(use_proxy),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                # HLS extraction + first segments can be slow for long VODs — wait
                # up to 90 s for the first byte before declaring this route failed.
                try:
                    first_chunk = await asyncio.wait_for(proc.stdout.read(65536), timeout=90)
                except asyncio.TimeoutError:
                    first_chunk = b""

                if not first_chunk:
                    try:
                        err = await asyncio.wait_for(proc.stderr.read(), timeout=5)
                        err_text = err.decode(errors="replace").strip()
                        if err_text:
                            print(f"[download-hls] {route} no data — stderr: {err_text[:400]}", flush=True)
                    except Exception:
                        pass
                    try: proc.kill()
                    except Exception: pass
                    try: await proc.wait()
                    except Exception: pass
                    if attempt_num < len(attempts) - 1:
                        print(f"[download-hls] {route} failed, retrying via proxy", flush=True)
                        continue
                    print(f"[download-hls] all routes failed for {url}", flush=True)
                    return

                print(f"[download-hls] streaming via {route}", flush=True)
                yield first_chunk
                bytes_sent += len(first_chunk)
                while True:
                    chunk = await proc.stdout.read(65536)
                    if not chunk:
                        break
                    bytes_sent += len(chunk)
                    if bytes_sent > _MAX_BYTES:
                        print(f"[download-hls] 3 GB cap reached — aborting {url}", flush=True)
                        break
                    yield chunk

                try:
                    err = await asyncio.wait_for(proc.stderr.read(), timeout=5)
                    err_text = err.decode(errors="replace").strip()
                    if err_text:
                        print(f"[download-hls] stderr: {err_text[:1000]}", flush=True)
                except Exception:
                    pass
                return  # streamed successfully — done
            finally:
                print(f"[download-hls] sent {bytes_sent} bytes for {url} ({route})", flush=True)
                try: proc.kill()
                except Exception: pass
                try: await proc.wait()
                except Exception: pass

    return StreamingResponse(
        stream_subprocess(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_title}.mp4"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/proxy")
async def proxy_download(url: str = Query(...), filename: str = Query("video"), ext: str = Query("mp4")):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": _referer_for(url),
    }
    # Facebook CDN (fbcdn.net / scontent.*.fbcdn.net) rejects browser UAs — use the
    # crawler UA that Facebook itself documents for link previews.
    if "fbcdn.net" in url or "facebook.com" in url:
        headers["User-Agent"] = "facebookexternalhit/1.1"
        headers["Accept"] = (
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        )
        headers["Sec-Fetch-Mode"] = "navigate"
    safe_filename = re.sub(r'[^\w\-.]', '_', filename, flags=re.ASCII).strip('_')[:80] or 'video'
    _CT = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "webp": "image/webp", "png": "image/png", "gif": "image/gif",
        "m4a": "audio/mp4", "mp3": "audio/mpeg",
    }
    content_type = _CT.get(ext.lower(), "video/mp4")

    # Build an ordered list of (proxy, user-agent) attempts. Different CDNs need
    # different routing, and a URL that fails one way often succeeds another:
    #
    #  • Twitter (twimg): datacenter IPs get a 200 + 0 bytes, so the residential
    #    proxy is REQUIRED; direct is a pointless fallback but harmless.
    #  • Facebook (fbcdn): URLs resolved by fastsaverapi are NOT bound to our
    #    proxy IP, so a DIRECT fetch usually works and the proxy may fail to
    #    reach the specific edge. URLs we resolved via HTML-scrape are IP-bound
    #    to the proxy. We don't know which produced this URL, so try BOTH —
    #    direct first (cheap, works for the common RapidAPI case), then proxy.
    #    Also try both UAs (crawler vs browser) since fbcdn is picky.
    _is_fb = ("fbcdn" in url or "facebook" in url)
    _is_tw = ("twimg" in url or "twitter" in url)
    _browser_ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
    _crawler_ua = "facebookexternalhit/1.1"

    attempts: list[tuple[str | None, str]] = []
    if _is_tw and PROXY_URL:
        attempts = [(PROXY_URL, headers["User-Agent"]), (None, headers["User-Agent"])]
    elif _is_fb:
        attempts = [(None, _crawler_ua), (None, _browser_ua)]
        if PROXY_URL:
            attempts += [(PROXY_URL, _crawler_ua), (PROXY_URL, _browser_ua)]
    else:
        attempts = [(None, headers["User-Agent"])]

    # Open the upstream connection and validate status BEFORE returning the
    # StreamingResponse. If we only checked inside the generator, a non-200
    # would raise after headers were already sent → client gets 200 + 0 bytes.
    client = req_ctx = r = None
    last_problem = "no attempt made"
    for _idx, (_dl_proxy, _ua) in enumerate(attempts):
        _h = dict(headers)
        _h["User-Agent"] = _ua
        _client = httpx.AsyncClient(follow_redirects=True, timeout=120, proxy=_dl_proxy)
        _route = "proxy" if _dl_proxy else "direct"
        try:
            _ctx = _client.stream("GET", url, headers=_h)
            _r = await _ctx.__aenter__()
            if _r.status_code == 200:
                print(f"[proxy] CDN ok via {_route} (ua={_ua[:20]!r}) "
                      f"attempt {_idx+1}/{len(attempts)}", flush=True)
                client, req_ctx, r = _client, _ctx, _r
                break
            await _ctx.__aexit__(None, None, None)
            await _client.aclose()
            last_problem = f"HTTP {_r.status_code}"
            print(f"[proxy] {_route} attempt {_idx+1}/{len(attempts)} → "
                  f"{last_problem} for {url[:80]}", flush=True)
        except Exception as _pe:
            try: await _client.aclose()
            except Exception: pass
            last_problem = f"{type(_pe).__name__}: {str(_pe)[:80]}"
            print(f"[proxy] {_route} attempt {_idx+1}/{len(attempts)} → "
                  f"{last_problem} for {url[:80]}", flush=True)

    if r is None:
        print(f"[proxy] all {len(attempts)} CDN attempts failed ({last_problem})", flush=True)
        raise HTTPException(status_code=502, detail="Could not fetch the video from its CDN.")

    async def stream():
        try:
            async for chunk in r.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await req_ctx.__aexit__(None, None, None)
            await client.aclose()

    fwd_len = r.headers.get("content-length")
    resp_headers = {"Content-Disposition": f'attachment; filename="{safe_filename}.{ext}"'}
    if fwd_len:
        resp_headers["Content-Length"] = fwd_len

    return StreamingResponse(stream(), media_type=content_type, headers=resp_headers)


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


# ── Web Push (browser notifications) ──────────────────────────────────────────
class PushSubscription(BaseModel):
    endpoint: str
    keys: dict   # {"p256dh": "...", "auth": "..."}


def _db_add_push_subscription(endpoint: str, p256dh: str, auth: str) -> None:
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """INSERT INTO push_subscriptions (endpoint, p256dh, auth)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth""",
                (endpoint, p256dh, auth),
            )
    except Exception as ex:
        print(f"[push] add sub failed: {ex}", flush=True)
    finally:
        conn.close()


def _db_remove_push_subscription(endpoint: str) -> None:
    conn = _get_db_conn()
    if not conn:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute("DELETE FROM push_subscriptions WHERE endpoint=%s", (endpoint,))
    except Exception as ex:
        print(f"[push] remove sub failed: {ex}", flush=True)
    finally:
        conn.close()


def _db_get_push_subscriptions() -> list[dict]:
    conn = _get_db_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT endpoint, p256dh, auth FROM push_subscriptions")
            return [{"endpoint": r[0], "p256dh": r[1], "auth": r[2]} for r in cur.fetchall()]
    except Exception as ex:
        print(f"[push] list subs failed: {ex}", flush=True)
        return []
    finally:
        conn.close()


@app.get("/api/push/vapid-public-key")
def push_vapid_public_key():
    """Public VAPID key the frontend needs to create a push subscription."""
    return {"key": VAPID_PUBLIC_KEY}


@app.post("/api/push/subscribe")
async def push_subscribe(sub: PushSubscription):
    keys = sub.keys or {}
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    if not (sub.endpoint and p256dh and auth):
        raise HTTPException(status_code=400, detail="Invalid subscription")
    _db_add_push_subscription(sub.endpoint, p256dh, auth)
    return {"ok": True}


@app.post("/api/push/unsubscribe")
async def push_unsubscribe(sub: PushSubscription):
    if sub.endpoint:
        _db_remove_push_subscription(sub.endpoint)
    return {"ok": True}


def _send_web_push_sync(title: str, body: str, url: str = "https://www.reelget.com/") -> dict:
    """Send a push notification to every stored subscription. Returns {sent, removed}."""
    if not (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY):
        print("[push] VAPID keys not configured", flush=True)
        return {"sent": 0, "removed": 0, "error": "vapid_not_configured"}
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("[push] pywebpush not installed", flush=True)
        return {"sent": 0, "removed": 0, "error": "pywebpush_missing"}

    payload = json.dumps({"title": title, "body": body, "url": url})
    subs = _db_get_push_subscriptions()
    sent = removed = 0
    for s in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": s["endpoint"],
                    "keys": {"p256dh": s["p256dh"], "auth": s["auth"]},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
                timeout=10,
            )
            sent += 1
        except WebPushException as ex:
            # 404/410 mean the subscription is dead — prune it.
            status = getattr(getattr(ex, "response", None), "status_code", None)
            if status in (404, 410):
                _db_remove_push_subscription(s["endpoint"])
                removed += 1
            else:
                print(f"[push] send error ({status}): {str(ex)[:120]}", flush=True)
        except Exception as ex:
            print(f"[push] unexpected send error: {str(ex)[:120]}", flush=True)
    print(f"[push] broadcast done — sent={sent} removed={removed} total={len(subs)}", flush=True)
    return {"sent": sent, "removed": removed, "total": len(subs)}


class PushBroadcast(BaseModel):
    title: str
    body: str
    url: str | None = None


@app.post("/api/admin/push/broadcast")
async def push_broadcast(req: PushBroadcast, request: Request):
    """Admin-only: send a push notification to all subscribers."""
    _require_admin(request)
    result = await asyncio.get_event_loop().run_in_executor(
        None, _send_web_push_sync, req.title, req.body, req.url or "https://www.reelget.com/"
    )
    return result


@app.get("/api/analytics")
def get_analytics(request: Request):
    """Admin-only: raw page stats sorted by count descending."""
    _require_admin(request)
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


@app.get("/api/test-alert")
async def test_alert(request: Request):
    """Admin-only: send a test Telegram message to verify alerting is configured."""
    _require_admin(request)
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return {"sent": False, "reason": "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set"}
    await _send_telegram_alert(
        "✅ <b>ReelGet test alert</b>\n\nIf you can read this, Telegram alerting "
        "is working — health-check and reminder alerts will reach you."
    )
    return {"sent": True, "note": "Check your Telegram for the test message."}


@app.get("/api/selftest")
async def run_selftest(request: Request):
    """Admin-only: run the platform self-test on demand and return per-platform results."""
    _require_admin(request)
    results = await _run_platform_selftest()
    failures = [r for r in results if not r["ok"]]
    return {
        "ok": len(failures) == 0,
        "total": len(results),
        "failing": len(failures),
        "results": results,
    }


@app.get("/api/admin/stats")
async def admin_stats(request: Request, days: int = Query(0, ge=0, le=365)):
    """Admin-only: aggregate stats for dashboard.

    days=0 → all-time (cumulative counters). days>0 → window from the daily_stats
    buckets covering the last N calendar days (1=today, 7=last week, etc.).
    Note: day-bucketed data only exists from when daily tracking was added.
    """
    _require_admin(request)
    conn = _get_db_conn()
    rows: list[dict] = []
    total_count = _COUNTER_BASE + _counter_session
    real_downloads = 0
    platform_counts: list[dict] = []
    top_ips: list[dict] = []
    cookie_status: list[dict] = []
    total_visits = 0
    top_pages: list[dict] = []
    conversions: dict = {}
    tracking_since: str | None = None
    windowed = days > 0
    _NOT_VISIT_PG = "page NOT LIKE 'download:%' AND page NOT LIKE 'promo_%' " \
                    "AND page NOT LIKE 'push_%' AND page NOT LIKE 'pwa_%'"
    _NOT_VISIT_DS = _NOT_VISIT_PG.replace("page", "metric")

    if conn:
        try:
            with conn.cursor() as cur:
                # Total downloads (all-time counter)
                cur.execute("SELECT count FROM counter WHERE id=1")
                r = cur.fetchone()
                if r:
                    total_count = r[0]
                real_downloads = max(0, total_count - _COUNTER_BASE)

                if windowed:
                    # ── Date-windowed stats from daily_stats buckets ──────────
                    since = f"day >= CURRENT_DATE - INTERVAL '{days - 1} days'"
                    cur.execute(f"""
                        SELECT metric, SUM(count) FROM daily_stats
                        WHERE metric LIKE 'download:%' AND {since}
                        GROUP BY metric ORDER BY SUM(count) DESC
                    """)
                    platform_counts = [
                        {"platform": r[0].replace("download:", ""), "count": int(r[1]), "last_seen": None}
                        for r in cur.fetchall()
                    ]
                    real_downloads = sum(p["count"] for p in platform_counts)

                    cur.execute(f"SELECT COALESCE(SUM(count),0) FROM daily_stats WHERE {_NOT_VISIT_DS} AND {since}")
                    tv = cur.fetchone()
                    total_visits = int(tv[0]) if tv else 0
                    cur.execute(f"""
                        SELECT metric, SUM(count) FROM daily_stats
                        WHERE {_NOT_VISIT_DS} AND {since}
                        GROUP BY metric ORDER BY SUM(count) DESC LIMIT 15
                    """)
                    top_pages = [{"page": r[0], "count": int(r[1]), "last_seen": None} for r in cur.fetchall()]

                    cur.execute(f"""
                        SELECT metric, SUM(count) FROM daily_stats
                        WHERE metric IN ('pwa_installed','push_subscribed',
                                         'promo_click_telegram','promo_click_extension') AND {since}
                        GROUP BY metric
                    """)
                    conversions = {r[0]: int(r[1]) for r in cur.fetchall()}
                else:
                    # ── All-time stats from cumulative page_stats ─────────────
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

                    cur.execute(f"SELECT COALESCE(SUM(count),0) FROM page_stats WHERE {_NOT_VISIT_PG}")
                    tv = cur.fetchone()
                    total_visits = int(tv[0]) if tv else 0
                    cur.execute(f"""
                        SELECT page, count, last_seen FROM page_stats
                        WHERE {_NOT_VISIT_PG}
                        ORDER BY count DESC LIMIT 15
                    """)
                    top_pages = [
                        {"page": r[0], "count": r[1],
                         "last_seen": r[2].isoformat() if r[2] else None}
                        for r in cur.fetchall()
                    ]

                    cur.execute("""
                        SELECT page, count FROM page_stats
                        WHERE page IN ('pwa_installed','push_subscribed',
                                       'promo_click_telegram','promo_click_extension')
                    """)
                    conversions = {r[0]: r[1] for r in cur.fetchall()}

                # Earliest day we have bucketed data for (when daily tracking began)
                cur.execute("SELECT MIN(day) FROM daily_stats")
                _ts = cur.fetchone()
                tracking_since = _ts[0].isoformat() if _ts and _ts[0] else None

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
        "window_days":      days,   # 0 = all-time
        "daily_tracking_since": tracking_since,
        "total_downloads":  total_count,
        # All-time: counter minus vanity base. Windowed: sum of downloads in range.
        "real_downloads":   real_downloads,
        "platform_counts":  platform_counts,
        "total_visits":     total_visits,
        "top_pages":        top_pages,
        "conversions":      conversions,
        "push_subscribers": len(_db_get_push_subscriptions()),
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
