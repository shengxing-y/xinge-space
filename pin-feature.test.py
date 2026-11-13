"""Isolated pin/feature regression tests; never import the root server or run export main."""
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
FLAGS = ('pinned', 'featured')
LEGACY_SCHEMA = "CREATE TABLE entries (id TEXT PRIMARY KEY, category TEXT, title TEXT, day TEXT, body TEXT, tags TEXT, image TEXT)"


def load_copy(filename, folder):
    target = folder / filename
    target.write_bytes((ROOT / filename).read_bytes())
    spec = importlib.util.spec_from_file_location('isolated_' + target.stem, target)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def entry(**changes):
    result = dict(id='record', category='work', title='Test', day='2026-11-13',
                  body='Body', tags='', image='')
    result.update(changes)
    return result


class MigrationTests(unittest.TestCase):
    def test_fresh_schema_and_public_only_seeds(self):
        with tempfile.TemporaryDirectory() as tmp:
            server = load_copy('server.py', Path(tmp))
            with server.connect() as con:
                columns = {r['name']: r for r in con.execute('PRAGMA table_info(entries)')}
                for key in FLAGS:
                    self.assertEqual(columns[key]['type'], 'INTEGER')
                    self.assertEqual(columns[key]['notnull'], 1)
                    self.assertEqual(columns[key]['dflt_value'], '0')
                rows = list(con.execute('SELECT * FROM entries'))
                self.assertTrue(rows)
                self.assertTrue(all(r['category'] != 'diary' for r in rows))
                self.assertTrue(all(r[key] == 0 for r in rows for key in FLAGS))

    def test_legacy_migration_preserves_records_and_is_idempotent(self):
        for existing in (None, 'pinned', 'featured'):
            with self.subTest(existing=existing), tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                data = folder / 'data'
                data.mkdir()
                with closing(sqlite3.connect(data / 'journal.sqlite3')) as con, con:
                    con.execute(LEGACY_SCHEMA)
                    if existing:
                        con.execute(f'ALTER TABLE entries ADD COLUMN {existing} INTEGER NOT NULL DEFAULT 0')
                    con.execute('INSERT INTO entries VALUES (?,?,?,?,?,?,?' + (',?' if existing else '') + ')',
                                ('legacy', 'diary', 'Private', '2020-01-01', 'unchanged', 'old', '') + ((1,) if existing else ()))
                    con.execute('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)')
                    con.executemany('INSERT INTO settings VALUES (?,?)', [('initialized', 'yes'), ('bio', 'Legacy bio')])
                for _ in range(2):
                    server = load_copy('server.py', folder)
                    with server.connect() as con:
                        rows = list(con.execute('SELECT * FROM entries'))
                        self.assertEqual(len(rows), 1)
                        self.assertEqual(rows[0]['id'], 'legacy')
                        self.assertEqual(rows[0]['body'], 'unchanged')
                        self.assertEqual(rows[0]['category'], 'diary')
                        self.assertEqual(con.execute("SELECT value FROM settings WHERE key='bio'").fetchone()[0], 'Legacy bio')
                        columns = {r['name']: r for r in con.execute('PRAGMA table_info(entries)')}
                        for key in FLAGS:
                            self.assertEqual(columns[key]['type'], 'INTEGER')
                            self.assertEqual(columns[key]['notnull'], 1)
                            self.assertEqual(columns[key]['dflt_value'], '0')
                            self.assertEqual(rows[0][key], int(key == existing))
                        for key in ('medium', 'size', 'audio'):
                            self.assertEqual(rows[0][key], '')


class APITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.server = load_copy('server.py', Path(self.tmp.name))
        self.http = self.server.ThreadingHTTPServer(('127.0.0.1', 0), self.server.Handler)
        self.server.PORT = self.http.server_port
        self.thread = threading.Thread(target=self.http.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def request(self, path, obj=None, raw=False):
        req = urllib.request.Request(f'http://127.0.0.1:{self.server.PORT}' + path,
                                     data=json.dumps(obj).encode() if obj is not None else None,
                                     headers={'Content-Type': 'application/json', 'X-Journal-Token': self.server.TOKEN})
        try:
            response = urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read()
            return response.status, body if raw else json.loads(body)

    def test_bool_roundtrip_save_state_export_import(self):
        for pinned in (False, True):
            for featured in (False, True):
                obj = entry(pinned=pinned, featured=featured)
                self.assertEqual(self.request('/api/save', obj)[0], 200)
                with self.server.connect() as con:
                    row = con.execute("SELECT pinned,featured,typeof(pinned),typeof(featured) FROM entries WHERE id='record'").fetchone()
                    self.assertEqual(tuple(row), (int(pinned), int(featured), 'integer', 'integer'))
                for path in ('/api/state', '/api/export'):
                    status, state = self.request(path)
                    self.assertEqual(status, 200)
                    saved = next(e for e in state['entries'] if e['id'] == 'record')
                    for key, expected in (('pinned', pinned), ('featured', featured)):
                        self.assertIs(type(saved[key]), bool)
                        self.assertIs(saved[key], expected)
                backup = self.request('/api/export')[1]
                self.assertEqual(backup['version'], 1)
                self.assertNotIn('token', backup)
                self.assertEqual(self.request('/api/import', backup)[0], 200)
                restored = next(e for e in self.request('/api/state')[1]['entries'] if e['id'] == 'record')
                self.assertIs(restored['pinned'], pinned)
                self.assertIs(restored['featured'], featured)

    def test_missing_flags_and_version_one_old_backup_default_false(self):
        self.assertEqual(self.request('/api/save', entry(pinned=True, featured=True))[0], 200)
        old = {'version': 1, 'entries': [entry()], 'settings': {}}
        self.assertEqual(self.request('/api/import', old)[0], 200)
        saved = next(e for e in self.request('/api/export')[1]['entries'] if e['id'] == 'record')
        for key in FLAGS:
            self.assertIs(saved[key], False)
        self.assertEqual(self.request('/api/save', entry(id='missing'))[0], 200)
        saved = next(e for e in self.request('/api/state')[1]['entries'] if e['id'] == 'missing')
        self.assertTrue(all(saved[key] is False for key in FLAGS))

    def test_strict_bool_types_for_both_fields_and_diary(self):
        for category in ('work', 'diary'):
            for key in FLAGS:
                for bad in (0, 1, -1, 0.0, 1.0, 'true', 'false', '', None, [], {}):
                    with self.subTest(category=category, key=key, bad=bad):
                        obj = entry(category=category, **{key: bad})
                        with self.assertRaises(ValueError):
                            self.server.validate_entry(obj)
        self.assertEqual(self.request('/api/save', entry(pinned=1))[0], 400)
        self.assertEqual(self.request('/api/import', {'version': 1, 'entries': [entry(featured='true')]})[0], 400)

    def test_diary_flags_always_false_even_for_legacy_database_values(self):
        obj = entry(category='diary', pinned=True, featured=True)
        for path, payload in (('/api/save', obj), ('/api/import', {'version': 1, 'entries': [obj]})):
            self.assertEqual(self.request(path, payload)[0], 200)
            with self.server.connect() as con:
                row = con.execute("SELECT pinned,featured FROM entries WHERE id='record'").fetchone()
                self.assertEqual(tuple(row), (0, 0))
        with self.server.connect() as con:
            con.execute("UPDATE entries SET pinned=1, featured=1 WHERE id='record'")
        for path in ('/api/state', '/api/export'):
            saved = next(e for e in self.request(path)[1]['entries'] if e['id'] == 'record')
            self.assertIs(saved['pinned'], False)
            self.assertIs(saved['featured'], False)

    def test_import_rolls_back_overwrites_inserts_flags_and_settings(self):
        self.assertEqual(self.request('/api/save', entry(pinned=True))[0], 200)
        self.assertEqual(self.request('/api/settings', {'bio': 'original'})[0], 200)
        before = self.request('/api/export')[1]
        for entries, settings in (
            ([entry(body='changed', featured=True), entry(id='new')], {'bio': 'changed', 'bilibili': 'https://evil.example/'}),
            ([entry(body='changed'), entry(id='new', pinned=1)], {'bio': 'changed'}),
        ):
            self.assertEqual(self.request('/api/import', {'version': 1, 'entries': entries, 'settings': settings})[0], 400)
            self.assertEqual(self.request('/api/export')[1], before)
        with self.server.connect() as con:
            con.execute("CREATE TRIGGER reject_bad BEFORE INSERT ON entries WHEN NEW.id='reject' BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        self.assertEqual(self.request('/api/import', {'version': 1, 'entries': [entry(body='changed'), entry(id='reject')], 'settings': {'bio': 'changed'}})[0], 500)
        self.assertEqual(self.request('/api/export')[1], before)

    def test_api_json_escapes_less_than_without_changing_content(self):
        payload = '</script><script>alert("test")</script>'
        self.assertEqual(self.request('/api/save', entry(body=payload))[0], 200)
        status, body = self.request('/api/export', raw=True)
        self.assertEqual(status, 200)
        self.assertNotIn(b'<', body)
        self.assertIn(b'\\u003c/script>', body)
        saved = next(e for e in json.loads(body)['entries'] if e['id'] == 'record')
        self.assertEqual(saved['body'], payload)


class StaticDataTests(unittest.TestCase):
    def test_whitelist_legacy_flags_and_no_diary(self):
        with tempfile.TemporaryDirectory() as tmp:
            exporter = load_copy('export_static.py', Path(tmp))
            for flags in ((), ('pinned',), ('featured',), FLAGS):
                with self.subTest(flags=flags), closing(sqlite3.connect(':memory:')) as con, con:
                    con.row_factory = sqlite3.Row
                    con.execute(LEGACY_SCHEMA)
                    con.execute('ALTER TABLE entries ADD COLUMN private_secret TEXT')
                    for flag in flags:
                        con.execute(f'ALTER TABLE entries ADD COLUMN {flag} INTEGER NOT NULL DEFAULT 0')
                    for category in ('work', 'art', 'life', 'music', 'diary'):
                        con.execute('INSERT INTO entries (id,category,title,day,body,tags,image,private_secret) VALUES (?,?,?,?,?,?,?,?)',
                                    (category, category, 'Title', '2026-11-13', '</script>', '', '', 'DO NOT EXPORT'))
                    for flag in flags:
                        con.execute(f'UPDATE entries SET {flag}=1')
                    rows = exporter.public_entries(con)
                    self.assertEqual({e['category'] for e in rows}, {'work', 'art', 'life', 'music'})
                    for row in rows:
                        self.assertEqual(set(row), {'id', 'category', 'title', 'day', 'body', 'tags', 'image', 'medium', 'size', 'audio', 'pinned', 'featured'})
                        self.assertNotIn('private_secret', row)
                        for flag in FLAGS:
                            self.assertIs(type(row[flag]), bool)
                            self.assertIs(row[flag], flag in flags)
                    self.assertNotIn('DO NOT EXPORT', exporter.serialize_data({'entries': rows}))

    def test_embedded_json_uses_actual_literal_unicode_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            exporter = load_copy('export_static.py', Path(tmp))
            payload = {'entries': [entry(title='</script><script>alert(1)</script>', body='中文 < & >')],
                       'settings': {'bio': '</script><img src=x onerror=alert(1)>'}}
            serialized = exporter.serialize_data(payload)
            self.assertNotIn('<', serialized)
            self.assertIn('\\u003c/script>', serialized)
            self.assertNotIn('\\\\u003c', serialized)
            self.assertEqual(json.loads(serialized), payload)
            html = exporter.TEMPLATE.replace('%%DATA%%', serialized)
            self.assertIn('window.__DATA__=' + serialized + ';</script>', html)
            self.assertNotIn('<script>alert(1)', html)


if __name__ == '__main__':
    unittest.main(verbosity=2)
