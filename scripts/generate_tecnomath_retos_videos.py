#!/usr/bin/env python3
"""Create five vertical TecnoMath Retos MP4s from the live public game page."""
from __future__ import annotations
import asyncio, json, os, random, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from playwright.async_api import async_playwright
import edge_tts

ROOT = Path(os.environ.get("VIDEO_OUTPUT_DIR", "output/tecnomath-retos"))
BASE_URL = os.environ.get("TECNOMATH_RETOS_URL", "https://tecnomath.online/games/tecnomath-retos/")
VOICE = os.environ.get("TTS_VOICE", "es-CO-SalomeNeural")
WIDTH, HEIGHT = 1080, 1920
FPS = 30
ROOT.mkdir(parents=True, exist_ok=True)

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def font(size, bold=False):
    choices = (["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold else
               ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    for p in choices:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def wrap(draw, text, fnt, max_width):
    words = str(text).split()
    lines, line = [], ""
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= max_width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line: lines.append(line)
    return lines

def make_slide(background, question, options, answer=None, explanation="", reveal=False):
    im = Image.open(background).convert("RGB").resize((WIDTH, HEIGHT))
    im = im.filter(ImageFilter.GaussianBlur(18))
    shade = Image.new("RGBA", (WIDTH, HEIGHT), (7, 10, 28, 205))
    im = Image.alpha_composite(im.convert("RGBA"), shade)
    d = ImageDraw.Draw(im)
    # Brand stripe and readable card
    d.rounded_rectangle((52, 62, WIDTH-52, HEIGHT-62), radius=48, fill=(15, 24, 52, 242), outline=(116, 100, 255, 255), width=4)
    d.rounded_rectangle((88, 105, 330, 166), radius=26, fill=(28, 71, 83, 255))
    d.text((112, 118), "TECNOMATH", font=font(29, True), fill=(91, 238, 219))
    d.text((88, 225), "RETO RELÁMPAGO", font=font(32, True), fill=(255, 216, 107))
    d.text((88, 300), "¿PUEDES RESPONDER?", font=font(29, True), fill=(190, 202, 235))
    y = 390
    for line in wrap(d, question, font(64, True), WIDTH-190):
        d.text((88, y), line, font=font(64, True), fill=(250, 251, 255), stroke_width=1, stroke_fill=(20, 25, 48))
        y += 82
    y += 44
    for i, option in enumerate(options):
        correct = reveal and i == answer
        fill = (18, 83, 73, 255) if correct else (31, 42, 75, 255)
        outline = (83, 234, 217, 255) if correct else (69, 83, 124, 255)
        d.rounded_rectangle((82, y, WIDTH-82, y+126), radius=28, fill=fill, outline=outline, width=3)
        d.ellipse((108, y+32, 170, y+94), fill=(83, 234, 217, 255) if correct else (62, 75, 111, 255))
        d.text((128, y+42), chr(65+i), font=font(29, True), fill=(7, 20, 34) if correct else (255,255,255))
        lines = wrap(d, option, font(34, True), WIDTH-330)
        for j, line in enumerate(lines[:2]):
            d.text((196, y+29+j*43), line, font=font(34, True), fill=(255,255,255))
        y += 145
    if reveal:
        y += 12
        d.text((88, y), "✓ RESPUESTA CORRECTA", font=font(35, True), fill=(83, 234, 217))
        y += 55
        for line in wrap(d, explanation or "¡Buen trabajo! Sigue aprendiendo con TecnoMath.", font(27), WIDTH-180)[:3]:
            d.text((88, y), line, font=font(27), fill=(213, 222, 245)); y += 38
    d.text((88, HEIGHT-165), "DESAFÍA A TUS AMIGOS", font=font(31, True), fill=(255, 216, 107))
    d.text((88, HEIGHT-112), "tecnomath.online", font=font(28), fill=(185, 198, 229))
    return im.convert("RGB")

async def synthesize(text, out):
    communicate = edge_tts.Communicate(text, VOICE, rate="+4%", volume="+0%")
    await communicate.save(str(out))

async def scrape_live():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=1)
        await page.goto(BASE_URL, wait_until="networkidle", timeout=90000)
        await page.wait_for_timeout(1800)
        # Try the published site's actual question cards first.
        cards = await page.locator("article.card, .challenge-card, [data-question]").all()
        items = []
        for index, card in enumerate(cards):
            try:
                question = (await card.locator(".question, [data-question-text], h2, h3").first.inner_text(timeout=2500)).strip()
                opts = await card.locator(".answer, button[data-answer], .answers button").all_inner_texts()
                opts = [re.sub(r"^[A-Da-d]\s*", "", s).strip() for s in opts]
                buttons = card.locator(".answer, button[data-answer], .answers button")
                if question and len(opts) >= 2 and await buttons.count() == len(opts):
                    # Never click an answer during extraction: that mutates the live game state.
                    correct = None
                    for answer_index, button in enumerate(await buttons.all()):
                        classes = ((await button.get_attribute("class")) or "").split()
                        if "correct" in classes:
                            correct = answer_index
                            break
                    if correct is None:
                        print(f"SKIP card={index}: no verified correct-answer state; question={question!r}")
                        continue
                    bg = ROOT / f".live-card-{index}.png"
                    await card.screenshot(path=str(bg), timeout=10000)
                    explanation = ""
                    try:
                        explanation = (await card.locator(".feedback").inner_text(timeout=1000)).strip()
                    except Exception:
                        pass
                    print(f"QUESTION card={index} options={len(opts)} verified_correct_index={correct}")
                    items.append({"question": question, "options": opts[:4], "background": str(bg),
                                  "category": "Reto educativo", "correct": correct, "explanation": explanation})
            except Exception:
                continue
        # The live game's authoritative question bank is a page-local const, not window.questions.
        # Read its literal data without clicking choices or mutating gameplay state.
        if not items:
            data = await page.evaluate("""() => {
              const source = [...document.scripts].map(s => s.textContent || '').join('\\n');
              const match = source.match(/const\\s+questions\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;/);
              if (!match) return [];
              const literal = match[1];
              if (literal.includes('=>') || /\\bfunction\\b|\\bimport\\b|\\beval\\b/.test(literal)) return [];
              try {
                const parsed = Function('"use strict"; return (' + literal + ')')();
                return Array.isArray(parsed) ? parsed.map(q => ({
                  question: q.question, options: q.answers, correct: q.correct,
                  explanation: q.explain || '', category: q.category || 'Reto educativo'
                })).filter(q => typeof q.question === 'string' && Array.isArray(q.options) &&
                  q.options.length >= 2 && Number.isInteger(q.correct) &&
                  q.correct >= 0 && q.correct < q.options.length) : [];
              } catch (_) { return []; }
            }""")
            if data:
                shot = ROOT / ".live-page.png"
                await page.screenshot(path=str(shot), full_page=True)
                items = [{**q, "background": str(shot), "options": q["options"][:4]} for q in data]
                print(f"QUESTION_BANK source=published-inline-script verified={len(items)}")
        await browser.close()
        valid = []
        for item in items:
            opts, correct = item.get("options"), item.get("correct")
            if (isinstance(item.get("question"), str) and item["question"].strip()
                and isinstance(opts, list) and 2 <= len(opts) <= 4
                and all(isinstance(v, str) and v.strip() for v in opts)
                and isinstance(correct, int) and not isinstance(correct, bool)
                and 0 <= correct < len(opts)):
                valid.append(item)
            else:
                print(f"SKIP invalid/unverified question: {item.get('question', '<sin pregunta>')!r}")
        print(f"EXTRACTION total={len(items)} verified_valid={len(valid)} required=5")
        if len(valid) < 5:
            raise RuntimeError(f"Solo hay {len(valid)} preguntas con respuesta verificada; se requieren 5. No se generarán videos incompletos. URL: {BASE_URL}")
        return valid

def duration(path):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True,check=True)
    return max(1.0,float(r.stdout.strip()))

