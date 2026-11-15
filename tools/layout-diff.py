#!/usr/bin/env python3
"""Compara duas pastas de capturas de layout (original × novo): pixels diferentes e medidas das regiões.
Uso: python3 tools/layout-diff.py docs/recortestudio/baseline/original docs/recortestudio/baseline/novo [saida.md]
Só lê imagens e JSON gerados por nós (python -I não é necessário: nenhum dado externo é executado)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageChops

a, b = Path(sys.argv[1]), Path(sys.argv[2])
out = Path(sys.argv[3]) if len(sys.argv) > 3 else None
ma = json.loads((a / 'metrics.json').read_text())
mb = json.loads((b / 'metrics.json').read_text())
lines = ['| Tela | Pixels diferentes | Maior região alterada (x, y, l×a) | Medidas das regiões |', '|---|---|---|---|']
worst = 0.0
for p in sorted(a.glob('*.png')):
    q = b / p.name
    if not q.exists():
        lines.append(f'| {p.stem} | ausente no novo | | |'); continue
    ia, ib = Image.open(p).convert('RGB'), Image.open(q).convert('RGB')
    if ia.size != ib.size:
        lines.append(f'| {p.stem} | tamanhos diferentes {ia.size} × {ib.size} | | |'); continue
    diff = ImageChops.difference(ia, ib).convert('L').point(lambda v: 255 if v > 24 else 0)
    n = diff.histogram()[255]
    pct = 100 * n / (ia.size[0] * ia.size[1])
    worst = max(worst, pct)
    bbox = diff.getbbox()
    box = f'{bbox[0]}, {bbox[1]}, {bbox[2]-bbox[0]}×{bbox[3]-bbox[1]}' if bbox else '—'
    regs = []
    for k, va in (ma.get(p.stem) or {}).items():
        vb = (mb.get(p.stem) or {}).get(k)
        if va is None and vb is None: continue
        if va != vb: regs.append(f'{k}: {va} → {vb}')
    lines.append(f'| {p.stem} | {n} ({pct:.3f}%) | {box} | {"; ".join(regs) if regs else "idênticas"} |')
text = '\n'.join(lines) + f'\n\nMaior diferença: {worst:.3f}% dos pixels.\n'
print(text)
if out: out.write_text(text)
