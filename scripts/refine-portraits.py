"""Refine the original fictional profiles into engraved duotone plates."""
from pathlib import Path
from random import Random
import runpy,re
root=Path(__file__).resolve().parents[1]
source=runpy.run_path(str(root/'scripts'/'create-archive-assets.py'))
people=source['people']
out=root/'public'/'assets'
heads=[
'M36 102C26 79 29 55 36 40 45 23 65 18 82 24 103 19 121 39 117 63L111 103 105 77 102 51C86 55 82 41 80 37 69 54 51 59 45 66L43 108Z',
'M37 83C31 64 33 44 44 34 60 19 89 19 108 33 120 44 122 64 116 84L108 63 103 47 87 43 66 48 50 50 46 80Z',
'M28 147C36 128 23 112 30 97 20 81 26 61 39 52 36 33 51 19 67 22 78 13 93 22 101 31 120 30 133 50 126 67 141 83 131 99 125 109 135 126 131 143 116 154L106 128 110 88 101 57 81 47 53 60 47 94 57 142Z',
'M38 82C31 65 34 43 48 33 62 23 86 23 103 30 119 38 124 59 116 82L107 63 99 47 77 43 52 52 47 80Z',
'M29 120C21 92 25 52 37 37 52 18 76 19 93 26 116 27 129 50 127 76L128 120 108 135 105 85 97 53 76 50 52 67 52 132Z',
'M36 80C29 61 33 42 44 33 65 16 88 14 109 28 123 37 130 58 120 80L110 62 107 43 90 39 75 46 51 51 46 78Z',
]
wrinkles=[
 'M52 74q9-4 18-1M90 72q8-2 14 2M55 90l8 2M91 89l8-1M67 107l5 1M70 117q13 3 22-2',
 'M55 60q21-8 42-1M56 65q18-5 34-3M53 91l13 3M92 91l10-2M62 104l-3 6M100 104l-4 8M69 122l20-1',
 'M51 69q8-4 17-2M90 68l13 2M57 97l8 2M94 97l7-2M67 123q14 4 23-1',
 'M53 62q22-7 42-1M52 67l16-3M94 65l11 4M57 93l9 3M95 92l7-2M55 112l7 9M102 111l-5 9M70 130l14 4',
 'M55 66q13-7 24-4M60 95l9 2M92 93l9-3M65 108l-3 5M94 107l-2 6M70 121q10 3 17-1',
 'M53 58q24-8 45-2M53 63q25-7 46-2M53 68l16-3M92 66l13 4M54 100l11 4M96 101l10-3M62 113l-3 5M99 112l-4 6M67 128l22-2M67 135l18 3',
]
tools=[
 '<path d="M25 179h27v30H25zM31 180v-18m5 18v-22m7 22v-17M28 188h21" fill="none" stroke="var(--portrait-paper,#dce2cf)" stroke-width=".8"/>',
 '<path d="M105 176h29v22h-29zM108 181h23M112 176v-16m6 16v-18M25 161l8 47M126 160l-7 48" fill="none" stroke="var(--portrait-paper,#dce2cf)" stroke-width=".8"/>',
 '<path d="m115 171 13-5 4 25-13 5zM119 174l9-3m-8 9 9-3m-8 9 9-3M25 170l7 37" fill="none" stroke="var(--portrait-paper,#dce2cf)" stroke-width=".8"/>',
 '<circle cx="121" cy="179" r="4" fill="none" stroke="var(--portrait-paper,#dce2cf)" stroke-width="1"/><path d="M121 183v15m-3-5h7m-6 3h5M27 171l4 36" stroke="var(--portrait-paper,#dce2cf)" stroke-width=".8"/>',
 '<path d="M105 76q15-2 14 17v11q-1 14-22 14M114 96v13M94 117h7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M27 166l18 41M121 169l-9 37" stroke="var(--portrait-paper,#dce2cf)" stroke-width=".7"/>',
 '<path d="m104 174 15-4 7 25-15 3zM108 178l12-3m-10 8 12-3m-11 8 12-3M26 166l15 43M131 166l-13 42" fill="none" stroke="var(--portrait-paper,#dce2cf)" stroke-width=".8"/>',
]
common='''<linearGradient id="engraved-skin" x1="0" y1=".2" x2="1" y2=".6"><stop stop-color="#e3e8d3"/><stop offset=".4" stop-color="#ccd7bc"/><stop offset="1" stop-color="#89a07f"/></linearGradient><linearGradient id="engraved-bg" x2="1" y2="1"><stop stop-color="#526b50"/><stop offset="1" stop-color="#142f20"/></linearGradient><pattern id="fine-engraving" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M-1 4 4-1" stroke="#143222" stroke-width=".45"/></pattern>'''
extra=[]
sprite=(out/'archive.svg').read_text(encoding='utf-8')
for i,p in enumerate(people,1):
 rng=Random(660+i)
 clips=f'<clipPath id="face-plate-{i}"><path d="{p["face"]}"/></clipPath><clipPath id="hair-plate-{i}"><path d="{heads[i-1]}"/></clipPath><clipPath id="coat-plate-{i}"><path d="{p["garment"]}"/></clipPath>'
 extra.append(clips)
 hair=''.join(f'<path d="M{23+j*2.8:.1f} 118Q{18+j*3:.1f} 49 {53+j*1.3:.1f} 23"/>' for j in range(35))
 face_hatch=''.join(f'<path d="M{82+rng.random()*5:.1f} {58+j*2.4:.1f}q12-2 38-8"/>' for j in range(35))
 coat=''.join(f'<path d="M{6+j*4} 152l-13 70"/>' for j in range(39))
 body=f'''<rect width="160" height="210" fill="url(#engraved-bg)"/><path d="M-10 0h82l55 210H6Z" fill="#afbea0" opacity=".28"/><path d="M0 0h160v210H0z" fill="url(#fine-engraving)" opacity=".45"/><path d="{heads[i-1]}" fill="currentColor"/><g clip-path="url(#hair-plate-{i})" fill="none" stroke="#95ac83" stroke-width=".5" opacity=".66">{hair}</g><path d="{p['face']}" fill="url(#engraved-skin)" stroke="currentColor" stroke-width="1.1"/><g clip-path="url(#face-plate-{i})"><path d="M89 38Q72 76 86 101L72 141h67V30Z" fill="#153c26" opacity=".17"/><g fill="none" stroke="#143322" stroke-width=".4" opacity=".72">{face_hatch}</g><path d="{p['hatch']}" fill="url(#fine-engraving)" opacity=".65"/></g><path d="{p['garment']}" fill="currentColor"/><g clip-path="url(#coat-plate-{i})" fill="none" stroke="#78946c" stroke-width=".4" opacity=".55">{coat}</g><path d="{p['collar']}" fill="none" stroke="#c2d0b0" stroke-width="1"/><path d="{p['features']}" fill="none" stroke="#163323" stroke-width="1.1" stroke-linecap="round"/><path d="{wrinkles[i-1]}" fill="none" stroke="#294b31" stroke-width=".55" stroke-linecap="round"/>{tools[i-1]}<path d="M8 8h144v194H8z" fill="none" stroke="#b7c9a7" stroke-width=".7" opacity=".7"/><path d="M12 12h136v186H12z" fill="none" stroke="#183925" stroke-width=".4"/><path d="M8 15h8M12 10v10M144 194h8M148 190v8" stroke="#c3cfb1" stroke-width=".6"/>'''
 sprite=re.sub(fr'<symbol id="portrait-{i}"[\s\S]*?</symbol>',f'<symbol id="portrait-{i}" viewBox="0 0 160 210">{body}</symbol>',sprite)
 (out/f'portrait-{i}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 210" style="color:#183a26"><defs>{common}{clips}</defs>{body}</svg>',encoding='utf-8')
sprite=sprite.replace('</defs>',common+''.join(extra)+'</defs>',1)
(out/'archive.svg').write_text(sprite,encoding='utf-8')
print('Refined six fictional portraits: side light, engraved skin/hair, age and professional details')
