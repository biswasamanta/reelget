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
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_TTL = 6 * 3600  # 6 hours

ALLOWED_REGIONS = {"IN", "PK", "ID", "BR", "SA", "VN", "US", "NG", "KE"}

# In-memory download counter — resets on restart but starts from a base
_COUNTER_BASE = 52_000
_counter_session = 0

# ── PostgreSQL counter ────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "")

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


@app.post("/api/download", response_model=DownloadResponse)
@limiter.limit("20/minute")
async def download(request: Request, req: DownloadRequest):
    if not SUPPORTED_PATTERN.search(req.url):
        raise HTTPException(status_code=400, detail="Unsupported platform")

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
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
        # Use tv_embedded first — works on data-centre IPs without cookies.
        # Fall back through ios → android → web.
        "extractor_args": {
            "youtube": {
                "player_client": ["tv_embedded", "ios", "android", "web"],
            }
        },
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
        print(f"[yt-dlp DownloadError] {str(e)}", flush=True)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if cookies_file:
            try:
                os.unlink(cookies_file)
            except Exception:
                pass

    if not info:
        raise HTTPException(status_code=404, detail="Video not found")

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
        raise HTTPException(status_code=404, detail="No downloadable formats found")

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


# ─── Playlist endpoint ────────────────────────────────────────────────────────

_PLAYLIST_PATTERN = re.compile(
    r"youtube\.com/(playlist|watch)\?.*list=|youtu\.be/.*\?.*list="
)

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
        "socket_timeout": 15,
        "extractor_args": {
            "youtube": {"player_client": ["tv_embedded", "web"]},
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
        "socket_timeout": 15,
        "extractor_args": {
            "youtube": {"player_client": ["tv_embedded", "web"]},
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
async def download_youtube(url: str = Query(...), quality: str = Query("hd")):
    """Stream YouTube video via yt-dlp subprocess piped to stdout.

    Two-phase approach:
      1. Fast metadata extraction (Python API, skip_download=True) → title
      2. yt-dlp subprocess with --output - streams bytes to the client immediately

    Phase 2 starts piping within ~2s of yt-dlp start, so response headers
    are sent well within Railway's 30-second timeout.
    Format selector uses progressive (combined A/V) mp4 formats (18=360p, 22=720p)
    that need no ffmpeg merging and pipe cleanly to stdout.
    """
    import sys

    # ── Phase 1: Quick metadata for title ─────────────────────────────────────
    ydl_opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "check_formats": False,
        "extractor_args": {
            "youtube": {
                "player_client": ["tv_embedded", "ios", "android", "web"],
            }
        },
    }
    if PROXY_URL:
        ydl_opts["proxy"] = PROXY_URL

    cookies_file = None
    if YOUTUBE_COOKIES:
        try:
            tmp_c = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
            tmp_c.write(YOUTUBE_COOKIES)
            tmp_c.close()
            cookies_file = tmp_c.name
            ydl_opts["cookiefile"] = cookies_file
        except Exception:
            pass

    def _extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)

    try:
        info = await asyncio.wait_for(asyncio.to_thread(_extract), timeout=25)
    except asyncio.TimeoutError:
        if cookies_file:
            try: os.unlink(cookies_file)
            except Exception: pass
        raise HTTPException(status_code=504, detail="YouTube extraction timed out — please try again.")
    except Exception as e:
        if cookies_file:
            try: os.unlink(cookies_file)
            except Exception: pass
        raise HTTPException(status_code=422, detail=f"Could not extract video: {_clean_error(str(e))}")

    title = info.get("title", "youtube_video")
    safe_title = re.sub(r'[^\w\-.]', '_', title, flags=re.ASCII).strip('_')[:80] or "youtube_video"

    # ── Phase 2: subprocess yt-dlp --output - ─────────────────────────────────
    # Use progressive (combined A/V) mp4 formats only — they pipe to stdout
    # without needing ffmpeg to merge separate video/audio streams.
    #   22 = 720p mp4  (progressive, audio+video)
    #   18 = 360p mp4  (progressive, audio+video, universal fallback)
    if quality == "audio":
        fmt_sel = "bestaudio[ext=m4a]/bestaudio"
        out_ext, media_type = "m4a", "audio/mp4"
    elif quality == "sd":
        fmt_sel = "18"           # 360p mp4 progressive
        out_ext, media_type = "mp4", "video/mp4"
    else:                        # hd (default)
        fmt_sel = "22/18"        # 720p mp4 → 360p mp4 fallback
        out_ext, media_type = "mp4", "video/mp4"

    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--format", fmt_sel,
        "--output", "-",         # write to stdout
        "--quiet",
        "--no-warnings",
        "--no-part",
        "--extractor-args", "youtube:player_client=tv_embedded,ios,android,web",
    ]
    if PROXY_URL:
        cmd += ["--proxy", PROXY_URL]
    if cookies_file:
        cmd += ["--cookies", cookies_file]
    cmd.append(url)

    async def stream_subprocess():
        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            while True:
                chunk = await proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            if proc:
                try: proc.kill()
                except Exception: pass
                try: await proc.wait()
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
                "player_client": ["tv_embedded", "ios", "android", "web"],
            }
        },
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
