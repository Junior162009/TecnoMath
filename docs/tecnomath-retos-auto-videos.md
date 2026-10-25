# Generador automático de videos — TecnoMath Retos

Genera cinco videos verticales MP4 por ejecución a partir del contenido que logra leer en la página pública real de TecnoMath Retos. Usa Playwright para inspeccionar las tarjetas publicadas, Edge TTS para voz en español y FFmpeg para producir archivos H.264/AAC 1080×1920.

## Automatización diaria
GitHub Actions está programado para ejecutarse a las 07:00 hora de Colombia (12:00 UTC). También puede iniciarse manualmente desde Actions → “Generar 5 videos diarios de TecnoMath Retos” → Run workflow.

## Obtener los videos
Al terminar una ejecución, abre su resumen en GitHub Actions y descarga el artefacto `tecnomath-retos-videos-<run id>`. Incluye cinco MP4 y `manifest.json`. El artefacto se conserva durante 30 días; los videos no se publican en redes ni se guardan permanentemente en el repositorio.

## Requisitos y límites
- No requiere claves API propias ni cambia Supabase.
- La voz usa el servicio de Edge TTS; necesita conexión a Internet y su disponibilidad depende del servicio externo. No se garantiza SLA.
- La página pública debe estar disponible y exponer su banco de preguntas con al menos cinco preguntas válidas. El generador inspecciona el DOM real (tarjetas `.card`, preguntas `.question`, opciones `.answer`) y, si las respuestas correctas no están reflejadas en el estado visual, lee el banco literal de preguntas del script publicado. No pulsa opciones ni modifica el progreso del juego.
- Cada pregunta debe tener entre 2 y 4 opciones de texto y un índice correcto entero válido. Las preguntas sin respuesta verificable se descartan; si quedan menos de cinco, la ejecución falla y no publica el artefacto.
- Cada MP4 se inspecciona con `ffprobe`: H.264, 1080×1920, pista AAC y duración válida. El manifiesto debe listar exactamente cinco videos existentes; el workflow repite la validación antes de subir el artefacto.
- Las tarjetas se derivan de preguntas leídas en el sitio público y las capturas reales de las tarjetas se usan como fondo visual. El MP4 final es una composición vertical, no una grabación continua de la interacción del navegador.
- La programación de GitHub Actions puede retrasarse y depende de límites de uso/retención de GitHub. Las ejecuciones programadas se ejecutan en la rama predeterminada; después de revisar este PR y fusionarlo, el workflow quedará activo.
- La generación no equivale a publicación automática en TikTok, Reels, Shorts ni Facebook.
- Los archivos son artefactos descargables, no están comprometidos al repositorio ni se guardan en una carpeta local del usuario.
