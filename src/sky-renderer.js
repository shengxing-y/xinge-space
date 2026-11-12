'use strict';
/* 忻州城区 → 沈阳方向的当日晨昏恒星投影。
   恒星来自 HYG v4.1；金星是保留的主题入口，不代表该方向的实际金星位置。
   转场旋转是时间意象；恒星坐标不跟随鼠标，不添加随机星、假连线或流星。 */
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'sky';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  /* 清晨背景层：放在 canvas 之下（DOM 先于 canvas），CSS 控制淡入淡出 */
  const dawnLayer = document.createElement('div');
  dawnLayer.id = 'dawn-layer';
  dawnLayer.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(dawnLayer, canvas);
  /* 独立留白带：按钮随文档滚动，金星以按钮中心为唯一坐标源。 */
  const control = document.createElement('section');
  control.className = 'sky-control';
  control.setAttribute('aria-label', '晨昏主题');
  const toggle = document.createElement('button');
  toggle.id = 'venus-toggle';
  toggle.className = 'venus-toggle';
  toggle.type = 'button';
  toggle.innerHTML = '<span class="venus-orb" aria-hidden="true"></span><span class="venus-caption"><strong class="venus-name"></strong><span class="venus-action"></span></span>';
  control.appendChild(toggle);
  const header = document.querySelector('header');
  if (header) header.after(control);
  else document.body.appendChild(control);
  const orb = toggle.querySelector('.venus-orb');
  const name = toggle.querySelector('.venus-name');
  const action = toggle.querySelector('.venus-action');
  /* 保留晨昏文案，时间明确为固定观测点的北京时间。 */
  const meta = document.createElement('div');
  meta.className = 'sky-meta';
  const whenEl = document.createElement('p');
  whenEl.id = 'sky-when';
  const autoButton = document.createElement('button');
  autoButton.type = 'button';
  autoButton.id = 'theme-auto';
  autoButton.textContent = '恢复自动';
  autoButton.title = '按本地时间自动选择：凌晨0–6点为启明暗黑，其余时间为长庚日间';
  meta.append(whenEl, autoButton);
  control.appendChild(meta);
  function updateWhen() {
    whenEl.hidden = !skyState || !skyState.time;
    if (whenEl.hidden) return;
    const time = ThemePolicy.formatTime(skyState.time);
    whenEl.textContent = THEME === 'dawn'
      ? `今晨 ${time} 晨光始 · 启明犹悬`
      : `今夜 ${time} 昏影终 · 长庚正明`;
    whenEl.title = '北京时间 · 固定观测点的太阳晨昏时刻；晨间太阳高度−12°，暮间−6°。金星为主题意象，非升落预报。';
  }
  const ctx = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motion.matches;
  let DPR = 1;
  const TAU = Math.PI * 2;
  const astronomy = window.SkyAstronomy;
  const catalog = window.SkyCatalog;

  /* ---- 自动主题与天文时刻分开：主题使用访客本地钟表时间。 ---- */
  let storage = null;
  try { storage = window.localStorage; } catch (e) {}
  const selection = ThemePolicy.restore(storage);
  let manual = selection.manual;
  let THEME = selection.theme;
  let pendingAutomatic = null;
  document.body.dataset.theme = THEME;
  const VENUS = { c: '#fffdf6', halo: '255,240,205' };
  const THEMES = {
    vesper: { limit: 3.8, twinkle: .25, visibility: .5 },
    dawn: { limit: 6, twinkle: .6, visibility: 1 },
  };
  let W = 0, H = 0, stars = [], twinkleFactor = 1, t = 0;
  let skyDate = '', skyState = null;
  const skyCache = new Map();
  let trans = null;   // 原生合成过渡期间暂停装饰绘制
  let raf = 0, frameTimer = 0, lastFrame = 0;
  let dirty = true, needsBuild = false, layoutDirty = false, modalOpen = false;
  let renderAlpha = 1;
  const identify = StarIdentify.create({ document, enabled: () => !trans && !modalOpen && !document.hidden });
  control.appendChild(identify.keyboardButton);
  const venusSprite = document.createElement('canvas');
  buildVenusSprite();
  const venusCanvas = document.createElement('canvas');
  venusCanvas.width = venusCanvas.height = 60;
  venusCanvas.setAttribute('aria-hidden', 'true');
  orb.appendChild(venusCanvas);
  venusCanvas.getContext('2d').drawImage(venusSprite, 0, 0, 60, 60);
  let venus = { x: 0, y: 0 };

  function updateControl(theme) {
    const dawn = theme === 'dawn';
    control.dataset.skyTheme = theme;
    name.textContent = dawn ? '启明 · 轻触入暮' : '长庚 · 轻触候晓';
    action.textContent = '';
    autoButton.hidden = !manual;
    control.dataset.themeMode = manual ? 'manual' : 'auto';
    toggle.setAttribute('aria-label', `${dawn ? '启明星，黎明前暗黑模式' : '长庚星，黄昏明亮模式'}。单击或轻触金星切换晨昏，键盘可按 Enter 或空格。`);
    toggle.setAttribute('aria-disabled', trans ? 'true' : 'false');
  }

  function syncVenus() {
    const rect = orb.getBoundingClientRect();
    venus = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function build() {
    const cfg = THEMES[THEME];
    W = window.innerWidth; H = window.innerHeight;
    const mobile = window.matchMedia('(max-width:640px)').matches;
    DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    skyDate = astronomy.chinaDate(new Date());
    const key = skyDate + ':' + THEME;
    if (!skyCache.has(key)) {
      if (skyCache.size >= 2) skyCache.clear();
      skyCache.set(key, astronomy.sky(skyDate, THEME, catalog));
    }
    skyState = skyCache.get(key);
    stars = skyState.stars.filter(s => s.mag <= cfg.limit).flatMap(s => {
      const point = astronomy.project(s, W, H, skyState.bearing);
      if (!point) return [];
      return [{ ...point, id: s.id, mag: s.mag,
        r: Math.max(.45, 2.3 - (s.mag + 1) * .27),
        baseA: Math.max(.15, Math.min(1, 1.12 - s.mag * .14)),
        c: s.ci !== null && s.ci > .8 ? '#ffe3be' : '#dce9ff',
        phase: (s.id * 2.399963) % TAU, tw: .6 + (s.id % 11) * .04 }];
    });
    twinkleFactor = cfg.twinkle;
    identify.setStars(stars.flatMap(star => SkyNames[star.id] ? [{ ...star, ...SkyNames[star.id] }] : []));
    syncVenus();
    canvas.dataset.skyDate = skyDate;
    canvas.dataset.skyTime = skyState.time;
    canvas.dataset.skyBearing = skyState.bearing.toFixed(4);
    updateWhen();
  }

  function dot(x, y, r, color, alpha) {
    ctx.globalAlpha = alpha * renderAlpha;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function star(s) {
    const low = s.y / H;
    const amp = (.3 + .5 * low) * twinkleFactor;
    const tw = reduce ? 1 : (1 - amp / 2 + amp * (Math.sin(t * s.tw + s.phase) + 1) / 2);
    dot(s.x, s.y, s.r, s.c, s.baseA * tw);
  }

  function buildVenusSprite() {
    venusSprite.width = venusSprite.height = 80;
    const ctx = venusSprite.getContext('2d');
    ctx.setTransform(1.25, 0, 0, 1.25, 0, 0);
    const bx = 32, by = 32, breath = .6;
    /* 金星：三层柔光晕 + 四根渐隐细芒（无斜芒）+ 刺目核心 */
    const layers = [[24, .12 + breath * .04], [15, .24 + breath * .07], [7, .42 + breath * .13]];
    for (const [R, a] of layers) {
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, R);
      g.addColorStop(0, `rgba(${VENUS.halo},${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${VENUS.halo},0)`);
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fill();
    }
    const L = 12 + breath * 4;
    ctx.lineWidth = .7;
    for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const g = ctx.createLinearGradient(bx, by, bx + ux * L, by + uy * L);
      g.addColorStop(0, `rgba(255,246,220,${(.26 + breath * .1).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,246,220,0)');
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + ux * L, by + uy * L); ctx.stroke();
    }
    /* 暮光里也保留细微暖色边缘，让白金星不被明亮天空吞没。 */
    for (const [r, color, alpha] of [[3.8, '#95765c', .45], [2.9, VENUS.c, 1]]) {
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
    }
  }

  function paint() {
    ctx.clearRect(0, 0, W, H);
    renderAlpha = THEMES[THEME].visibility;
    for (const s of stars) star(s);
    renderAlpha = 1;
    ctx.globalAlpha = 1;
  }

  /* ---- 主题过渡：星轨换天 ----
     绕虚拟中心旋出，表达晨昏时间流转；不是此朝向的精确周日运动。
     每颗星只预绘一次短弧，剩余旋转交给合成器，不改变最终投影坐标。 */
  const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  function hex2rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function paintTransition(k) {
    ctx.clearRect(0, 0, W, H);
    const px = W * 2.2, py = -H * .9;                     // 换场的虚拟旋转中心，不是该朝向的北天极投影
    const A = Math.min(1.2, .55 * (H / W) + .25);          // 旋出幅度，保证划出屏幕
    const out = k < .5;                                     // 前段：旧星旋出；后段：新星旋入
    const theta = out ? easeIO(k * 2) * -A : (1 - easeIO((k - .5) * 2)) * A;
    const phase = out ? k * 2 : (k - .5) * 2;
    const trail = .055 * Math.sin(Math.PI * phase);
    const fade = out ? 1 - easeIO(phase) : easeIO(phase);
    renderAlpha = fade * THEMES[THEME].visibility;
    const rot = (x, y, a) => {
      const dx = x - px, dy = y - py;
      const ca = Math.cos(a), sa = Math.sin(a);
      return [px + dx * ca - dy * sa, py + dx * sa + dy * ca];
    };
    const streak = (x, y, r, rgb, alpha) => {
      const [hx, hy] = rot(x, y, theta);
      const [tx2, ty2] = rot(x, y, theta + trail);
      const g = ctx.createLinearGradient(hx, hy, tx2, ty2);
      g.addColorStop(0, `rgba(${rgb},${alpha.toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.globalAlpha = renderAlpha; ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(r * 1.4, .8); ctx.lineCap = 'round';
      ctx.beginPath();
      const radius = Math.hypot(x - px, y - py);
      const angle = Math.atan2(y - py, x - px);
      ctx.arc(px, py, radius, angle + theta, angle + theta + trail);
      ctx.stroke();
      dot(hx, hy, r, `rgb(${rgb})`, Math.min(alpha + .25, 1));
    };
    for (const s of stars) streak(s.x, s.y, s.r, hex2rgb(s.c), s.baseA * .85);
    renderAlpha = 1;
    ctx.globalAlpha = renderAlpha;
  }

  function commitTheme(next) {
    THEME = next;
    document.body.dataset.theme = next;
    updateControl(next);
    build();
    dirty = true;
  }

  function finishTransition(state) {
    if (trans !== state) return;
    clearTimeout(state.timer);
    if (!state.committed) commitTheme(state.next);
    trans = null;
    document.body.classList.remove('sky-switch', 'theme-fallback');
    updateControl(THEME);
    paint();
    dirty = false;
    lastFrame = 0;
    scheduleFrame();
    if (pendingAutomatic !== null) {
      pendingAutomatic = null;
      refreshClock();
    }
  }

  function startTransition(next) {
    if (trans || next === THEME) return;
    identify.close();

    if (reduce) {
      commitTheme(next);
      resetScheduler();
      return;
    }
    clearTimeout(frameTimer); frameTimer = 0;
    cancelAnimationFrame(raf); raf = 0;
    const state = { next, committed: false, view: null, timer: 0 };
    trans = state;
    toggle.setAttribute('aria-disabled', 'true');
    if (!document.startViewTransition) {
      document.body.classList.add('theme-fallback');
      commitTheme(next);
      state.committed = true;
      paint();
      state.timer = setTimeout(() => finishTransition(state), 3600);
      return;
    }
    /* 只捕获两帧。星轨预绘一次，旋转和交叉淡化交给合成器。 */
    document.body.classList.add('sky-switch');
    paintTransition(.025);
    try {
      state.view = document.startViewTransition(() => {
        if (trans !== state) return;
        commitTheme(next);
        state.committed = true;
        paint(); // 目标快照就是最终星空，合成旋转结束后无换帧跳位。
      });
      state.view.ready.catch(() => {}); // 浏览器可以因尺寸或后台跳过快照，但仍须完成提交。
      state.view.updateCallbackDone.catch(() => {}); // 失败后仍由 finished 统一释放事务。
      state.view.finished.then(() => finishTransition(state), () => finishTransition(state));
    } catch (e) {
      finishTransition(state);
    }
  }

  function settleTransition() {
    if (!trans) return;
    const state = trans;
    if (state.view) state.view.skipTransition();
    else finishTransition(state);
  }

  toggle.addEventListener('click', () => {
    if (trans || document.querySelector('dialog[open], #lightbox:not([hidden])')) return;
    manual = true;
    pendingAutomatic = null;
    const next = THEME === 'vesper' ? 'dawn' : 'vesper';
    ThemePolicy.save(storage, true, next);
    updateControl(THEME);
    startTransition(next);
  });
  autoButton.addEventListener('click', () => {
    manual = false;
    ThemePolicy.save(storage, false, ThemePolicy.automatic());
    updateControl(THEME);
    refreshClock();
  });
  function refreshClock() {
    if (document.hidden) return;
    const next = manual ? null : ThemePolicy.automatic();
    if (trans) {
      if (next !== null) pendingAutomatic = next;
      return;
    }
    if (next !== null && next !== THEME) {
      if (modalOpen) { pendingAutomatic = next; return; }
      startTransition(next);
      return;
    }
    if (astronomy.chinaDate(new Date()) !== skyDate) {
      needsBuild = dirty = true;
      scheduleFrame();
    }
  }
  const lightbox = document.getElementById('lightbox');
  function syncModal() {
    control.inert = !!lightbox && !lightbox.hidden;
    const open = !!document.querySelector('dialog[open], #lightbox:not([hidden])');
    if (open === modalOpen) return;
    modalOpen = open;
    identify.close();
    resetScheduler();
    if (!open) refreshClock();
  }
  new MutationObserver(syncModal).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['open', 'hidden'],
  });

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
    lastFrame = now;
    t += dt;
    if (needsBuild) { build(); needsBuild = false; }
    if (layoutDirty) { syncVenus(); layoutDirty = false; }
    dirty = false;
    paint();
    scheduleFrame();
  }

  /* 定时器负责限频，RAF只在即将绘制时申请；不在高刷屏上空转。 */
  function scheduleFrame() {
    if (raf || frameTimer || trans || document.hidden || modalOpen || (reduce && !dirty)) return;
    const interval = 1000 / 20;
    const wait = Math.max(0, interval - (performance.now() - lastFrame));
    frameTimer = setTimeout(() => {
      frameTimer = 0;
      if (document.hidden || modalOpen) return;
      raf = requestAnimationFrame(now => { raf = 0; frame(now); });
    }, wait);
  }

  function resetScheduler() {
    clearTimeout(frameTimer); frameTimer = 0;
    cancelAnimationFrame(raf); raf = 0;
    lastFrame = 0;
    if (document.hidden || modalOpen) settleTransition();
    if (astronomy.chinaDate(new Date()) !== skyDate) needsBuild = true;
    dirty = true;
    scheduleFrame();
  }

  updateControl(THEME);
  build();
  syncModal();
  scheduleFrame();
  document.addEventListener('visibilitychange', () => { resetScheduler(); refreshClock(); });
  setInterval(refreshClock, 60000);
  motion.addEventListener('change', e => {
    reduce = e.matches;
    settleTransition();
    resetScheduler();
  });
  const layoutChanged = () => {
    layoutDirty = dirty = true;
    scheduleFrame();
  };
  window.addEventListener('hashchange', settleTransition);
  window.addEventListener('scroll', () => {
    settleTransition();
    layoutChanged();
  }, { passive: true });
  let interruptedNavigation = null;
  document.addEventListener('pointerdown', e => {
    interruptedNavigation = null;
    if (!trans || toggle.contains(e.target)) return;
    // Named view-transition snapshots can hit HTML rather than the visible link.
    // Remember only a real navigation link at this position; never replay other controls.
    if (e.isPrimary && e.button === 0) {
      for (const link of document.querySelectorAll('header a[href^="#"]')) {
        const box = link.getBoundingClientRect();
        if (e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) {
          interruptedNavigation = { link, x: e.clientX, y: e.clientY, view: trans.view };
          break;
        }
      }
    }
    settleTransition();
  }, { passive: true });
  document.addEventListener('pointercancel', () => { interruptedNavigation = null; });
  document.addEventListener('click', e => {
    const navigation = interruptedNavigation;
    interruptedNavigation = null;
    if (!navigation || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (navigation.link.contains(e.target)) return; // Native navigation already works.
    const box = navigation.link.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) return;
    if (Math.hypot(e.clientX - navigation.x, e.clientY - navigation.y) > 12) return;
    const navigate = () => { if (navigation.link.isConnected) navigation.link.click(); };
    if (navigation.view) navigation.view.finished.then(navigate, navigate);
    else navigate();
  });
  const observer = new ResizeObserver(layoutChanged);
  observer.observe(control);
  if (header) observer.observe(header);
  if (document.fonts) document.fonts.ready.then(layoutChanged);
  window.addEventListener('resize', () => {
    settleTransition();
    needsBuild = dirty = true;
    scheduleFrame();
  });
})();
