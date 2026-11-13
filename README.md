# 心歌随录 · Xinge Space

[简体中文](#chinese) | [English](#english)

<a id="chinese"></a>

## 简体中文

一个持续生长的个人网站，用来记录工作、生活与创作。当前版本：**0.5.0**。

## 功能

- 工作札记、画画手册、生活碎片、音乐与私人日记。
- 图文编辑、作品灯箱、跨栏目音乐播放、搜索与月份筛选。
- 晨昏双主题、真实晨昏时刻、恒星背景、往年今日与年度创作星图。
- SQLite 本地保存、JSON 备份恢复、只读静态网站导出。

个人经历、求职简历和项目案例展示仍在规划中。

## 本地运行

### 获取源码

在 GitHub 仓库首页点击 **Code → Download ZIP** 并解压；安装了 Git 也可执行：

```sh
git clone https://github.com/shengxing-y/xinge-space.git
cd xinge-space
```

需要 **Python 3.10+**，无需额外依赖。在项目目录执行：

```sh
python server.py
```

打开 http://127.0.0.1:18271 。Windows 也可双击 `start.cmd`。

**默认允许局域网访问，且没有登录保护。** 仅本机使用时，在 PowerShell 中运行：

```powershell
$env:JOURNAL_BIND="127.0.0.1"
python server.py
```

数据保存在 `data/journal.sqlite3`。数据库、备份与 `site/` 不提交到仓库；备份包含私人日记，请妥善保管。字体通过 CDN 加载，离线时使用系统字体。

### 日常使用

点击「记一笔」选择分类，填写标题、日期、正文、标签并添加图片或音频。点击记录卡片可阅读、编辑或删除；个人名片可设置简介及社交主页链接。页脚提供 JSON 导出与导入，方便备份或迁移。关闭终端即可停止服务，重新启动后数据仍在。

长文阅读器顶部关闭按钮始终可见；每次打开从顶部开始，关闭后恢复原页面位置。正文保留纯文本换行，支持 Esc 或点击阅读器外部关闭；点击正文留白不会误关闭。音乐不会因开关阅读器而暂停。

手机需和电脑处于同一可信 Wi-Fi，并使用终端打印的局域网地址；仅本机模式下手机无法访问。日记不出现在首页，但这不是权限保护，局域网访问者仍可读取它。

## 文章链接、置顶与精选

- 打开文章后地址变为 `#entry/文章编号?from=栏目`；复制链接可在同一部署站点直达文章。刷新保留当前文章，后退返回列表，前进重新打开；图片灯箱切图同步地址，一次后退回原列表。
- 阅读器与灯箱均有「复制链接」。浏览器不允许自动复制时提供手工复制框；本地／局域网／file地址不等于公网分享链接，正式分享请在已部署网站复制。私人日记不提供分享入口。删除、尚未导出或不存在的文章会显示明确提示。
- 本地编辑器「首页置顶」让该记录在首页最近列表优先，同组保持既有日期顺序；分类页排序不变。「首页精选」加入独立精选区，未选记录时隐藏；精选仍保留在普通列表，不重复计入活动统计。两个选项独立，私人日记不参与。
- 旧记录和旧备份缺少标记时均默认为关闭。旧备份覆盖同ID时以备份为准，会清除该记录新加的置顶／精选。静态站需重新导出记录后才带上你设置的标记；只同步页面代码不会擅自替你选代表作。
- 首次使用新后端前先停止旧服务并备份 `data/`，重启后自动补齐两个整数标记列，不改变正文和媒体。本轮开发仅用临时数据库验证迁移；没有替你读取或迁移真实数据库。

## 晨昏与岁时星图

- 首次访问按访客本地钟表选择主题：凌晨 `00:00–05:59` 为左侧金星的启明暗黑，其余时间（含18点后）为右侧金星的长庚日间。单击／轻触金星可手动覆盖，点击旁边的「恢复自动」重新跟随时间；手动选择会在当前浏览器保存。
- 保留「晨光始／昏影终」文案，时刻由既有固定观测参考点计算，每天更新并按北京时间显示（悬停可查看说明）；这是太阳晨昏时刻，不是访客定位或金星升落预报。金星仍是主题意象与交互入口。
- 「岁时星图」每一天一颗星，公开记录越多星越亮、星芒越大，分为0／1／2／3+篇。统计当地今天及之前364天，只计工作、画画、生活和音乐，不含私人日记、未来日期或窗口外记录。手机可横向查看全年，初次显示最近日期。
- 星点支持悬停、轻触与键盘：Tab进入，方向键移动日期，Home／End到窗口首尾，Escape关闭提示；「日期明细」提供同一份数据的表格。星图不添加持续动画。

### 亮星识别

在当前真实星图中，鼠标悬停有可靠名称的三等以内亮星，或在手机上轻触，可查看名称、星座及视星等；点空白或按 Escape 收起。只识别未被正文／卡片遮挡的星，金星仍只负责主题切换。星位不随鼠标改变，提示不增加星空重绘或持续动画。

键盘 Tab 可进入“识别当前视野中的亮星”（仅聚焦时可见），方向键遍历，Home／End跳到首尾。名称来自 HYG v4.1；已核实中文名参考香港太空馆[亮星中英对照表](https://hk.space.museum/sc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-bright-stars.html)，未确认中文名保留英文。可识别星数会随日期、主题、视口和内容遮挡变化；不是每颗暗星都有名称。

### 修改前端源码后

浏览器继续加载原有 `sky.js`、`app.js`、`static_app.js`，无需额外运行时依赖。它们由共享源生成：修改 `src/` 或星图源模块后执行 `python build_assets.py`，用 `python build_assets.py --check` 检查产物是否同步。

已有 `site/` 只需同步页面功能而不更新记录时，可执行 `python sync_site.py`；此命令不读数据库、不删除媒体，并保留原公开数据。要导出新增／修改的记录，仍使用下方完整导出命令并注意其媒体清理行为。

## 导出展示版

```sh
python export_static.py
```

生成 `site/`，包含所有非日记记录及个人名片链接，可上传至静态托管平台。导出会清理旧的图片和音频文件；发布前请检查内容与媒体授权。**不要将本地编辑服务直接开放到公网。**

## 部署到 Cloudflare Pages

**GitHub 保存项目源码；Cloudflare Pages 托管导出的只读网页。** 目前没有在仓库中配置自动部署，也没有提供已经上线的网站地址。推送 GitHub 不会自动更新线上网页。

### 1. 准备上传文件

先启动本地服务、保存内容，再执行上述导出命令。导出目录大致如下（没有媒体时相应目录可能为空）：

```text
site/
├── index.html
├── images/
└── audio/
```

双击 `site/index.html` 检查页面、图片、音乐和链接。只上传 `site/`，不要上传整个项目、`data/`、数据库或 JSON 备份。所有非日记分类都会导出，没有逐条发布确认；其中有不想公开的内容时先不要上传。

### 2. 首次发布

以下入口按 [Cloudflare 官方 Direct Upload 文档](https://developers.cloudflare.com/pages/get-started/direct-upload/) 整理，界面语言和按钮布局可能变化：

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，注册或登录并选择账户。
2. 进入 **Workers & Pages**，点击 **Create application**。
3. 找到 **Pages** 创建入口，选择 **Get started → Drag and drop your files**（拖放文件）。选择静态 Pages 上传，不是 Worker 应用。
4. 输入项目名，例如 `xinge-space`，把本地生成的 `site` 文件夹拖进上传区；预览文件列表时确认 `index.html` 位于站点根目录。
5. 按界面提示点击 **Deploy site**；如接着出现上传确认页，点击 **Save and Deploy**。
6. 成功后打开控制台提供的 `https://<项目名>.pages.dev` 地址。名称占用时实际地址可能带额外字符，以控制台为准。

这是对外公开操作，点击部署前应确认内容。测试完成后可把此地址发给别人；你的电脑无需持续开机。自定义域名不是必需项。

### 3. 后续更新

在本地修改并保存 → 重新导出 → 预览 → 回到 **Workers & Pages** 打开同一个项目 → 点击 **Create a new deployment** → 选择 **Production** → 上传新版 `site/` 并完成部署。使用同一个项目，原有正式网址继续使用。只改本地记录或只推送 GitHub，都不会更新该手动托管站点。

直接上传项目日后不能原地改成 Git 集成项目，若要自动部署需新建对应项目。目前个人数据留在本地，手动导出更容易检查公开范围。

### 常见问题

| 问题 | 检查方式 |
| --- | --- |
| 导出提示没有数据库 | 先运行 `python server.py` 初始化并保存记录 |
| 网站首页 404 | 检查上传后的根目录是否直接包含 `index.html`，不要额外嵌套一层 `site/` |
| 图片或音乐丢失 | 上传整个导出文件夹，不能只上传 `index.html` |
| 线上还是旧内容 | 确认重新导出并部署到 Production，再强制刷新浏览器 |
| 大文件上传失败 | Pages 单文件上限为 25 MiB；音频适当压缩，大视频使用 B 站链接 |
| 文件太多 | 控制台拖放上传上限为 1,000 个文件；更多文件可另用 Wrangler，见官方文档 |

托管访问速度取决于访客网络，不保证所有地区均能稳定访问。

## 项目结构

| 文件 | 用途 |
| --- | --- |
| `server.py` | 本地 HTTP 服务、SQLite 与媒体接口 |
| `index.html` / `app.js` / `style.css` | 页面、交互与样式 |
| `sky*.js` | 星空绘制、计算与星表数据 |
| `export_static.py` / `static_app.js` | 只读站点导出与展示交互 |
| `verify.py` / `sky.test.cjs` | 本地接口与天文计算验证 |
| `data/` / `site/` | 私人数据与生成文件，不进入 Git |

## 文档与许可

[版本记录](version.md) · [维护与验证](CONTRIBUTING.md) · [安全说明](SECURITY.md)

应用代码尚未选择开源许可证。恒星数据派生自 HYG v4.1，遵循 CC BY-SA 4.0；观测参数与署名见 [星表说明](SKY-CATALOG-LICENSE.md)。星空属于近似可视化，金星是主题切换入口，不用于精密观测。

---

<a id="english"></a>

## English

A growing personal website for work, life, and creative projects. Current version: **0.5.0**.

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

## Entry links, pins and selections

Opening an entry updates its fragment to `#entry/<encoded-id>?from=<section>`. Reload preserves the entry; Back restores its list context and Forward reopens it. Gallery navigation replaces the current entry fragment instead of adding a history item for every image. Reader/gallery copy controls have a manual-copy fallback. Local, LAN and file addresses are not public links; copy from the deployed site for public sharing. Private journals have no sharing control, and unavailable IDs show a safe error view.

The local editor has independent homepage pin and featured checkboxes. Pins group entries first only in the homepage recent list; other sections retain their existing order. Explicitly featured public entries appear in a separate homepage section, hidden when empty. They remain in the ordinary list and are not counted twice in activity statistics. Journals are never eligible.

Old records and v1 backups default missing flags to false; restoring an old backup over an existing ID clears those flags, following existing replacement semantics. Code-only static synchronization never assigns selections; re-export content after choosing entries. Before first starting the updated backend, stop the old server and back up `data/`. Startup adds the two integer flag columns. Development migration tests use temporary databases only.

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
