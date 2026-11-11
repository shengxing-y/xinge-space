"""把心歌随录的公开内容导出成纯静态网站（site/ 目录），可托管到任意静态托管。

用法：
    python export_static.py

导出内容：工作札记、画画手册、生活碎片（私人日记绝不导出）。
产物：site/index.html（单文件，样式脚本数据全内嵌）+ site/images/（画作图片）。
预览：直接双击 site/index.html 即可在浏览器查看。
部署：把 site 目录整体上传到 Cloudflare Pages / GitHub Pages / 任意静态托管。
"""
import base64
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'data' / 'journal.sqlite3'
SITE = ROOT / 'site'
IMG_DIR = SITE / 'images'
AUD_DIR = SITE / 'audio'
EXT = {'data:image/png;base64': 'png', 'data:image/jpeg;base64': 'jpg',
       'data:image/webp;base64': 'webp', 'data:image/gif;base64': 'gif'}
AEXT = {'mpeg': 'mp3', 'mp3': 'mp3', 'wav': 'wav', 'x-wav': 'wav', 'wave': 'wav',
        'ogg': 'ogg', 'flac': 'flac', 'mp4': 'm4a', 'x-m4a': 'm4a', 'aac': 'aac'}

TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>心歌随录 · 所思有所存</title>
<meta name="description" content="心歌的公开手迹：工作札记、画画手册、生活碎片与音乐手帖">
<link rel="icon" href="data:image/svg+xml,%%FAVICON%%">
<style>%%CSS%%</style></head>
<body>
<header><a class="brand" href="#home"><span class="seal">心<br>歌</span><span>心歌随录<small>XINGE'S JOURNAL</small></span></a><nav aria-label="栏目导航"><a href="#home">序 · 首页</a><a href="#work">工作札记</a><a href="#art">画画手册</a><a href="#life">生活碎片</a><a href="#music">音乐手帖</a></nav></header>
<main>
<section class="intro" id="intro"><div><p class="eyebrow">一隅自留地 / 公开手迹</p><h1>心有所感，<br>随笔成歌<span>。</span></h1><p id="bio"></p><div class="intro-links"><a id="bilibili" target="_blank" rel="noopener noreferrer" hidden>我的 B 站主页</a></div></div><aside class="verse"><span class="vertical">所作有所记<br>所见有所绘<br>所思有所存<br>声有所寄</span><span class="verse-seal">随录</span><p>不疾不徐 · 日日有记</p></aside></section>
<section class="echo" id="echo" hidden><span class="echo-seal">回声</span><div class="echo-main"><p class="echo-kicker" id="echo-kicker"></p><button class="echo-entry" id="echo-entry" hidden></button><p class="echo-null" id="echo-null" hidden></p></div></section>
<section class="collection"><div class="section-heading"><div><p class="eyebrow" id="section-kicker">RECENT PAGES / 近来</p><h2 id="section-title">最近留下的几页</h2></div><span id="count"></span></div><a id="channel-link" class="channel-link" hidden target="_blank" rel="noopener"><span class="cl-seal" id="cl-seal"></span><span class="cl-text"><strong id="cl-name"></strong><em id="cl-hint"></em></span></a><div class="tools"><div id="filters" class="filters"><button data-filter="all" class="active">全部</button><button data-filter="work">工作</button><button data-filter="art">画画</button><button data-filter="life">生活</button><button data-filter="music">音乐</button></div><div class="search-tools"><label class="sr-only" for="month">按月份筛选</label><input type="month" id="month" title="按月份筛选"><label class="search">⌕ <input id="search" placeholder="寻一段文字…" aria-label="搜索标题、正文与标签"></label></div></div><div id="entries" class="entries" aria-live="polite"></div></section>
<div class="heat"><div class="heat-head"><div><p class="eyebrow">A YEAR OF MAKING / 岁时记</p><span class="heat-stats" id="heat-stats"></span></div><span class="hm-legend">少<i class="hm-cell hm-0"></i><i class="hm-cell hm-1"></i><i class="hm-cell hm-2"></i><i class="hm-cell hm-3"></i>多</span></div><div class="heatmap" id="heatmap" role="img" aria-label="近一年创作热力图"></div></div>
<footer><div><strong>心歌随录</strong><span>片言记岁时。</span></div><small>心歌的公开手迹 · 本地仍在私人随录中继续书写</small></footer>
</main>
<dialog id="reader"><div class="dialog-top"><p class="eyebrow" id="reader-meta"></p><button class="close" data-close="reader" aria-label="关闭">×</button></div><h2 id="reader-title"></h2><img id="reader-image" class="reader-image" alt="记录附图" hidden><div id="reader-body" class="prose"></div><p id="reader-tags" class="tags"></p></dialog>
<div id="lightbox" role="dialog" aria-modal="true" aria-label="作品浏览" hidden><button class="close lb-close" data-lb="close" aria-label="关闭">×</button><button class="lb-nav lb-prev" data-lb="prev" aria-label="上一幅">‹</button><button class="lb-nav lb-next" data-lb="next" aria-label="下一幅">›</button><figure><img id="lb-image" alt="作品大图"><figcaption><p class="lb-meta" id="lb-meta"></p><h3 id="lb-title"></h3><p class="lb-tags" id="lb-tags"></p></figcaption></figure><span id="lb-count"></span></div>
<div id="hm-tip" hidden></div>
<div id="player" class="player" hidden><span class="player-seal">♪</span><span id="player-title"></span><audio id="player-audio" controls></audio><button id="player-close" aria-label="关闭播放器">×</button></div>
<script>window.__DATA__=%%DATA%%;</script>
<script>%%SKY%%</script>
<script>%%JS%%</script>
</body></html>
"""

FAVICON_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
               '<rect x="2" y="2" width="36" height="36" rx="4" fill="#a8402c"/>'
               '<text x="20" y="28" text-anchor="middle" font-size="25" fill="#f8efdd" font-family="serif">心</text></svg>')


def main():
    if not DB.exists():
        sys.exit('找不到数据库 data/journal.sqlite3，请先运行过 server.py 一次。')
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    entries = [dict(r) for r in con.execute(
        "SELECT * FROM entries WHERE category != 'diary' ORDER BY day DESC, rowid DESC")]
    settings = {r['key']: r['value'] for r in con.execute('SELECT * FROM settings')}
    con.close()

    SITE.mkdir(exist_ok=True)
    IMG_DIR.mkdir(exist_ok=True)
    AUD_DIR.mkdir(exist_ok=True)
    # 清掉旧图片与音频，避免已删除的内容残留
    for old in IMG_DIR.iterdir():
        old.unlink()
    for old in AUD_DIR.iterdir():
        old.unlink()

    n_img = 0
    n_aud = 0
    for e in entries:
        if e['image']:
            prefix, payload = e['image'].split(',', 1)
            ext = EXT.get(prefix, 'png')
            (IMG_DIR / f"{e['id']}.{ext}").write_bytes(base64.b64decode(payload))
            e['image'] = f"images/{e['id']}.{ext}"
            n_img += 1
        if e['audio'] and e['audio'].startswith('data:'):
            prefix, payload = e['audio'].split(',', 1)
            sub = prefix.removeprefix('data:audio/').removesuffix(';base64')
            ext = AEXT.get(sub, 'mp3')
            (AUD_DIR / f"{e['id']}.{ext}").write_bytes(base64.b64decode(payload))
            e['audio'] = f"audio/{e['id']}.{ext}"
            n_aud += 1

    data = {'entries': entries,
            'settings': {'bio': settings.get('bio', ''), 'bilibili': settings.get('bilibili', ''),
                         'xiaohongshu': settings.get('xiaohongshu', ''), 'netease': settings.get('netease', '')}}
    html = (TEMPLATE
            .replace('%%FAVICON%%', quote(FAVICON_SVG))
            .replace('%%CSS%%', (ROOT / 'style.css').read_text(encoding='utf-8'))
            .replace('%%JS%%', (ROOT / 'static_app.js').read_text(encoding='utf-8'))
            .replace('%%SKY%%', (ROOT / 'sky.js').read_text(encoding='utf-8'))
            .replace('%%DATA%%', json.dumps(data, ensure_ascii=False)))
    (SITE / 'index.html').write_text(html, encoding='utf-8')

    print(f'已导出 site/：{len(entries)} 页随录，{n_img} 张图片，{n_aud} 段音频（私人日记未导出）')
    print('预览：双击 site/index.html')
    print('部署：把 site 目录整体上传到 Cloudflare Pages 等静态托管')


if __name__ == '__main__':
    main()
