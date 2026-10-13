"""Joins PNG frames into an animated GIF: gif.py OUT.gif FRAME.png [FRAME.png ...].

Each frame shows for 1.6 s, the last one for 2.4 s, and the loop restarts. Frames are scaled
to 960 px wide so the GIF stays small enough for a README. Needs Pillow.
"""
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class GifJob:
    output: Path
    frames: list[Path]
    width: int = 960
    frame_ms: int = 1600
    last_ms: int = 2400


def build(job: GifJob) -> int:
    images = []
    for frame in job.frames:
        image = Image.open(frame).convert("RGB")
        height = round(image.height * job.width / image.width)
        images.append(image.resize((job.width, height), Image.LANCZOS).quantize(colors=128, method=Image.Quantize.MEDIANCUT))
    durations = [job.frame_ms] * (len(images) - 1) + [job.last_ms]
    images[0].save(job.output, save_all=True, append_images=images[1:], duration=durations, loop=0, optimize=True)
    return job.output.stat().st_size


def main(argv: list[str]) -> None:
    if len(argv) < 3:
        raise SystemExit("usage: gif.py OUT.gif FRAME.png [FRAME.png ...]")
    job = GifJob(output=Path(argv[1]), frames=[Path(p) for p in argv[2:]])
    missing = [str(p) for p in job.frames if not p.is_file()]
    if missing:
        raise SystemExit(f"missing frames: {', '.join(missing)}")
    size = build(job)
    print(f"{job.output.name}: {len(job.frames)} frames, {size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv)
