"""Crop, duotone and compress genuine GPT Image outputs; never synthesizes faces.
Install Pillow 13 into work/python-libs (or use a local environment with Pillow).
Input: work/portraits/{prompts,generation,selection}.json and original PNGs.
"""
from pathlib import Path
import sys, json, io, hashlib
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root/'work/python-libs'))
from PIL import Image, ImageOps, ImageDraw, ImageFont
work = root/'work/portraits'
output = root/'public/assets/portraits'
screens = root/'docs/screens/etap0_6_1'
output.mkdir(parents=True, exist_ok=True)
screens.mkdir(parents=True, exist_ok=True)
profiles = [
 ('vera', 'Вера Соколова', 'Специалист по снабжению'),
 ('mark', 'Марк Лебедев', 'Оператор оборудования'),
 ('alina', 'Алина Белова', 'Техник производства'),
 ('roman', 'Роман Мельников', 'Кладовщик'),
 ('nina', 'Нина Орлова', 'Диспетчер'),
 ('operator', 'Второй оператор', 'Профиль фотокаталога'),
]
files = json.loads((work/'generation.json').read_text(encoding='utf-8'))
selection = json.loads((work/'selection.json').read_text(encoding='utf-8'))
prompts = json.loads((work/'prompts.json').read_text(encoding='utf-8'))
def frame(id, size):
    image = Image.open(root/files[id]).convert('RGB')
    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(.5,.45))
    # Identical deterministic tone curve for all variants; no anatomical retouching.
    gray = ImageOps.autocontrast(ImageOps.grayscale(image), cutoff=.5)
    return ImageOps.colorize(gray, '#102d21', '#e6e7d8')
font = ImageFont.truetype(str(root/'public/fonts/sans-cyrillic.woff2'), 19)
small = ImageFont.truetype(str(root/'public/fonts/sans-cyrillic.woff2'), 15)
records = []
for i,(id,name,role) in enumerate(profiles,1):
    selected = selection[id]
    source = id+'-'+selected
    picture = frame(source,(320,400))
    for quality in range(92,49,-1):
        buffer = io.BytesIO()
        picture.save(buffer, 'WEBP', quality=quality, method=6)
        data = buffer.getvalue()
        if len(data) <= 30000: break
    if len(data)>30000: raise RuntimeError(source+' exceeds 30000 bytes')
    file = output/f'portrait-{i}.webp'
    file.write_bytes(data)
    records.append(dict(index=i,profile=id,name=name,role=role,selected=selected,file=file.relative_to(root).as_posix(),bytes=len(data),width=320,height=400,quality=quality,sha256=hashlib.sha256(data).hexdigest(),prompt=prompts['base']+prompts['subjects'][source]))
# Contact sheets show exactly the same postprocessing, labels outside portrait images.
for candidates in [True, False]:
    cellw,cellh,pad = 260,390,24
    rows=2 if candidates else 1
    sheet=Image.new('RGB',(pad+6*cellw,pad+rows*cellh),(8,21,17))
    draw=ImageDraw.Draw(sheet)
    for col,(id,name,role) in enumerate(profiles):
        for row in range(rows):
            variant=['a','b'][row] if candidates else selection[id]
            x,y=pad+col*cellw,pad+row*cellh
            pic=frame(id+'-'+variant,(240,300)) if candidates else Image.open(output/f'portrait-{col+1}.webp').resize((240,300),Image.Resampling.LANCZOS)
            sheet.paste(pic,(x,y))
            selected=variant==selection[id]
            if candidates and selected: draw.rectangle((x-2,y-2,x+241,y+301),outline='#b6c9a4',width=2)
            draw.text((x,y+310),name,fill='#e6e7d8',font=font)
            label=('Вариант '+('А' if variant=='a' else 'Б')+(' выбран' if selected else '')) if candidates else role
            draw.text((x,y+339),label,fill='#b6c9a4',font=small)
    sheet.save(screens/('candidates.png' if candidates else 'portraits.png'),optimize=True)
report = dict(date=prompts['date'],model=prompts['model'],mode='built-in image_gen',processing='Pillow 13.0.0; ImageOps.fit LANCZOS 320x400 centering 0.5/0.45; grayscale autocontrast cutoff 0.5; colorize #102d21/#e6e7d8; WebP method 6, maximum quality 92 constrained to 30000 bytes',portraits=records)
(root/'docs/verification/etap0_6_1/portraits.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('\n'.join(f"{r['file']}: {r['bytes']} bytes, quality {r['quality']}, 320x400" for r in records))
