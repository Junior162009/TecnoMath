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
                if question and len(opts) >= 2:
                    bg = ROOT / f".live-card-{index}.png"
                    await card.screenshot(path=str(bg), timeout=10000)
                    correct = None
                    explanation = ""
                    # Let the real game reveal its own correct answer; never calculate or guess it.
                    buttons = card.locator(".answer, button[data-answer], .answers button")
                    if await buttons.count() >= 2:
                        await buttons.first.click(timeout=2500)
                        await page.wait_for_timeout(180)
                        for answer_index, button in enumerate(await buttons.all()):
                            classes = (await button.get_attribute("class")) or ""
                            if "correct" in classes.split():
                                correct = answer_index
                                break
                        try:
                            explanation = (await card.locator(".feedback").inner_text(timeout=1000)).strip()
                            explanation = re.sub(r"^(✨ ¡Correcto! \+10 puntos\. |💡 Sigue aprendiendo\. |¡Reto superado! |Respuesta guardada\. )", "", explanation)
                        except Exception:
                            explanation = ""
                    # The screenshot and answer feedback come from the live published game.
                    items.append({"question": question, "options": opts[:4], "background": str(bg),
                                  "category": "Reto educativo", "correct": correct, "explanation": explanation})
            except Exception:
                continue
        # If a page version exposes a global data bank, read it only when DOM cards are unavailable.
        if not items:
            data = await page.evaluate("""() => {
              const arr = window.questions || window.QUESTIONS || window.questionBank;
              if (!Array.isArray(arr)) return [];
              return arr.map(q => ({question:q.question||q.text, options:q.answers||q.options,
                correct:Number.isInteger(q.correct)?q.correct:(Number.isInteger(q.correctIndex)?q.correctIndex:null),
                explanation:q.explain||q.explanation||'',category:q.category||'Reto educativo'}))
                .filter(q=>q.question && Array.isArray(q.options) && q.options.length>=2);
            }""")
            if data:
                shot = ROOT / ".live-page.png"
                await page.screenshot(path=str(shot), full_page=True)
                items = [{**q, "background": str(shot), "options": q["options"][:4]} for q in data]
        await browser.close()
        if len(items) < 5:
            raise RuntimeError(f"La página real solo expuso {len(items)} preguntas legibles; se requieren 5. Revisa selectores o que la página esté disponible: {BASE_URL}")
        # Correctness is sourced from the live page only; never invent an answer if the page doesn't expose it.
        return items

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
        if not isinstance(correct, int) or correct < 0 or correct >= len(options):
            # The public page's visible feedback can disclose the answer; don't guess.
            correct = None
        first_text = f"¡Reto TecnoMath! {question} " + " ".join(f"Opción {chr(65+i)}: {v}." for i,v in enumerate(options)) + " Tienes unos segundos para pensar."
        reveal_text = ("La respuesta correcta es " + options[correct] + ". " + explanation + " Entra a tecnomath.online y acepta el siguiente reto."
                       if correct is not None else "¿Ya tienes tu respuesta? Entra a TecnoMath Retos para comprobarla y desafiar a tus amigos.")
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
        manifest.append({"file":out.name,"question":question,"has_verified_answer":correct is not None,"source":BASE_URL})
        print(f"CREATED {out}")
    (ROOT/"manifest.json").write_text(json.dumps({"date_utc":day,"source":BASE_URL,"count":len(manifest),"videos":manifest},ensure_ascii=False,indent=2),encoding="utf-8")
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
