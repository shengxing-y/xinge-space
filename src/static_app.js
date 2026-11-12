'use strict';
/* 心歌随录 · 静态展示版（由 export_static.py 生成站点时内嵌，只读，无日记） */
const $ = id => document.getElementById(id);
const names = {work:'工作札记', art:'画画手册', life:'生活碎片', music:'音乐手帖'};
const DATA = window.__DATA__;
let view = 'home', filter = 'all', lbList = [], lbIndex = 0, lastEntries = [], reading = null;
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const audioCache=new Map();
function toBlobURL(data){const i=data.indexOf(',');const bin=atob(data.slice(i+1));const u8=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)u8[j]=bin.charCodeAt(j);return URL.createObjectURL(new Blob([u8],{type:data.slice(5,i).split(';')[0]||'audio/mpeg'}));}
function audioURL(id,data){if(!data.startsWith('data:'))return data;const key=id+':'+data.length+':'+data.slice(-24);if(!audioCache.has(key))audioCache.set(key,toBlobURL(data));return audioCache.get(key);}
let playingId=null;
function playTrack(id){const e=DATA.entries.find(x=>x.id===id);if(!e||!e.audio)return;const pa=$('player-audio');if(playingId===id&&!pa.paused){pa.pause();return;}if(playingId!==id)pa.src=audioURL(e.id,e.audio);playingId=id;$('player-title').textContent=e.title;$('player').hidden=false;pa.play().catch(()=>{});}
function syncPlayButtons(){const on=id=>id===playingId&&!$('player-audio').paused;document.querySelectorAll('[data-play]').forEach(b=>{const p=on(b.dataset.play);b.classList.toggle('playing',p);b.textContent=p?'⏸':'▶';b.setAttribute('aria-label',p?'暂停':'播放');b.title=p?'暂停':'播放';});}

