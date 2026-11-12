/* Theme scheduling uses the visitor's wall clock, not the fixed sky observer. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThemePolicy = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const valid = theme => theme === 'dawn' || theme === 'vesper';
  function automatic(now = new Date()) {
    return now.getHours() < 6 ? 'dawn' : 'vesper';
  }
  function restore(storage, now = new Date()) {
    try {
      const theme = storage.getItem('xj-theme');
      const mode = storage.getItem('xj-theme-manual');
      // Before explicit modes existed, a stored theme was a manual selection.
      if (valid(theme) && (mode === '1' || mode === null)) return { manual: true, theme };
    } catch (e) {}
    return { manual: false, theme: automatic(now) };
  }
  function save(storage, manual, theme) {
    try {
      storage.setItem('xj-theme-manual', manual ? '1' : '0');
      storage.setItem('xj-theme', theme);
    } catch (e) {}
  }
  function formatTime(time) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(time));
  }
  return { automatic, restore, save, formatTime };
}));