async def main():
    if urlparse(BASE_URL).scheme != "https":
        raise RuntimeError("TECNOMATH_RETOS_URL debe usar HTTPS.")
    questions = await scrape_live()
    # Rotate question selection daily so the same five are not always selected first.
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rng = random.Random(day)
    chosen = questions[:]
    rng.shuffle(chosen)
    manifest = []
    for number, q in enumerate(chosen[:5], start=1):
        work = ROOT / f".work-{number}"
        work.mkdir(exist_ok=True)
        question = q["question"]
        options = q["options"]
        correct = q.get("correct")
        explanation = q.get("explanation") or "Piensa en la pregunta, comprueba tu respuesta y sigue practicando en TecnoMath."
        if (not isinstance(correct, int) or isinstance(correct, bool) or correct < 0
                or correct >= len(options) or not all(isinstance(v, str) and v.strip() for v in options)):
            raise RuntimeError(f"Pregunta {number} sin respuesta correcta verificada; se cancela.")
        first_text = f"¡Reto TecnoMath! {question} " + " ".join(f"Opción {chr(65+i)}: {v}." for i,v in enumerate(options)) + " Tienes unos segundos para pensar."
        reveal_text = "La respuesta correcta es " + options[correct] + ". " + explanation + " Entra a tecnomath.online y acepta el siguiente reto."
        a, b = work/"pregunta.mp3", work/"respuesta.mp3"
        await synthesize(first_text, a)
        await synthesize(reveal_text, b)
        silence = work/"silence.mp3"
        run(["ffmpeg","-y","-f","lavfi","-i","anullsrc=r=24000:cl=mono","-t","1.2","-q:a","9",str(silence)])
        voice = work/"voz.mp3"
        concat = work/"audio.txt"
        concat.write_text(f"file '{a.as_posix()}'\nfile '{silence.as_posix()}'\nfile '{b.as_posix()}'\n",encoding="utf-8")
        run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(concat),"-c:a","libmp3lame","-q:a","3",str(voice)])
        qimg, rimg = work/"pregunta.png", work/"respuesta.png"
        make_slide(q["background"],question,options).save(qimg)
        make_slide(q["background"],question,options,correct,explanation,True).save(rimg)
        first_duration = duration(a)+1.2
        total_duration = duration(voice)
        clip1, clip2 = work/"1.mp4", work/"2.mp4"
        run(["ffmpeg","-y","-loop","1","-i",str(qimg),"-t",str(first_duration),"-r",str(FPS),"-vf","scale=1080:1920,format=yuv420p","-an","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p",str(clip1)])
        second_duration = max(1.5,total_duration-first_duration)
        run(["ffmpeg","-y","-loop","1","-i",str(rimg),"-t",str(second_duration),"-r",str(FPS),"-vf","scale=1080:1920,format=yuv420p","-an","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p",str(clip2)])
        joined = work/"joined.mp4"
        listing = work/"clips.txt"
        listing.write_text(f"file '{clip1.as_posix()}'\nfile '{clip2.as_posix()}'\n",encoding="utf-8")
        run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(listing),"-c","copy",str(joined)])
        slug = re.sub(r"[^a-z0-9]+","-",question.lower()).strip("-")[:48] or f"reto-{number}"
        out = ROOT/f"{day}-tecnomath-reto-{number}-{slug}.mp4"
        run(["ffmpeg","-y","-i",str(joined),"-i",str(voice),"-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","veryfast","-crf","24","-c:a","aac","-b:a","128k","-shortest","-movflags","+faststart","-pix_fmt","yuv420p",str(out)])
        probe = subprocess.run(["ffprobe","-v","error","-show_entries","stream=codec_name,codec_type,width,height","-show_entries","format=duration","-of","json",str(out)],capture_output=True,text=True,check=True)
        media = json.loads(probe.stdout)
        streams = media.get("streams", [])
        video = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
        seconds = float(media.get("format", {}).get("duration", 0))
        if not video or video.get("codec_name") != "h264" or video.get("width") != WIDTH or video.get("height") != HEIGHT:
            raise RuntimeError(f"Validación de video fallida: {out.name}: {media}")
        if not audio or audio.get("codec_name") != "aac" or seconds <= 0:
            raise RuntimeError(f"Validación de audio/duración fallida: {out.name}: {media}")
        manifest.append({"file":out.name,"question":question,"answer":options[correct],"has_verified_answer":True,"duration_seconds":round(seconds,2),"width":WIDTH,"height":HEIGHT,"video_codec":"h264","audio_codec":"aac","source":BASE_URL})
        print(f"CREATED {out}")
    if len(manifest) != 5 or any(not (ROOT / item["file"]).is_file() for item in manifest):
        raise RuntimeError(f"Se esperaban cinco MP4 existentes; se encontraron {len(manifest)}.")
    manifest_path = ROOT/"manifest.json"
    manifest_path.write_text(json.dumps({"date_utc":day,"source":BASE_URL,"count":len(manifest),"videos":manifest},ensure_ascii=False,indent=2),encoding="utf-8")
    parsed = json.loads(manifest_path.read_text(encoding="utf-8"))
    if parsed.get("count") != 5 or len(parsed.get("videos", [])) != 5:
        raise RuntimeError("manifest.json no contiene exactamente cinco videos.")
    # Clean temporary screenshots and intermediate assets; retain only deliverables and manifest.
    for p in ROOT.iterdir():
        if p.name.startswith(".live-") or p.name.startswith(".work-"):
            if p.is_dir():
                import shutil; shutil.rmtree(p,ignore_errors=True)
            else:
                p.unlink(missing_ok=True)
    print(f"SUCCESS: {len(manifest)} MP4 creados en {ROOT}")

if __name__ == "__main__":
    try: asyncio.run(main())
    except Exception as exc:
        print(f"ERROR: {exc}",file=sys.stderr)
        raise
