[简体中文](README.md) | [English](README.en.md)

# Xinge Space · 心歌随录

A growing personal website for work, life, and creative projects. Current version: **0.3.1**.

## Features

- Work notes, artwork, life updates, music, and a private journal.
- Text and image editing, artwork lightbox, persistent music playback, search, and month filtering.
- Dusk and dawn themes, a star background, past-year memories, and an activity heatmap.
- Local SQLite storage, JSON backup and restore, and a read-only static website export.

Experience, résumé, and project case-study pages are planned, not yet implemented.

## Run locally

Requires **Python 3.10+**, with no additional dependencies. From the project directory:

```sh
python server.py
```

Open http://127.0.0.1:18271 . On Windows, you can also double-click `start.cmd`.

**The server allows LAN access by default and has no login protection.** For local-only use, run in PowerShell:

```powershell
$env:JOURNAL_BIND="127.0.0.1"
python server.py
```

Data is stored in `data/journal.sqlite3`. The database, backups, and `site/` are excluded from Git. Backups include private journal entries; keep them safe. Fonts load from a CDN, with system-font fallbacks when offline.

## Export a showcase

```sh
python export_static.py
```

This generates `site/`, containing all non-journal entries and profile links, for static hosting. Exporting removes old image and audio files in the output folders. Review the content and media rights before publishing. **Do not expose the local editing server to the internet.**

## Documentation and licensing

[Version history](version.md) · [Contributing and verification](CONTRIBUTING.md) · [Security](SECURITY.md)

The application code does not yet have an open-source license. Star data is derived from HYG v4.1 under CC BY-SA 4.0; see the [catalog notice](SKY-CATALOG-LICENSE.md) for attribution and observation parameters. The sky is an approximate visualization; Venus acts as a theme control, not a precision observation tool.
