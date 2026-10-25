#!/usr/bin/env python3
"""Original TecnoMath Retos entry point; delegates to the real-minigame generator."""
from __future__ import annotations
import asyncio
from generate_tecnomath_retos_minigames import main

if __name__ == "__main__":
    asyncio.run(main())
