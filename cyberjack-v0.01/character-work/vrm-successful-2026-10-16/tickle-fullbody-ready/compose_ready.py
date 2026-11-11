"""Компоновка трёх видов готовой Mira и H.264-видео."""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE / 'preview/demo_frames'
OUT = HERE / 'preview/_composed'
OUT.mkdir(parents=True, exist_ok=True)
states = json.loads((HERE / 'reports/demo_session.json').read_text(encoding='utf-8'))
font_path = '/usr/share/fonts/noto/NotoSans-Regular.ttf'
font = ImageFont.truetype(font_path, 18) if Path(font_path).exists() else ImageFont.load_default()
small = ImageFont.truetype(font_path, 15) if Path(font_path).exists() else ImageFont.load_default()
large = ImageFont.truetype(font_path, 22) if Path(font_path).exists() else ImageFont.load_default()


def panel(name, frame, size):
    image = Image.open(ROOT / name / f'{frame:04d}.png').convert('RGB')
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)


for st in states:
    frame = st['frame']
    image = Image.new('RGB', (1080, 720), '#14161c')
    draw = ImageDraw.Draw(image)
    zone = st.get('family') and next((z for z in ['arch_medial', 'arch_lateral', 'toe_pad_1', 'toe_pad_2_5', 'ankle_ring', 'instep', 'intertoe', 'heel', 'ball'] if st.get('clip', '').startswith(z)), '—') or 'отпущено'
    draw.text((18, 10), f"Готовая Mira · полный риг · {st['t']:04.1f} с · {zone} · {st.get('character', 'rest')}", fill='#f2e9e4', font=large)
    image.paste(panel('full', frame, (540, 560)), (0, 48))
    image.paste(panel('face', frame, (540, 280)), (540, 48))
    image.paste(panel('sole', frame, (540, 280)), (540, 328))
    draw.text((14, 52), 'Тело', fill='#ffffff', font=small)
    draw.text((554, 52), 'Мимика', fill='#ffffff', font=small)
    draw.text((554, 332), 'Подошва и инструмент', fill='#ffffff', font=small)
    draw.rectangle((0, 608, 1080, 720), fill='#101218')
    draw.text((16, 618), f"Стимул {st['stimulus']:.2f}   Привыкание {st['adaptation']:.2f}   Усталость {st['load']:.2f}", fill='#f2e9e4', font=font)
    draw.text((16, 646), f"Тело {st['body']:.2f}  Мимика {st['face']:.2f}  Дыхание {st['breath']:.2f}  Рот {st['mouth']:.2f}", fill='#d5dde8', font=font)
    on = st.get('onsets_ms', {})
    draw.text((16, 675), f"Задержки: стопа {on.get('local', 0):.0f} · корпус {on.get('body', 0):.0f} · лицо {on.get('face', 0):.0f} · голос {on.get('voice', 0):.0f} мс", fill='#aab8c8', font=small)
    image.save(OUT / f'{frame:04d}.png')
subprocess.run(['ffmpeg', '-y', '-framerate', '15', '-i', str(OUT / '%04d.png'),
                '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart', str(HERE / 'preview/tickle_ready_demo.mp4')], check=True)
print('READY_COMPOSED', len(states))
