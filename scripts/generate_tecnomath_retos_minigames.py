#!/usr/bin/env python3
"""Generate vertical TecnoMath Retos videos from real local game pages."""
from __future__ import annotations
import asyncio, json, os, random, re, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(os.environ.get("VIDEO_OUTPUT_DIR", "output/tecnomath-retos"))
SITE_BASE = os.environ.get("TECNOMATH_SITE_BASE", "https://tecnomath.online/")
GAME_ROOT = Path(os.environ.get("TECNOMATH_GAME_ROOT", "games"))
COUNT = int(os.environ.get("TECNOMATH_VIDEO_COUNT", "5"))
WIDTH, HEIGHT, FPS = 1080, 1920, 30
CAPTURE_SECONDS = max(60.0, float(os.environ.get("GAMEPLAY_CAPTURE_SECONDS", "75")))
SEED = os.environ.get("VIDEO_ROTATION_SEED", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
SKIP_DIRS = {"IA", "downloader"}
ROOT.mkdir(parents=True, exist_ok=True)

FORMATS = [
    ("¿PUEDES SUPERARLO?", "A ver si puedes superar este reto de TecnoMath.", "🔥 ¿Cuánto sacarías tú?"),
    ("5 SEGUNDOS", "Tienes cinco segundos. ¡Vamos!", "⏱️ ¿Lo conseguiste?"),
    ("NIVEL DIFÍCIL", "Este nivel no es para todos.", "🧠 ¿Lo puedes superar?"),
    ("¿QUÉ HARÍAS?", "Mira bien. ¿Qué harías tú?", "🤔 ¿Habrías elegido lo mismo?"),
    ("RÉCORD", "¿Puedes superar esta puntuación?", "🚀 Inténtalo en TecnoMath."),
]


def log(event, **data):
    extra = " ".join(f"{k}={json.dumps(v, ensure_ascii=False)}" for k, v in data.items())
    print(f"{event}" + (f" {extra}" if extra else ""), flush=True)


def run(cmd, check=True):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode and check:
        detail = (p.stderr or p.stdout or "").strip()
        print(f"COMMAND FAILED (exit {p.returncode}): {' '.join(map(str, cmd))}", file=sys.stderr)
        if detail:
            print(detail[-12000:], file=sys.stderr)
        raise subprocess.CalledProcessError(p.returncode, cmd, p.stdout, p.stderr)
    return p


def slug(value):
    value = re.sub(r"[^a-z0-9áéíóúüñ]+", "-", str(value).lower(), flags=re.I).strip("-")
    return value[:60] or "minijuego"


def validate_gameplay_motion(path, game_name):
    """Reject title-only/static captures by comparing sampled real gameplay frames."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-vf",
           "fps=1,scale=64:114:flags=area,format=gray", "-f", "rawvideo", "-"]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(f"gameplay_frame_decode_failed game={game_name}: {result.stderr.decode(errors='replace')[-2000:]}")
    frame_size = 64 * 114
    raw = result.stdout
    frames = [raw[i:i + frame_size] for i in range(0, len(raw) - frame_size + 1, frame_size)]
    if len(frames) < 3:
        raise RuntimeError(f"gameplay_too_short game={game_name}: only {len(frames)} sampled frames")
    changed = 0
    for previous, current in zip(frames, frames[1:]):
        if sum(a != b for a, b in zip(previous, current)) / frame_size >= 0.02:
            changed += 1
    if changed < 2:
        raise RuntimeError(f"gameplay_static_or_title_only game={game_name}: only {changed} meaningful frame changes")
    log("GAMEPLAY_MOTION_VALIDATED", name=game_name, sampled_frames=len(frames), meaningful_changes=changed)


def ffprobe(path):
    data = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height", "-show_entries", "format=duration,size", "-of", "json", str(path)]).stdout)
    streams = data.get("streams", [])
    video = next((x for x in streams if x.get("codec_type") == "video"), None)
    audio = next((x for x in streams if x.get("codec_type") == "audio"), None)
    return data, video, audio


def discover_games():
    games = []
    for index in sorted(GAME_ROOT.glob("**/index.html")):
        rel = index.relative_to(GAME_ROOT)
        if any(part.startswith(".") or part in SKIP_DIRS for part in rel.parts):
            continue
        text = index.read_text(encoding="utf-8", errors="ignore")
        if len(text) < 200:
            continue
        interactive = bool(re.search(r"<(button|canvas|input|select|a\b)[^>]*>", text, re.I))
        script = bool(re.search(r"<script(?:\s|>)", text, re.I))
        if not (interactive and script):
            continue
        folder = rel.parts[0] if rel.parts else index.parent.name
        game_path = "/".join(rel.parts)
        games.append({
            "name": folder,
            "path": index,
            "entry": game_path,
            "url": urljoin(SITE_BASE, f"games/{game_path}"),
        })
        log("GAME_DISCOVERED", name=folder, entry=str(index))
    return games


async def capture_game(game, work):
    log("GAME_SELECTED", name=game["name"], url=game["url"])
    async with async_playwright() as p:
        browser = context = None
        try:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 540, "height": 960},
                device_scale_factor=1,
                record_video_dir=str(work / "capture"),
                record_video_size={"width": 540, "height": 960},
            )
            page = await context.new_page()
            log("GAME_LOADING", name=game["name"])
            try:
                await page.goto(game["url"], wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(2200)
            except Exception as exc:
                log("GAME_ERROR", stage="load", name=game["name"], error=str(exc))
                return None
            title = await page.title()
            body_text = (await page.locator("body").inner_text(timeout=5000))[:4000]
            if "404" in title or "404" in body_text[:500] or "Not Found" in body_text[:500]:
                log("GAME_SKIPPED", name=game["name"], reason="404_or_not_found")
                return None
            log("GAME_READY", name=game["name"], title=title)
            start_re = re.compile(r"^(jugar|play|comenzar|iniciar|empezar|start|continuar|nuevo juego)$", re.I)
            for _ in range(2):
                clicked = False
                for locator in [page.get_by_role("button"), page.locator("a"), page.locator("[role=button]")]:
                    try:
                        for i in range(min(await locator.count(), 40)):
                            el = locator.nth(i)
                            if await el.is_visible() and await el.is_enabled():
                                txt = (await el.inner_text()).strip()
                                if start_re.match(txt):
                                    await el.click(timeout=1500)
                                    await page.wait_for_timeout(500)
                                    clicked = True
                                    break
                        if clicked:
                            break
                    except Exception:
                        continue
            action_re = re.compile(r"^(\d+|[a-dA-D][.)]?|verdadero|falso|sí|si|no|ok|siguiente|continuar|aceptar|confirmar)$", re.I)
            deadline = asyncio.get_running_loop().time() + max(1.0, CAPTURE_SECONDS - 1.0)
            while asyncio.get_running_loop().time() < deadline:
                clicked = False
                buttons = page.locator("button, [role=button]")
                try:
                    for i in range(min(await buttons.count(), 50)):
                        el = buttons.nth(i)
                        if await el.is_visible() and await el.is_enabled():
                            txt = (await el.inner_text()).strip()
                            if txt and action_re.match(txt):
                                await el.click(timeout=800)
                                clicked = True
                                break
                except Exception:
                    pass
                await page.wait_for_timeout(700 if clicked else 1000)
            await page.wait_for_timeout(1000)
            video = page.video
            await context.close()
            path = await video.path() if video else None
            if not path:
                log("GAME_SKIPPED", name=game["name"], reason="no_playwright_video")
                return None
            src = Path(path)
            if not src.exists() or src.stat().st_size < 1024:
                log("GAME_SKIPPED", name=game["name"], reason="empty_capture")
                return None
            log("GAMEPLAY_CAPTURED", name=game["name"], file=str(src))
            return src
        except PlaywrightTimeoutError as exc:
            log("GAME_ERROR", stage="playwright_timeout", name=game["name"], error=str(exc))
            if context:
                try:
                    await context.close()
                except Exception:
                    pass
            return None
        except Exception as exc:
            log("GAME_ERROR", stage="capture", name=game["name"], error=str(exc))
            if context:
                try:
                    await context.close()
                except Exception:
                    pass
            return None
        finally:
            if browser:
                try:
                    await browser.close()
                except Exception:
                    pass


def render_vertical(game_video, voice_file, out, fmt):
    headline, _, cta = fmt
    vf = (
        "scale=1080:1920:force_original_aspect_ratio=decrease,"
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,"
        "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
        "text='TECNOMATH':fontcolor=white:fontsize=48:x=54:y=54:box=1:boxcolor=black@0.48:boxborderw=18,"
        "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
        f"text='{headline}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=130:box=1:boxcolor=black@0.62:boxborderw=24,"
        "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
        f"text='{cta}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-125:box=1:boxcolor=black@0.62:boxborderw=18"
    )
    cmd = ["ffmpeg", "-y", "-i", str(game_video)]
    if voice_file:
        cmd += ["-i", str(voice_file), "-map", "0:v:0", "-map", "1:a:0"]
    else:
        cmd += ["-map", "0:v:0"]
    cmd += ["-vf", vf, "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"]
    if voice_file:
        cmd += ["-c:a", "aac", "-b:a", "128k", "-shortest"]
    else:
        cmd += ["-an"]
    cmd += ["-movflags", "+faststart", str(out)]
    run(cmd)


async def render_one(game, number):
    work = ROOT / f".work-{number}"
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    capture = await capture_game(game, work)
    if not capture:
        return None
    try:
        validate_gameplay_motion(capture, game["name"])
    except Exception as exc:
        log("GAME_ERROR", stage="gameplay_validation", name=game["name"], error=str(exc))
        return None
    fmt = FORMATS[(number - 1) % len(FORMATS)]
    # Keep the source audio-free so the creator can add their own voice, music and effects.
    out = ROOT / f"video-{number:02d}.mp4"
    try:
        render_vertical(capture, None, out, fmt)
        data, video, audio = ffprobe(out)
        duration = float(data.get("format", {}).get("duration", 0))
        size = int(data.get("format", {}).get("size", 0))
        valid = bool(video and video.get("codec_name") == "h264" and video.get("width") == WIDTH and video.get("height") == HEIGHT and duration >= 60 and size > 1024 and audio is None)
        if not valid:
            raise RuntimeError(f"video_validation_failed: {data}")
        log("VIDEO_RENDERED", file=out.name, game=game["name"], format=fmt[0])
        log("VIDEO_VALIDATED", file=out.name, duration=round(duration, 2), bytes=size, audio=bool(audio), creator_voiceover_ready=True)
        return {"file": out.name, "minigame": game["name"], "game": game["name"], "source": game["url"], "entry": game["entry"], "format": fmt[0], "duration_seconds": round(duration, 2), "width": WIDTH, "height": HEIGHT, "resolution": f"{WIDTH}x{HEIGHT}", "video_codec": "h264", "audio_codec": None, "voice": None, "creator_voiceover_ready": True, "gameplay_captured": True, "gameplay_motion_validated": True, "validated": True, "validation_status": "passed"}
    except Exception as exc:
        log("GAME_ERROR", stage="render_or_validate", name=game["name"], error=str(exc))
        out.unlink(missing_ok=True)
        return None


async def main():
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("FFmpeg/ffprobe no están instalados")
    # Remove stale deliverables so a failed run cannot reuse previous MP4s.
    for stale in ROOT.glob("*.mp4"):
        stale.unlink(missing_ok=True)
    (ROOT / "manifest.json").unlink(missing_ok=True)
    (ROOT / "generation-error.log").unlink(missing_ok=True)
    games = discover_games()
    if len(games) < COUNT:
        raise RuntimeError(f"Solo se detectaron {len(games)} minijuegos web candidatos; se requieren {COUNT}")
    rng = random.Random(SEED)
    rng.shuffle(games)
    manifest = []
    used = set()
    for game in games:
        if len(manifest) >= COUNT:
            break
        if game["name"] in used:
            continue
        item = await render_one(game, len(manifest) + 1)
        if item:
            manifest.append(item)
            used.add(game["name"])
        else:
            log("GAME_SKIPPED", name=game["name"], reason="capture_or_validation_failed")
    if len(manifest) != COUNT:
        raise RuntimeError(f"Solo se validaron {len(manifest)} de {COUNT} videos; no se publicará una tanda incompleta")
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payload = {"date_utc": date, "count": len(manifest), "mode": "real-minigames", "games_discovered": len(games), "validation_status": "passed", "videos": manifest}
    (ROOT / "manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for p in ROOT.glob(".work-*"):
        shutil.rmtree(p, ignore_errors=True)
    log("SUCCESS", videos=len(manifest), output=str(ROOT))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        log("GAME_ERROR", stage="fatal", error=str(exc))
        try:
            ROOT.mkdir(parents=True, exist_ok=True)
            (ROOT / "generation-error.log").write_text(f"{type(exc).__name__}: {exc}\\n", encoding="utf-8")
        except Exception:
            pass
        raise
