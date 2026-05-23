"""
ReelGet Telegram Bot
====================
Lets users send any supported video URL and receive download links.

Setup:
  1. Create a bot via @BotFather on Telegram → copy the token.
  2. Set  TELEGRAM_BOT_TOKEN=<your-token>  in the environment / .env file.
  3. Run:  python telegram_bot.py

The bot does NOT upload files — it sends inline keyboard buttons that
link to the ReelGet proxy endpoint so the file downloads directly.
"""

import asyncio
import logging
import os
import re

import yt_dlp
from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters

load_dotenv()

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
SITE_BASE = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://reelget.com")
API_BASE = os.environ.get("API_BASE_URL", "https://reelget-backend.railway.app")

SUPPORTED_PATTERN = re.compile(
    r"(instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch"
    r"|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co"
    r"|pinterest\.com|pin\.it|snapchat\.com|linkedin\.com"
    r"|reddit\.com|redd\.it|vimeo\.com|dailymotion\.com|dai\.ly"
    r"|twitch\.tv|clips\.twitch\.tv|threads\.net)"
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class _Silent:
    def debug(self, m): pass
    def warning(self, m): pass
    def error(self, m): pass


def extract_url(text: str) -> str | None:
    """Pull the first http(s) URL out of a message."""
    m = re.search(r"https?://\S+", text)
    return m.group(0).rstrip(".,)>]'\"") if m else None


def fetch_formats(url: str) -> dict:
    """Run yt-dlp synchronously and return title + list of format dicts."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "logger": _Silent(),
        "check_formats": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


def build_proxy_url(fmt_url: str, title: str, ext: str) -> str:
    from urllib.parse import quote
    return (
        f"{API_BASE}/api/proxy"
        f"?url={quote(fmt_url, safe='')}"
        f"&filename={quote(title[:60], safe='')}"
        f"&ext={ext}"
    )


# ─── Handlers ────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Welcome to *ReelGet Bot*\\!\n\n"
        "Send me any video URL from Instagram, TikTok, YouTube, Facebook, Twitter/X, "
        "Pinterest, Snapchat, Reddit, Vimeo and more — I'll give you download links\\.\n\n"
        f"🌐 Web version: {SITE_BASE}",
        parse_mode="MarkdownV2",
    )


async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = update.message.text or ""
    url = extract_url(text)

    if not url or not SUPPORTED_PATTERN.search(url):
        await update.message.reply_text(
            "⚠️ Please send a valid video URL from a supported platform.\n"
            "Supported: Instagram, TikTok, YouTube, Facebook, Twitter/X, Pinterest, and more."
        )
        return

    msg = await update.message.reply_text("⏳ Fetching video info…")

    try:
        info = await asyncio.to_thread(fetch_formats, url)
    except Exception as e:
        err = str(e).replace("ERROR: ", "").split("\n")[0][:200]
        await msg.edit_text(f"❌ Could not fetch video:\n{err}")
        return

    title = (info.get("title") or "video")[:80]
    formats = info.get("formats") or []

    # Build buttons — pick best video+audio, SD fallback, and audio-only
    buttons: list[InlineKeyboardButton] = []

    # Best combined (video+audio) format
    combined = [
        f for f in formats
        if f.get("vcodec") != "none" and f.get("acodec") != "none" and f.get("url")
    ]
    if combined:
        best = max(combined, key=lambda f: f.get("height") or 0)
        ext = best.get("ext", "mp4")
        label = f"⬇ HD {best.get('height', '')}p" if best.get("height") else "⬇ HD Video"
        buttons.append(InlineKeyboardButton(label, url=build_proxy_url(best["url"], title, ext)))

        # SD option if height > 480
        sd = [f for f in combined if (f.get("height") or 0) <= 480]
        if sd and (best.get("height") or 0) > 480:
            worst = min(sd, key=lambda f: f.get("height") or 999)
            ext2 = worst.get("ext", "mp4")
            buttons.append(InlineKeyboardButton("⬇ SD Video", url=build_proxy_url(worst["url"], title, ext2)))

    # Audio-only
    audio = [
        f for f in formats
        if f.get("vcodec") == "none" and f.get("acodec") != "none" and f.get("url")
    ]
    if audio:
        best_audio = max(audio, key=lambda f: f.get("abr") or 0)
        ext_a = best_audio.get("ext", "m4a")
        buttons.append(InlineKeyboardButton("🎵 Audio only", url=build_proxy_url(best_audio["url"], title, ext_a)))

    if not buttons:
        await msg.edit_text("❌ No downloadable formats found for this video.")
        return

    keyboard = InlineKeyboardMarkup([buttons])
    caption = f"*{title}*\n\nTap a button to download:"
    await msg.edit_text(caption, reply_markup=keyboard, parse_mode="Markdown")


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set. See the setup instructions at the top of this file.")

    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    log.info("ReelGet bot is running…")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
