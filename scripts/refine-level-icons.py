"""Original engraved level illustrations, on the same plate as the portrait set."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
p=root/'public'/'assets'/'archive.svg'
s=p.read_text(encoding='utf-8')
defs='<pattern id="icon-engraving" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M-1 4 4-1" stroke="currentColor" stroke-width=".45"/></pattern>'
s=s.replace('</defs>',defs+'</defs>',1)
icons={
'history':'''<path d="M9 18q16-10 31 0 16-10 31 0v47q-17-6-31 1-17-7-31-1Z" fill="url(#icon-engraving)" opacity=".2"/><path d="M7 19q17-10 33 0 17-10 33 0v45q-17-7-33 1-17-8-33-1Z M40 19v46M11 23v36q13-5 25 0M44 59q12-5 25 0V23M11 27q12-6 24 0M11 34q12-6 24 0M11 41q12-6 24 0M11 48q12-6 24 0M45 27q11-6 23 0M45 34q11-6 23 0M45 41q11-6 23 0M45 48q11-6 23 0M5 23v46q18-7 35 1 17-8 35-1V23"/><path d="M37 16q3-3 6 0M14 21l-2 38M66 21l2 38" stroke-width=".6"/>''',
'map':'''<path d="M8 20 29 12 51 19 72 11v47l-21 9-22-8-21 8Z" fill="url(#icon-engraving)" opacity=".2"/><path d="M8 20 29 12 51 19 72 11v47l-21 9-22-8-21 8ZM29 12v47M51 19v48M13 31q12-9 24 0t29-2M14 38q12-9 24 0t28-2M13 45q12-9 24 0t30-2M15 52q9-6 20 0M55 52l11-4M11 23v37M69 17v36"/><path d="M40 24a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM40 36v8M37 44h6"/>''',
'cards':'''<path d="m17 12 52-6 5 49M12 18l52-5 5 46M7 26h57v43H7Z"/><path d="M11 30h20v28H11z" fill="url(#icon-engraving)" opacity=".25"/><path d="M11 30h20v28H11ZM36 32h22M36 39h22M36 46h17M36 53h21M12 63h46M34 30v28"/><path d="M15 45q1-8 6-8t6 8l-2 7h-8ZM12 57q2-7 9-7t9 7M17 35q5-4 9 1M11 66h47M70 12l3 39" stroke-width=".7"/>''',
'ledger':'''<path d="M12 8h48l11 12v51H12ZM60 8v14h11M18 28h46M18 40h46M18 52h46M18 64h46M32 28v36M50 28v36M18 15h27M18 20h20"/><path d="M14 10v59h54M56 63l2 3 17-37-4-2Z"/><path d="m60 58 3 1M19 34h8M37 34h8M54 34h7M19 46h8M37 46h8M54 46h6M19 58h8M37 58h8" stroke-width=".7"/>''',
'final':'''<path d="M14 8h37l13 14v43H14ZM51 8v15h13M20 30h35M20 39h31M20 48h21M20 56h16M11 13v56h34"/><path d="M16 10h32M17 65h23M18 33h31M18 42h24" stroke-width=".6"/><path d="M53 45a13 13 0 1 0 0 26 13 13 0 0 0 0-26ZM53 48a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-6 10 4 4 9-10M45 69l-2 9 10-5 9 5-2-9"/><path d="m42 49 3 2m19-2-3 2m-19 13 3-1m19 1-3-1M51 45v3M53 68v3" stroke-width=".65"/>''',
}
for name,body in icons.items():
 symbol=f'<symbol id="level-{name}" viewBox="0 0 80 80"><g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">{body}</g></symbol>'
 s=re.sub(fr'<symbol id="level-{name}"[\s\S]*?</symbol>',symbol,s)
p.write_text(s,encoding='utf-8')
print('Engraved five original level illustrations')
