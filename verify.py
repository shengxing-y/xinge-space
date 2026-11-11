"""Integration check with an isolated temporary database; leaves real records intact."""
import json
import tempfile
import threading
import importlib.util
import urllib.error
import urllib.request
from pathlib import Path

with tempfile.TemporaryDirectory() as tmp:
    # Import a copy so module initialization never opens the user's real database.
    source = Path(__file__).resolve().parent / 'server.py'
    isolated = Path(tmp) / 'server.py'
    isolated.write_bytes(source.read_bytes())
    spec = importlib.util.spec_from_file_location('journal_test_server', isolated)
    server = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(server)
    server.DB = Path(tmp) / 'check.sqlite3'
    with server.connect() as con:
        con.execute("CREATE TABLE entries (id TEXT PRIMARY KEY, category TEXT, title TEXT, day TEXT, body TEXT, tags TEXT, image TEXT, medium TEXT DEFAULT '', size TEXT DEFAULT '', audio TEXT DEFAULT '')")
        con.execute('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)')
    http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
    server.PORT = http.server_port
    thread = threading.Thread(target=http.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.PORT}'
    def call(path, data=None, token=True, host=None):
        headers = {'Content-Type':'application/json'}
        if token:
            headers['X-Journal-Token'] = server.TOKEN
        if host:
            headers['Host'] = host
        req = urllib.request.Request(origin+path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())
    try:
        entry = {'id':'test-diary','category':'diary','title':'TEST diary','day':'2026-10-05','body':'local only','tags':'test','image':''}
        assert call('/api/save',entry,token=False)[0] == 403
        assert call('/api/state',host='untrusted.example:1')[0] == 403
        assert call('/api/save',entry)[0] == 200
        assert call('/api/state')[1]['entries'][0]['body'] == 'local only'
        entry['body'] = 'edited'
        assert call('/api/save',entry)[0] == 200
        backup = call('/api/export')[1]
        assert 'token' not in backup
        assert call('/api/delete',{'id':entry['id']})[0] == 200
        assert not call('/api/state')[1]['entries']
        assert call('/api/import',backup)[0] == 200
        assert call('/api/state')[1]['entries'][0]['body'] == 'edited'
        bad = {'version':1,'entries':[dict(entry,id='new-record')],'settings':{'bio':'changed','bilibili':'https://evil.example/'}}
        assert call('/api/import',bad)[0] == 400
        assert len(call('/api/state')[1]['entries']) == 1
        assert 'bio' not in call('/api/state')[1]['settings']
        assert call('/api/save',dict(entry,image='data:image/svg+xml;base64,PHN2Zz4='))[0] == 400
        with server.connect() as con:
            assert con.execute('SELECT body FROM entries').fetchone()['body'] == 'edited'
        print('PASS: create, edit, delete, durable read, backup restore, atomic import rollback, host/token checks, image validation')
    finally:
        http.shutdown()
        http.server_close()
