from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]
required=['index.html','css/theme-tokens.css','css/app.css','css/components.css','css/motion.css','js/app.js','js/api-adapter.js','js/mock-api.js','data/tarot-deck.json','data/identities.json','contracts/api-contract.md','contracts/frontend-data-schema.json']
missing=[x for x in required if not (root/x).exists()]
if missing: raise SystemExit('Missing: '+', '.join(missing))
for p in (root/'data').glob('*.json'): json.loads(p.read_text('utf-8'))
json.loads((root/'contracts/frontend-data-schema.json').read_text('utf-8'))
html=(root/'index.html').read_text('utf-8')
for src in re.findall(r'(?:src|href)="([^"]+)"',html):
    if src.startswith(('http:','https:','#')):continue
    if not (root/src).exists(): raise SystemExit('Broken ref: '+src)
print('STATIC_CHECK_OK')
