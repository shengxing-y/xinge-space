/* Share the current deployment URL; never invent a public site for local content. */
(function (root) {
  'use strict';
  function localAddress(url) {
    const host = url.hostname.toLowerCase();
    return url.protocol === 'file:' || host === 'localhost' || host.endsWith('.localhost') ||
      host === '[::1]' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local');
  }
  async function copy(entry, from) {
    if (!entry || entry.category === 'diary') return;
    const doc = document, url = new URL(location.href);
    url.hash = EntryRoute.encode(entry.id, from);
    const text = url.href;
    const note = localAddress(url) ? '这是本地地址，不能作为公网分享链接。上线后请在网站上复制链接。' : '复制此链接即可直达这篇内容。';
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      let status = doc.getElementById('share-status');
      if (!status) {
        status = doc.createElement('div'); status.id = 'share-status'; status.setAttribute('role', 'status');
        doc.body.appendChild(status);
      }
      status.textContent = localAddress(url) ? '已复制本地链接；仅本机／局域网可用。' : '文章链接已复制。';
      status.hidden = false;
      clearTimeout(status.hideTimer);
      status.hideTimer = setTimeout(() => { status.hidden = true; }, 4000);
    } catch (e) {
      let dialog = doc.getElementById('share-dialog');
      if (!dialog) {
        dialog = doc.createElement('dialog'); dialog.id = 'share-dialog';
        dialog.setAttribute('aria-labelledby', 'share-title');
        const title = doc.createElement('h2'); title.id = 'share-title'; title.textContent = '复制文章链接';
        const description = doc.createElement('p'); description.className = 'share-note';
        const input = doc.createElement('input'); input.type = 'text'; input.readOnly = true; input.setAttribute('aria-label', '文章链接');
        const close = doc.createElement('button'); close.type = 'button'; close.className = 'primary'; close.textContent = '完成'; close.onclick = () => dialog.close();
        dialog.append(title, description, input, close); doc.body.appendChild(dialog);
      }
      dialog.querySelector('p').textContent = note + ' 浏览器未允许自动复制，请选中后手动复制。';
      const input = dialog.querySelector('input'); input.value = text;
      dialog.showModal(); input.focus(); input.select();
    }
  }
  root.EntryShare = { copy, localAddress };
}(typeof globalThis !== 'undefined' ? globalThis : this));
