#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""style.css를 모든 HTML 파일에 인라인으로 동기화.
디자인(style.css)을 수정한 뒤 이 스크립트를 실행하면
index.html과 모든 상세 페이지에 일괄 반영됩니다.
  실행: python3 apply_css.py
"""
import re, glob

with open('style.css', encoding='utf-8') as f:
    css = f.read()

style_block = '  <style>\n' + css + '\n  </style>'

paths = ['index.html', 'gallery.html', 'contact.html', 'privacy.html'] + sorted(glob.glob('products/*.html'))
for path in paths:
    import os
    if not os.path.exists(path):
        continue
    with open(path, encoding='utf-8') as f:
        h = f.read()
    if '<style>' in h and '</style>' in h:
        h = re.sub(r' *<style>.*?</style>', style_block, h, count=1, flags=re.DOTALL)
    elif 'href="style.css"' in h:
        h = h.replace('  <link rel="stylesheet" href="style.css" />', style_block)
    elif 'href="../style.css"' in h:
        h = h.replace('  <link rel="stylesheet" href="../style.css" />', style_block)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(h)
    print(f'{path} — CSS 동기화 완료')

print(f'\n총 {len(paths)}개 파일에 디자인 적용 완료')
