"""Original editable SVG drawings for stage 0.5. No external images."""
from pathlib import Path
import random
root=Path(__file__).resolve().parents[1]
asset_dir=root/'public'/'assets'
asset_dir.mkdir(parents=True,exist_ok=True)
random.seed(503)
noise_css = 'rect{width:1px;height:1px}.t{height:2px}.a{opacity:.25}.b{opacity:.4}.c{opacity:.6}'
def grain_mark():
 x, y = random.randrange(96), random.randrange(96)
 tall = random.choice([1,1,2]) == 2
 tone = random.choice(['a','b','c'])
 classes = tone + (' t' if tall else '')
 return f'<rect x="{x}" y="{y}" class="{classes}"/>'
noise=''.join(grain_mark() for _ in range(175))
(asset_dir/'grain.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><style>{noise_css}</style><g fill="currentColor">{noise}</g></svg>',encoding='utf-8')
parts=[]
mask_holes=''.join(f'<circle cx="{random.randrange(6,394)}" cy="{random.randrange(6,94)}" r="{random.choice([.4,.7,1])}" fill="black"/>' for _ in range(150))
defs=f'''<defs><pattern id="cloth" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 5 5M0 5 5 0" stroke="currentColor" stroke-width=".4" opacity=".25"/></pattern><mask id="ink-print"><rect width="400" height="100" fill="white"/>{mask_holes}<path d="M5 8 130 7M295 92l91-1M6 50l1 17" stroke="black" stroke-width=".8"/></mask><radialGradient id="desk-glow"><stop stop-color="var(--lamp,#b8ccd0)" stop-opacity=".22"/><stop offset="1" stop-color="var(--lamp,#b8ccd0)" stop-opacity="0"/></radialGradient><linearGradient id="lamp-metal" x2="1" y2="1"><stop stop-color="var(--metal,#b5bebf)"/><stop offset=".4" stop-color="var(--metal-dark,#53616a)"/><stop offset=".7" stop-color="var(--metal,#b5bebf)"/><stop offset="1" stop-color="var(--metal-dark,#53616a)"/></linearGradient></defs>'''
parts.extend([
 '<symbol id="desk" viewBox="0 0 1200 800"><ellipse cx="790" cy="310" rx="590" ry="420" fill="url(#desk-glow)"/><path d="M0 675 1200 410M0 720l1200-267M0 780l1200-264M280 800l920-200" fill="none" stroke="var(--scene-horizon,#52616b)" stroke-width="1" opacity=".18"/><path d="M940 0 610 800H1200V0Z" fill="var(--desk-shadow,#0005)" opacity=".5"/><ellipse cx="810" cy="646" rx="350" ry="90" fill="var(--desk-shadow,#0005)"/></symbol>',
 '<symbol id="lamp" viewBox="0 0 300 420"><ellipse cx="174" cy="393" rx="89" ry="13" fill="var(--metal-dark,#53616a)"/><path d="M102 390q12-25 72-25t73 25Z" fill="url(#lamp-metal)"/><path d="M171 371V203l-68-70" fill="none" stroke="var(--metal-dark,#53616a)" stroke-width="15"/><path d="M168 371V205l-68-72" fill="none" stroke="url(#lamp-metal)" stroke-width="7"/><circle cx="168" cy="207" r="11" fill="url(#lamp-metal)"/><path d="M32 107 84 42q13-17 41-9l94 30 26 85-76 28Z" fill="var(--shade,#303b43)" stroke="var(--metal-dark,#53616a)" stroke-width="2"/><path d="M32 107q94-8 213 41-29 53-124 23T32 107" fill="var(--metal-dark,#53616a)"/><ellipse cx="139" cy="141" rx="107" ry="22" transform="rotate(14 139 141)" fill="var(--lamp,#b8ccd0)" opacity=".7"/><path d="M96 41q52 7 117 34" fill="none" stroke="var(--metal,#b5bebf)" opacity=".3" stroke-width="2"/></symbol>',
 '<symbol id="folder" viewBox="0 0 700 500"><path d="M2 55V16Q2 4 15 4h217l31 42h418q17 0 17 18v418q0 16-16 16H17Q2 498 2 482Z" fill="var(--folder,#39434a)" stroke="var(--folder-edge,#657079)" stroke-width="2"/><path d="M3 57h694M18 482h665M14 67v405" stroke="var(--folder-edge,#657079)" fill="none"/><path d="M2 60h696v438H2Z" fill="url(#cloth)"/><circle cx="28" cy="87" r="4" fill="var(--metal,#b5bebf)"/><circle cx="28" cy="452" r="4" fill="var(--metal,#b5bebf)"/></symbol>',
 '<symbol id="form" viewBox="0 0 500 650"><path d="M1 1h498v648H1Z" fill="var(--paper,#e5e8e6)" stroke="var(--paper-line,#adb6b4)"/><path d="M30 39h440M30 87h440M30 180h440M30 245h440M30 310h440M30 375h440M30 440h440M30 505h440M30 570h440M340 180v390" fill="none" stroke="var(--paper-line,#adb6b4)" stroke-width="1"/><path d="M30 32h170M30 236h85M30 301h130M30 366h96M30 431h150" stroke="var(--ink-muted,#505d61)" stroke-width="3" opacity=".45"/><path d="M29 610h43m4 0h2m3 0h7m4 0h3m4 0h18m5 0h2m4 0h7m4 0h2" stroke="var(--ink,#20282b)" stroke-width="22" opacity=".5"/></symbol>',
 '<symbol id="clip" viewBox="0 0 40 150"><path d="M7 108V22C7 1 34 1 34 22v102c0 30-29 30-29 0V29c0-16 17-16 17 0v87" fill="none" stroke="var(--metal-dark,#53616a)" stroke-width="5"/><path d="M9 106V22C9 3 33 3 33 22v102c0 27-26 27-26 0V29c0-13 15-13 15 0v87" fill="none" stroke="var(--metal,#b5bebf)" stroke-width="2.2"/></symbol>',
 '<symbol id="stamp-frame" viewBox="0 0 400 100"><g fill="none" stroke="currentColor" mask="url(#ink-print)"><path d="M3 5 397 3v92L4 98Z" stroke-width="3"/><path d="M10 12 390 10v78L11 90Z" stroke-width="1"/><path d="m23 52 11 12 23-28" stroke-width="3"/></g></symbol>',
 '<symbol id="stamp-violation" viewBox="0 0 400 100"><g fill="none" stroke="currentColor" mask="url(#ink-print)"><path d="M3 5h394v90H3zM10 12h380v76H10z" stroke-width="2"/><path d="M30 27v30m0 13v4" stroke-width="4"/></g></symbol>',
 '<symbol id="stamp-clear" viewBox="0 0 400 100"><g fill="none" stroke="currentColor" mask="url(#ink-print)"><path d="M3 5h394v90H3zM10 12h380v76H10z" stroke-width="2"/><path d="m21 50 12 13 23-29" stroke-width="3"/></g></symbol>',
])
icons={
 'history':'M12 12h56v56H12z M24 12v56 M25 26h31 M25 39h23 M25 52h18 M62 7v10 M10 57h7 M68 58h7',
 'map':'M9 21 29 13 51 21 71 13v46L51 67 29 59 9 67Z M29 13v46 M51 21v46 M17 35l6-3 M36 43l9 4 M58 30l7-2 M39 32a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M39 32v6',
 'cards':'M13 21h53v45H13z M20 13h50v45 M26 6h48v45 M20 31h16v22H20z M43 33h16 M43 42h16 M43 51h10 M20 60h39',
 'ledger':'M11 10h58v60H11z M11 25h58 M30 25v45 M52 25v45 M11 40h58 M11 55h58 M20 17h30 M59 17h3',
 'final':'M18 7h33l14 15v51H18z M51 7v16h14 M29 32h25 M29 42h21 M29 52h12 M46 60l6 6 15-18 M25 73v4h44V33',
}
for name,path in icons.items():parts.append(f'<symbol id="level-{name}" viewBox="0 0 80 80"><path d="{path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"/></symbol>')
(asset_dir/'archive.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg">'+defs+''.join(parts)+'</svg>',encoding='utf-8')
print(f'Created SVG sprite: {len(parts)} symbols, decorative archive symbols and grain tile')
