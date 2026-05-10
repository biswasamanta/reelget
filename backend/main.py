from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
import yt_dlp
import httpx
import re
import os
import json
import time
import tempfile
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="VidSave API")

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,https://reelget.com,https://www.reelget.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

SUPPORTED_PATTERN = re.compile(
    r"(instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co|pinterest\.com|pin\.it|snapchat\.com|story\.snapchat\.com)"
)

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
YOUTUBE_COOKIES = os.environ.get("YOUTUBE_COOKIES", "")
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_TTL = 6 * 3600  # 6 hours

ALLOWED_REGIONS = {"IN", "PK", "ID", "BR", "SA", "VN", "US", "NG", "KE"}


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
async def download(req: DownloadRequest):
    if not SUPPORTED_PATTERN.search(req.url):
        raise HTTPException(status_code=400, detail="Unsupported platform")

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

    # Write YouTube cookies to a temp file if provided
    cookies_file = None
    if YOUTUBE_COOKIES:
        try:
            tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            tmp.write(YOUTUBE_COOKIES)
            tmp.close()
            cookies_file = tmp.name
            ydl_opts["cookiefile"] = cookies_file
            print(f"[cookies] Loaded {len(YOUTUBE_COOKIES)} chars → {cookies_file}", flush=True)
        except Exception as ex:
            print(f"[cookies] Failed to write cookies file: {ex}", flush=True)
    else:
        print("[cookies] No YOUTUBE_COOKIES env var found", flush=True)

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

    raw_formats = info.get("formats", [])

    # HD: combined mp4 → combined any ext → video-only (Instagram uses separate streams)
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

    if not formats and info.get("url"):
        formats.append(FormatInfo(label="Download", url=info["url"], ext="mp4"))

    if not formats:
        raise HTTPException(status_code=404, detail="No downloadable formats found")

    return DownloadResponse(
        title=info.get("title", "Video"),
        thumbnail=info.get("thumbnail"),
        formats=formats,
    )


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
    content_type = "audio/mp4" if ext == "m4a" else "video/mp4"

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


@app.get("/health")
def health():
    return {"status": "ok"}
