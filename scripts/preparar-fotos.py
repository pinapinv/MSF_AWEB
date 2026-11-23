"""Descarga fotografías reutilizables con su procedencia y licencia."""
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

FILES = {
    'filete': 'File:Pangasius meat.jpg',
    'camaron': 'File:Raw shrimp.jpg',
    'pulpo': 'File:Octopus at the Tsukiji Fish Market.jpg',
    'ostion': 'File:Raw oysters.jpg',
    'almeja': 'File:Clams, Narragansett Bay - Boston, MA.jpg',
    'pescado': 'File:Fish at the Market (Unsplash).jpg',
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'MSF-AWEB/1.0 (seafood catalog assets)'})
    return urllib.request.urlopen(req, timeout=45)

records = []
for slug, title in FILES.items():
    params = dict(action='query', format='json', titles=title, prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=900)
    data = json.load(fetch('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)))
    info = next(iter(data['query']['pages'].values()))['imageinfo'][0]
    meta = info['extmetadata']
    filename = Path('public/productos') / (slug + '.jpg')
    filename.write_bytes(fetch(info.get('thumburl', info['url'])).read())
    clean = lambda s: html.unescape(re.sub('<[^>]+>', '', s))
    records.append(dict(slug=slug, archivo='/productos/' + filename.name, titulo=title[5:], autor=clean(meta['Artist']['value']), licencia=meta['LicenseShortName']['value'], licencia_url=meta.get('LicenseUrl', {}).get('value', 'https://creativecommons.org/publicdomain/zero/1.0/'), fuente=info['descriptionurl'], cambios='Redimensionada por Wikimedia; encuadre con CSS en el catálogo.'))
    print(slug, filename.stat().st_size, records[-1]['licencia'])
Path('public/productos/creditos.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
rows = ''.join('<li><a href="' + html.escape(r['fuente']) + '">' + html.escape(r['titulo']) + '</a> — ' + html.escape(r['autor']) + ' · <a href="' + html.escape(r['licencia_url']) + '">' + html.escape(r['licencia']) + '</a><p>' + r['cambios'] + '</p></li>' for r in records)
Path('public/creditos-fotos.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Créditos de fotografías | Mariscos de San Felipe</title><style>body{font:16px/1.6 system-ui;max-width:850px;margin:40px auto;padding:20px;color:#18324d}li{margin-bottom:24px}a{color:#123b63}</style><h1>Créditos de fotografías</h1><p>Fotografías de referencia de los productos. No son fotografías tomadas en el negocio.</p><ul>' + rows + '</ul><a href="/">Volver al catálogo</a></html>', encoding='utf-8')