function route(){view=location.hash.slice(1);if(!['home',...Object.keys(names)].includes(view))view='home';filter='all';$('search').value='';$('month').value='';render();}
function render(){
  $('intro').hidden=view!=='home';
  $('section-title').textContent=view==='home'?'最近留下的几页':names[view];
  $('section-kicker').textContent=({home:'RECENT PAGES / 近来',work:'WORK NOTES / 所作',art:'SKETCHBOOK / 所绘',life:'LIFE MOMENTS / 所见',music:'MUSIC NOTES / 所寄'})[view];
  $('filters').hidden=view!=='home';
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+view));
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
  const q=$('search').value.trim().toLowerCase(), month=$('month').value;
  const entries=DATA.entries.filter(e=>(view==='home'?(filter==='all'||e.category===filter):e.category===view)&&(!month||e.day.startsWith(month))&&(!q||`${e.title} ${e.body} ${e.tags}`.toLowerCase().includes(q)));
  $('count').textContent=`${entries.length} 页随录`;
  lastEntries=entries;renderEcho();renderHeatmap();
  const ch=$('channel-link');const chUrl=view==='art'?DATA.settings.xiaohongshu:view==='music'?DATA.settings.netease:'';ch.hidden=!chUrl;if(chUrl){ch.href=chUrl;ch.className='channel-link '+(view==='art'?'cat-art':'cat-music');$('cl-seal').textContent=view==='art'?'红':'云';$('cl-name').textContent=view==='art'?'小红书':'网易云音乐';$('cl-hint').textContent=view==='art'?'画儿都在小红书 →':'歌儿都在网易云 →';}
  $('entries').innerHTML=entries.length?entries.map(e=>`<article class="entry cat-${e.category}${e.image?' framed':''}" data-id="${esc(e.id)}"><button type="button" class="entry-open" aria-label="阅读：${esc(e.title)}"></button>${e.image?`<img src="${esc(e.image)}" alt="${esc(e.title)}" loading="lazy">`:''}<div class="entry-meta"><span class="entry-category">${names[e.category]}</span><time>${esc(e.day.replaceAll('-','.'))}</time></div><h3>${esc(e.title)}</h3><p>${esc(e.body||(e.category==='music'?'这一页，留给一段旋律。':'这一页，留给一张图。'))}</p><div class="entry-bottom"><span class="tags">${esc(e.tags.split(/[,，]/).filter(Boolean).map(t=>'# '+t.trim()).join('　'))}</span>${e.audio?`<button class="card-play" data-play="${esc(e.id)}"></button>`:''}</div></article>`).join(''):`<div class="empty"><h3>${q||month?'未寻到这一页':view==='music'?'谱架已备，静待发声':view==='art'?'画桌已备，静待落笔':'此处尚有留白'}</h3><p>${q||month?'换个关键词，或清空月份再找找。':'从今天开始，存下一点所作、所见、所思、所声。'}</p><button class="primary" id="empty-action">${q||month?'清除筛选':'回到全部'}</button></div>`;
  $('entries').querySelectorAll('.entry-open').forEach(b=>b.onclick=()=>openReader(b.closest('.entry').dataset.id));
  $('entries').querySelectorAll('.card-play').forEach(b=>b.onclick=e=>{e.stopPropagation();playTrack(b.dataset.play);});
  const action=$('empty-action');if(action)action.onclick=()=>{if(q||month){$('search').value='';$('month').value='';render();}else{filter='all';render();}};syncPlayButtons();
}
function renderEcho(){const el=$('echo');const now=new Date();const md=`${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const past=DATA.entries.filter(e=>e.day.slice(5)===md&&e.day<`${now.getFullYear()}-`);el.hidden=false;if(!past.length){$('echo-kicker').textContent='往年今日';$('echo-entry').hidden=true;$('echo-null').hidden=false;$('echo-null').textContent='往年的这一天，心歌还没有落笔。';return;}const pick=past[(now.getDate()+now.getMonth())%past.length];const years=now.getFullYear()-Number(pick.day.slice(0,4));$('echo-kicker').textContent=`${years>1?years+' 年前的今天':'去年的今天'} · ${pick.day.replaceAll('-','.')}`;$('echo-null').hidden=true;const btn=$('echo-entry');btn.hidden=false;btn.dataset.id=pick.id;btn.innerHTML=`<span class="echo-cat cat-${pick.category}">${names[pick.category]}</span><strong>${esc(pick.title)}</strong>`;}
function renderHeatmap(){ActivityStarMap.render(DATA.entries);}
function openReader(id){reading=id;const e=DATA.entries.find(e=>e.id===id);if(e.image&&!e.audio){openLightbox(id);return;}$('reader-meta').textContent=`${names[e.category]} / ${e.day}${e.medium?` / ${e.medium}`:''}${e.size?` / ${e.size}`:''}`;$('reader-title').textContent=e.title;$('reader-body').textContent=e.body;$('reader-tags').textContent=e.tags;$('reader-image').hidden=!e.image;if(e.image)$('reader-image').src=e.image;else $('reader-image').removeAttribute('src');syncPlayButtons();ReaderView.open($('reader'),id);}
function openLightbox(id){lbList=lastEntries.filter(e=>e.image);const i=lbList.findIndex(e=>e.id===id);lbIndex=i<0?0:i;renderLightbox();$('lightbox').hidden=false;requestAnimationFrame(()=>$('lightbox').classList.add('open'));document.body.style.overflow='hidden';}
function renderLightbox(){const e=lbList[lbIndex];if(!e){closeLightbox();return;}const img=$('lb-image');img.src=e.image;img.alt=e.title;img.classList.remove('lb-in');void img.offsetWidth;img.classList.add('lb-in');const meta=$('lb-meta');meta.className='lb-meta cat-'+e.category;meta.textContent=[names[e.category],e.day.replaceAll('-','.'),e.medium,e.size].filter(Boolean).join(' · ');$('lb-title').textContent=e.title;$('lb-tags').textContent=e.tags?e.tags.split(/[,，]/).filter(Boolean).map(t=>'# '+t.trim()).join('　'):'';$('lb-count').textContent=lbList.length>1?`${lbIndex+1} / ${lbList.length}`:'';}
function stepLightbox(d){lbIndex=(lbIndex+d+lbList.length)%lbList.length;renderLightbox();}
function closeLightbox(){$('lightbox').classList.remove('open');document.body.style.overflow='';setTimeout(()=>{$('lightbox').hidden=true;$('lb-image').removeAttribute('src');},300);}

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
$('search').oninput=render;$('month').oninput=render;window.onhashchange=route;
$('player-audio').addEventListener('play',syncPlayButtons);
$('player-audio').addEventListener('pause',syncPlayButtons);
$('player-close').onclick=()=>{$('player-audio').pause();$('player').hidden=true;playingId=null;syncPlayButtons();};
$('echo-entry').onclick=()=>openReader($('echo-entry').dataset.id);
$('lightbox').addEventListener('click',e=>{if(e.target===$('lightbox'))closeLightbox();});
document.querySelector('[data-lb="close"]').onclick=closeLightbox;
document.querySelector('[data-lb="prev"]').onclick=()=>stepLightbox(-1);
document.querySelector('[data-lb="next"]').onclick=()=>stepLightbox(1);
document.addEventListener('keydown',e=>{if($('lightbox').hidden)return;if(e.key==='Escape')closeLightbox();else if(e.key==='ArrowLeft')stepLightbox(-1);else if(e.key==='ArrowRight')stepLightbox(1);});
$('bio').textContent=DATA.settings.bio||'';
if(DATA.settings.bilibili){const a=$('bilibili');a.href=DATA.settings.bilibili;a.hidden=false;}
route();

setInterval(()=>{if(!document.hidden)renderHeatmap();},60000);
