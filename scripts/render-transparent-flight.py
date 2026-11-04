"""Export the approved 40-frame flight as one transparent WebP atlas."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
source = Image.open(ROOT / 'outputs/flight-reference-upload.jpg').convert('RGBA').resize((1672, 941))
polygons = {
    'far': [(850,490),(850,470),(831,427),(833,395),(852,325),(894,278),(944,268),(967,294),(941,355),(897,424),(883,450),(872,474)],
    'near': [(850,519),(806,518),(750,499),(708,463),(677,417),(649,344),(655,317),(695,330),(744,384),(793,414),(856,466)],
    'body': [(630,660),(630,540),(740,540),(780,520),(815,485),(842,465),(873,454),(901,445),(925,418),(945,396),(960,380),(1010,380),(1070,420),(1070,660)],
}
alpha = source.convert('L').point(lambda value: max(0, min(255, (value - 48) * 8)))
layers = {}
for name, points in polygons.items():
    mask = Image.new('L', source.size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    layer = source.copy()
    layer.putalpha(ImageChops.multiply(mask, alpha))
    layers[name] = layer

cell_width, cell_height, columns = 400, 320, 8
atlas = Image.new('RGBA', (cell_width * columns, cell_height * 5))
frames = []
angles = [0, -16, -34, -12, 7, -12, -34, -16]
for index in range(40):
    progress = max(0, min(1, (index / 8 - 1.25) / 3.5))
    angle = angles[index % 8] if index < 24 else -12
    group = Image.new('RGBA', source.size)
    group.alpha_composite(layers['far'].rotate(-angle * .7, resample=Image.Resampling.BICUBIC, center=(850,485)))
    group.alpha_composite(layers['near'].rotate(angle, resample=Image.Resampling.BICUBIC, center=(850,485)))
    group.alpha_composite(layers['body'])
    scale = .78 * (1 - .55 * progress)
    group = group.resize((round(1672 * scale), round(941 * scale)), Image.Resampling.LANCZOS)
    x = round(640 - 835 * scale + progress * 1280 * .62)
    y = round(360 - 470 * scale - progress * 720 * .38)
    # Keep the alpha channel instead of compositing onto an opaque navy canvas.
    canvas = Image.new('RGBA', (1280,720))
    canvas.alpha_composite(group, (x,y))
    bounds = canvas.getbbox()
    if bounds is None:
        frames.append(None)
        continue
    left, top, right, bottom = bounds
    width, height = right - left, bottom - top
    assert width <= cell_width and height <= cell_height, (width, height)
    atlas_x = index % columns * cell_width
    atlas_y = index // columns * cell_height
    atlas.paste(canvas.crop(bounds), (atlas_x, atlas_y))
    frames.append({'sx': atlas_x, 'sy': atlas_y, 'x': left, 'y': top, 'width': width, 'height': height})

output = ROOT / 'public/flight'
output.mkdir(exist_ok=True)
atlas.save(output / 'approved-flight.webp', lossless=True, method=6)
metadata = {'width':1280, 'height':720, 'fps':8, 'frames':frames}
(output / 'approved-flight.json').write_text(json.dumps(metadata))
print(f"Exported {len(frames)} frames. Atlas bytes: {(output / 'approved-flight.webp').stat().st_size}")
