#!/usr/bin/env python3
"""Gera a pasta www/ (o app do celular) a partir da tela do computador (desktop/index.html).
Rode de novo sempre que o desktop/index.html for atualizado."""
import os, re, shutil, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D, M, W = R + '/desktop', R + '/mobile', R + '/www'
t = open(D + '/index.html', encoding='utf8').read()
i = t.index('<script>'); j = t.rindex('</script>')
head, js, tail = t[:i], t[i + 8:j], t[j + 9:]
assert 'mirror://' in js
js = js.replace('mirror://', '/m/')
if '<meta name=viewport' not in head and '<meta name="viewport"' not in head:
    head = head.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content"><meta name="theme-color" content="#0b0c11"><link rel="manifest" href="manifest.webmanifest">', 1)
head = head.replace('</head>', '<link rel="stylesheet" href="m.css"></head>', 1) if '</head>' in head else head
head = head.replace('mirror://', '/m/')
body_js = '<script src="lib/jszip.min.js"></script><script src="m-core.js"></script><script src="m-ui.js"></script><script src="boot.js"></script>'
js = js.replace('neste computador','neste aparelho')
out = head + body_js + tail
os.makedirs(W + '/__sl', exist_ok=True)
open(W + '/index.html', 'w', encoding='utf8').write(out)
open(W + '/app.js', 'w', encoding='utf8').write(js)
for f in ['m-core.js', 'm-ui.js', 'sw.js', 'boot.js', 'm.css', 'manifest.webmanifest']:
    if os.path.exists(M + '/' + f): shutil.copy(M + '/' + f, W + '/' + f)
for f in ['patch.js', 'agent.js']: shutil.copy(D + '/' + f, W + '/__sl/' + f)
shutil.copy(D + '/icon.png', W + '/icon.png')
print('www gerado:', len(out), 'bytes html,', len(js), 'bytes js')
