"""A personal journal, using Python's standard library.

默认监听 0.0.0.0：本机浏览器开 127.0.0.1:18271，手机连同一 WiFi 开 电脑IP:18271。
日记无加密，请勿在不可信的网络环境开放；想仅限本机，设环境变量 JOURNAL_BIND=127.0.0.1。
"""
import base64
import json
import os
import secrets
import socket
import sqlite3
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
DB = DATA / 'journal.sqlite3'
TOKEN = secrets.token_urlsafe(32)
PORT = 18271
BIND = os.environ.get('JOURNAL_BIND', '0.0.0.0')

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('192.0.2.1', 80))
        return s.getsockname()[0]
    except OSError:
        return ''
    finally:
        s.close()

class Connection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()

def connect():
    con = sqlite3.connect(DB, factory=Connection)
    con.row_factory = sqlite3.Row
    return con

with connect() as con:
    con.execute('CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, category TEXT, title TEXT, day TEXT, body TEXT, tags TEXT, image TEXT, medium TEXT DEFAULT \'\', size TEXT DEFAULT \'\', audio TEXT DEFAULT \'\')')
    # 旧库自动迁移：补 medium / size / audio 三列
    _cols = {r['name'] for r in con.execute('PRAGMA table_info(entries)')}
    for _col in ['medium', 'size', 'audio']:
        if _col not in _cols:
            con.execute(f"ALTER TABLE entries ADD COLUMN {_col} TEXT DEFAULT ''")
    con.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)')
    if not con.execute("SELECT 1 FROM settings WHERE key='initialized'").fetchone():
        for category, title, body, tags in [
            ('work', '把每一次小进步，写下来', '这是一篇示例记录。\n\n可以记录今天完成的事情、遇见的问题，以及下一步的打算。点右上角编辑，换成自己的第一篇工作札记。', '示例,工作札记'),
            ('life', '寻常日子，也值得收藏', '这是一篇示例记录。\n\n一顿好吃的饭，一本读到一半的书，或一场让人停下脚步的晚霞。生活不必隆重，值得记住就好。', '示例,生活碎片')]:
            con.execute('INSERT INTO entries (id,category,title,day,body,tags,image) VALUES (?,?,?,?,?,?,?)', (secrets.token_hex(12), category, title, date.today().isoformat(), body, tags, ''))
        con.execute("INSERT INTO settings VALUES ('initialized','yes')")
        con.execute("INSERT INTO settings VALUES ('bio','做一点事，画一点画，记下自己的日子。')")
        con.execute("INSERT INTO settings VALUES ('bilibili','')")

def validate_entry(obj):
    if not isinstance(obj, dict):
        raise ValueError('记录格式不正确')
    result = {}
    for key, limit in [('category',20),('title',120),('day',10),('body',100000),('tags',500),('image',12000000),('medium',20),('size',30),('audio',16000000)]:
        value = obj.get(key, '')
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError('内容过长或格式不正确')
        result[key] = value
    if result['category'] not in ['work','art','life','music','diary'] or not result['title'].strip():
        raise ValueError('请选择分类并填写标题')
    date.fromisoformat(result['day'])
    if result['image']:
        prefix, payload = result['image'].split(',', 1)
        if prefix not in ['data:image/png;base64','data:image/jpeg;base64','data:image/webp;base64','data:image/gif;base64']:
            raise ValueError('仅支持 PNG、JPG、WebP、GIF 图片')
        raw = base64.b64decode(payload, validate=True)
        if len(raw) > 8 * 1024 * 1024:
            raise ValueError('图片不能超过 8 MB')
        valid = ((prefix.startswith('data:image/png;') and raw.startswith(b'\x89PNG\r\n\x1a\n')) or
                 (prefix.startswith('data:image/jpeg;') and raw.startswith(b'\xff\xd8\xff')) or
                 (prefix.startswith('data:image/gif;') and raw.startswith((b'GIF87a', b'GIF89a'))) or
                 (prefix.startswith('data:image/webp;') and raw.startswith(b'RIFF') and raw[8:12] == b'WEBP'))
        if not valid:
            raise ValueError('图片格式不支持')
    if result['audio'] and result['audio'] != '@keep':
        if len(result['audio']) > 16000000:
            raise ValueError('音频不能超过 12 MB')
        try:
            prefix, payload = result['audio'].split(',', 1)
            raw = base64.b64decode(payload[:64] + '==', validate=False)
        except Exception:
            raise ValueError('音频数据不正确')
        ok = (raw.startswith(b'ID3') or                       # MP3 (带标签)
              raw.startswith(b'RIFF') or                     # WAV
              raw.startswith(b'OggS') or                     # OGG
              raw.startswith(b'fLaC') or                     # FLAC
              b'ftyp' in raw[4:16] or                        # M4A/AAC
              (len(raw) > 1 and raw[0] == 0xFF and (raw[1] & 0xE0) == 0xE0))  # MP3 帧同步
        if not ok:
            raise ValueError('音频格式不支持（MP3 / WAV / OGG / FLAC / M4A）')
    result['id'] = obj.get('id') or secrets.token_hex(12)
    if not isinstance(result['id'], str) or len(result['id']) > 64:
        raise ValueError('记录编号不正确')
    return result

