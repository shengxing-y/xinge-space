[简体中文](README.md) | [English](README.en.md)

# Xinge Space · 心歌随录

A growing personal website for work, life, and creative projects. Current version: **0.4.0**.

## Features

- Work notes, artwork, life updates, music, and a private journal.
- Text and image editing, artwork lightbox, persistent music playback, search, and month filtering.
- Dusk and dawn themes, calculated twilight times, a star background, past-year memories, and a daily activity star map.
- Local SQLite storage, JSON backup and restore, and a read-only static website export.

Experience, résumé, and project case-study pages are planned, not yet implemented.

## Run locally

### Get the source

On GitHub, select **Code → Download ZIP** and extract it, or use Git:

```sh
git clone https://github.com/shengxing-y/xinge-space.git
cd xinge-space
```

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

### Everyday use

Choose “记一笔” to create an entry with a category, title, date, text, tags, image, or audio. Open a card to read, edit, or delete it. Edit your profile to add an introduction and social links. The footer offers JSON export and import for backup and migration. Closing the terminal stops the service; saved data remains after restarting.

The reader keeps its close control visible while scrolling. Each article opens at the top; closing restores the previous page position and focus. Text remains plain text with line breaks. Escape or a genuine backdrop click closes it; clicking internal whitespace does not. Opening or closing the reader does not pause music.

For phone access, use the LAN address printed in the terminal on the same trusted Wi-Fi. Local-only mode blocks phone access. Keeping journal entries off the homepage is not access control: LAN visitors can still read them.

## Theme clock and activity stars

- Automatic mode uses the visitor's local wall clock: 00:00–05:59 selects the left-hand Venus/dark dawn theme; all other times, including after 18:00, select the right-hand Venus/dusk theme. A single click/tap sets a persistent manual override. “恢复自动” returns to automatic scheduling.
- The retained dawn/dusk captions show the existing observer's solar twilight times in Beijing time (UTC+8). They are not Venus rise/set predictions or calculations for the visitor's location. The Venus icon remains a theme metaphor.
- Each of the last 365 local calendar days has one activity star. Brightness and size encode 0/1/2/3+ public entries. Private journal activity, future dates, and older records are excluded. The whole year remains horizontally available on phones, initially scrolled to the latest dates.
- Hover, tap, or keyboard focus shows the date and count. Arrow keys navigate; Home/End select the first/latest date; Escape closes the tooltip. “日期明细” exposes the same data as a table. No continuous chart animation is added.

Named stars of magnitude ≤3 can be identified by desktop hover or a short phone tap, only where unobscured by content. A small tooltip shows name, constellation and visual magnitude. Escape or an outside tap dismisses it. Venus remains the theme control; identification does not move stars or add a canvas animation loop. A focus-visible keyboard entry allows arrow-key/Home/End navigation. Verified Chinese names reference the [Hong Kong Space Museum glossary](https://hk.space.museum/sc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-bright-stars.html); other entries retain HYG proper names. Available stars depend on the date, theme, viewport and foreground content.

After editing `src/` or sky source modules, run `python build_assets.py`; validate generated browser entry points with `python build_assets.py --check`. Runtime URLs are unchanged. To update only an existing `site/` export's assets and chart markup without reading the database or deleting media, run `python sync_site.py`. Export new journal content using the full export command below instead.

## Export a showcase

```sh
python export_static.py
```

This generates `site/`, containing all non-journal entries and profile links, for static hosting. Exporting removes old image and audio files in the output folders. Review the content and media rights before publishing. **Do not expose the local editing server to the internet.**

## Deploy to Cloudflare Pages

**GitHub stores source code; Cloudflare Pages hosts the exported read-only website.** This repository has no automatic deployment configured and lists no deployed website URL. Pushing code to GitHub does not update a hosted site.

### 1. Prepare files

Run the local server and save your content, then export it using the command above. The output contains `site/index.html`, `site/images/`, and `site/audio/`; media directories may be empty. Open `site/index.html` locally and check content, images, audio, and links.

Upload only `site/`, never the entire project, `data/`, the database, or JSON backups. Export includes every non-journal category, with no per-entry publishing approval. Do not upload if it contains anything you want to keep private.

### 2. First deployment

Steps follow the [official Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/); labels and layout may vary:

1. Sign in or register at the [Cloudflare dashboard](https://dash.cloudflare.com/) and select your account.
2. Open **Workers & Pages**, then **Create application**.
3. Find the **Pages** creation flow and choose **Get started → Drag and drop your files**. Use static Pages upload, not a Worker app.
4. Enter a project name such as `xinge-space`. Drag the generated `site` folder into the upload area. Ensure `index.html` appears at the site root.
5. Choose **Deploy site** and, if a subsequent upload confirmation appears, **Save and Deploy**.
6. Open the `https://<project-name>.pages.dev` URL shown by the dashboard. The actual address may include extra characters if the name is taken.

Deployment makes content public; review it before confirming. After testing, share the URL. Your computer does not need to stay online, and a custom domain is optional.

### 3. Update the site

Edit and save locally, export again, and preview. In **Workers & Pages**, open the same project, select **Create a new deployment**, choose **Production**, upload the new `site/`, and finish deployment. The production address stays the same. Local edits or GitHub pushes alone do not update a manually uploaded site.

A Direct Upload project cannot be converted in place to Git integration; automatic deployment requires a new project. Manual export currently lets you review content before publishing while keeping personal data local.

### Troubleshooting

| Problem | What to check |
| --- | --- |
| Missing database during export | Run `python server.py` first and save entries |
| Homepage returns 404 | Place `index.html` at the upload root, not inside an extra `site/` layer |
| Missing images or music | Upload the complete output folder, not just `index.html` |
| Old content online | Re-export, deploy to Production, and force-refresh the browser |
| Oversized file | Pages limits each file to 25 MiB; compress audio and link large videos externally |
| Too many files | Dashboard drag-and-drop supports 1,000 files; use Wrangler for larger uploads, as documented officially |

Availability and speed depend on visitor networks; access is not guaranteed in every region.

## Project layout

| File | Purpose |
| --- | --- |
| `server.py` | Local HTTP server, SQLite, and media endpoints |
| `index.html` / `app.js` / `style.css` | Page structure, interactions, and styling |
| `sky*.js` | Sky rendering, calculations, and star data |
| `export_static.py` / `static_app.js` | Read-only export and display behavior |
| `verify.py` / `sky.test.cjs` | API and astronomy verification |
| `data/` / `site/` | Private data and generated output, excluded from Git |

## Documentation and licensing

[Version history](version.md) · [Contributing and verification](CONTRIBUTING.md) · [Security](SECURITY.md)

The application code does not yet have an open-source license. Star data is derived from HYG v4.1 under CC BY-SA 4.0; see the [catalog notice](SKY-CATALOG-LICENSE.md) for attribution and observation parameters. The sky is an approximate visualization; Venus acts as a theme control, not a precision observation tool.