class Handler(BaseHTTPRequestHandler):
    def reply(self, code, data, kind='application/json; charset=utf-8'):
        raw = json.dumps(data, ensure_ascii=False).encode() if kind.startswith('application/json') else data
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; media-src 'self' data: blob:; style-src 'self' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(raw)

    def host_ok(self):
        # 校验 Host 端口即可：允许本机与局域网设备访问，跨端口请求被拒
        return self.headers.get('Host', '').rsplit(':', 1)[-1] == str(PORT)

    def do_GET(self):
        if not self.host_ok():
            return self.reply(403, {'error':'仅限本地访问'})
        path = self.path.split('?')[0]
        if path in ['/api/state', '/api/export']:
            with connect() as con:
                state = {'version':1, 'entries':[dict(r) for r in con.execute('SELECT * FROM entries ORDER BY day DESC, rowid DESC')], 'settings':{r['key']:r['value'] for r in con.execute('SELECT * FROM settings')}}
            if path == '/api/state':
                # 列表页不带音频数据，按需从 /api/audio 加载（否则每次打开都拉全量 base64）
                for e in state['entries']:
                    if e['audio']:
                        e['audio'] = f"/api/audio?id={e['id']}"
                state['token'] = TOKEN
            return self.reply(200, state)
        if path == '/api/audio':
            from urllib.parse import parse_qs, urlparse
            aid = parse_qs(urlparse(self.path).query).get('id', [''])[0]
            with connect() as con:
                row = con.execute('SELECT audio FROM entries WHERE id=?', (aid,)).fetchone()
            if not row or not row['audio'].startswith('data:'):
                return self.reply(404, {'error':'音频不存在'})
            prefix, payload = row['audio'].split(',', 1)
            mime = prefix[5:].split(';')[0] or 'audio/mpeg'
            return self.reply(200, base64.b64decode(payload), mime)
        files = {'/':'index.html','/app.js':'app.js','/sky.js':'sky.js','/sky-catalog.js':'sky-catalog.js','/sky-astronomy.js':'sky-astronomy.js','/style.css':'style.css','/favicon.svg':'favicon.svg'}
        if path not in files:
            return self.reply(404, {'error':'页面不存在'})
        kinds = {'html':'text/html; charset=utf-8','js':'application/javascript; charset=utf-8','css':'text/css; charset=utf-8','svg':'image/svg+xml'}
        filename = files[path]
        return self.reply(200, (ROOT / filename).read_bytes(), kinds[filename.rsplit('.',1)[1]])

    def do_POST(self):
        if not self.host_ok() or self.headers.get('X-Journal-Token') != TOKEN:
            return self.reply(403, {'error':'请刷新页面后重试'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 64 * 1024 * 1024:
                raise ValueError('文件过大')
            obj = json.loads(self.rfile.read(size))
            with connect() as con:
                if self.path == '/api/save':
                    e = validate_entry(obj)
                    if e['audio'] == '@keep':
                        # 编辑已有条目但没换音频：保留库里的原音频
                        old = con.execute('SELECT audio FROM entries WHERE id=?', (e['id'],)).fetchone()
                        e['audio'] = old['audio'] if old else ''
                    con.execute('INSERT OR REPLACE INTO entries (id,category,title,day,body,tags,image,medium,size,audio) VALUES (:id,:category,:title,:day,:body,:tags,:image,:medium,:size,:audio)', e)
                elif self.path == '/api/delete':
                    con.execute('DELETE FROM entries WHERE id=?', (obj['id'],))
                elif self.path == '/api/settings':
                    self.save_settings(con, obj)
                elif self.path == '/api/import':
                    if obj.get('version') != 1 or not isinstance(obj.get('entries'), list):
                        raise ValueError('请选择心歌随录的备份文件')
                    entries = [validate_entry(e) for e in obj['entries']]
                    for e in entries:
                        con.execute('INSERT OR REPLACE INTO entries (id,category,title,day,body,tags,image,medium,size,audio) VALUES (:id,:category,:title,:day,:body,:tags,:image,:medium,:size,:audio)', e)
                    self.save_settings(con, obj.get('settings', {}))
                else:
                    return self.reply(404, {'error':'操作不存在'})
            self.reply(200, {'ok':True})
        except (ValueError, KeyError, TypeError) as exc:
            self.reply(400, {'error':str(exc)})
        except Exception:
            self.reply(500, {'error':'保存失败，请检查磁盘空间后重试'})

    def save_settings(self, con, obj):
        labels = {'bio':'一句话介绍','bilibili':'B 站主页','xiaohongshu':'小红书主页','netease':'网易云音乐主页'}
        for key in ['bio','bilibili','xiaohongshu','netease']:
            if key in obj:
                value = obj[key]
                if not isinstance(value, str) or len(value) > 1000:
                    raise ValueError('设置内容过长')
                value = value.strip()
                if value and key != 'bio':  # bio 是文字不是链接，只做长度校验
                    from urllib.parse import urlparse
                    if '://' not in value:
                        value = 'https://' + value  # 宽容：没带协议头的自动补上
                    url = urlparse(value)
                    if url.scheme != 'https':
                        raise ValueError(f'{labels[key]}的链接必须是 https:// 开头')
                    host_ok = (url.hostname == 'space.bilibili.com' if key == 'bilibili'
                               else url.hostname in ('www.xiaohongshu.com','xhslink.com') if key == 'xiaohongshu'
                               else url.hostname in ('music.163.com','www.music.163.com') if key == 'netease'
                               else True)
                    if not host_ok or url.username or url.password:
                        names = {'bilibili':'B 站主页（space.bilibili.com）','xiaohongshu':'小红书主页（xiaohongshu.com 或 xhslink.com 短链）','netease':'网易云音乐（music.163.com）'}
                        raise ValueError(f'请输入 {names.get(key,"")} 的链接')
                con.execute('INSERT OR REPLACE INTO settings VALUES (?,?)', (key, value))

if __name__ == '__main__':
    http = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f'心歌随录 · 本机 http://127.0.0.1:{PORT}', flush=True)
    if BIND != '127.0.0.1':
        ip = lan_ip()
        if ip:
            print(f'心歌随录 · 局域网（手机连同一 WiFi） http://{ip}:{PORT}', flush=True)
    http.serve_forever()
