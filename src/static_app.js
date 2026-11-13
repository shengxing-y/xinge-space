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

let entryRouter, readerRouteCloses=0;
function dismissReader(){if($('reader').open){readerRouteCloses++;$('reader').close();}}
function route(){if(entryRouter)entryRouter.start();}
function applyList(context){
  dismissReader();
  dismissLightbox();
  view=context.view||'home';filter=context.filter||'all';
  $('search').value=context.search||'';$('month').value=context.month||'';
  render();
  if(Number.isFinite(context.scrollY))requestAnimationFrame(()=>window.scrollTo({top:context.scrollY,behavior:'instant'}));
}
function startEntryRoutes(){
  entryRouter=EntryRoute.create({window,allowDiary:false,
    getContext:()=>({view,filter,search:$('search').value,month:$('month').value,scrollY:window.scrollY}),
    onList:applyList,
    onEntry:(id,from,context)=>{
      if(view!==from||filter!==(context?.filter||'all')||$('search').value!==(context?.search||'')||$('month').value!==(context?.month||'')||!$('entries').children.length){view=from;filter=context?.filter||'all';$('search').value=context?.search||'';$('month').value=context?.month||'';render();}
      showReader(id);
    },
    onMissing:()=>showMissing()
  });
  $('reader').addEventListener('close',()=>{
    if(readerRouteCloses){readerRouteCloses--;return;}
    if(!$('reader').open&&EntryRoute.parse(location.hash,false).kind!=='list'&&!document.querySelector('dialog[open]'))entryRouter.close();
  });
  entryRouter.start();
}
function showMissing(){
  dismissLightbox();reading=null;
  $('reader-meta').textContent='链接暂不可用';$('reader-title').textContent='这一页不存在或尚未公开';
  $('reader-body').textContent='它可能已被移除，或还没有导出到当前网站。关闭后可返回栏目继续浏览。';
  $('reader-tags').textContent='';$('reader-image').hidden=true;
  updateShare(null);
  ReaderView.open($('reader'),'');
}
function shareButton(container,id){
  let button=$(id);if(button)return button;
  button=document.createElement('button');button.type='button';button.id=id;button.className='entry-share';button.textContent='复制链接';
  button.onclick=()=>EntryShare.copy(DATA.entries.find(e=>e.id===reading),view);
  container.appendChild(button);return button;
}
function updateShare(entry){
  const top=$('reader').querySelector('.dialog-top');
  const actions=top.querySelector('.reader-actions')||document.createElement('div');
  actions.className='reader-actions';if(!actions.parentNode){const close=top.querySelector('.close');top.appendChild(actions);actions.appendChild(close);}
  const share=shareButton(actions,'reader-share');actions.prepend(share);share.hidden=!entry||entry.category==='diary';
  const caption=$('lightbox').querySelector('figcaption');const lb=shareButton(caption,'lb-share');lb.hidden=!entry||entry.category==='diary';

}
function openReader(id){entryRouter.open(id);}

function render(){
  $('intro').hidden=view!=='home';
  $('section-title').textContent=view==='home'?'最近留下的几页':names[view];
  $('section-kicker').textContent=({home:'RECENT PAGES / 近来',work:'WORK NOTES / 所作',art:'SKETCHBOOK / 所绘',life:'LIFE MOMENTS / 所见',music:'MUSIC NOTES / 所寄'})[view];
  $('filters').hidden=view!=='home';
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+view));
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
  const q=$('search').value.trim().toLowerCase(), month=$('month').value;
  const entries=DATA.entries.filter(e=>(view==='home'?(filter==='all'||e.category===filter):e.category===view)&&(!month||e.day.startsWith(month))&&(!q||`${e.title} ${e.body} ${e.tags}`.toLowerCase().includes(q)));
  entries.splice(0,entries.length,...EntryPresentation.ordered(entries,view==='home'));$('count').textContent=`${entries.length} 页随录`;
  lastEntries=entries;renderEcho();renderHeatmap();
  const ch=$('channel-link');const chUrl=view==='art'?DATA.settings.xiaohongshu:view==='music'?DATA.settings.netease:'';ch.hidden=!chUrl;if(chUrl){ch.href=chUrl;ch.className='channel-link '+(view==='art'?'cat-art':'cat-music');$('cl-seal').textContent=view==='art'?'红':'云';$('cl-name').textContent=view==='art'?'小红书':'网易云音乐';$('cl-hint').textContent=view==='art'?'画儿都在小红书 →':'歌儿都在网易云 →';}
  $('entries').innerHTML=entries.length?entries.map(e=>EntryPresentation.card(e,names)).join(''):`<div class="empty"><h3>${q||month?'未寻到这一页':view==='music'?'谱架已备，静待发声':view==='art'?'画桌已备，静待落笔':'此处尚有留白'}</h3><p>${q||month?'换个关键词，或清空月份再找找。':'从今天开始，存下一点所作、所见、所思、所声。'}</p><button class="primary" id="empty-action">${q||month?'清除筛选':'回到全部'}</button></div>`;
  renderFeatured();bindCards($('entries'));const action=$('empty-action');if(action)action.onclick=()=>{if(q||month){$('search').value='';$('month').value='';render();}else{filter='all';render();}};syncPlayButtons();
}
function bindCards(container){
  container.querySelectorAll('.entry-open').forEach(b=>b.onclick=()=>openReader(b.closest('.entry').dataset.id));
  container.querySelectorAll('[data-play]').forEach(b=>b.onclick=e=>{e.stopPropagation();playTrack(b.dataset.play);});
}
function renderFeatured(){
  const entries=EntryPresentation.selections(DATA.entries);
  $('featured').hidden=view!=='home'||!entries.length;
  $('featured-entries').innerHTML=entries.map(e=>EntryPresentation.card(e,names)).join('');
  bindCards($('featured-entries'));
}
function renderEcho(){const el=$('echo');const now=new Date();const md=`${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const past=DATA.entries.filter(e=>e.day.slice(5)===md&&e.day<`${now.getFullYear()}-`);el.hidden=false;if(!past.length){$('echo-kicker').textContent='往年今日';$('echo-entry').hidden=true;$('echo-null').hidden=false;$('echo-null').textContent='往年的这一天，心歌还没有落笔。';return;}const pick=past[(now.getDate()+now.getMonth())%past.length];const years=now.getFullYear()-Number(pick.day.slice(0,4));$('echo-kicker').textContent=`${years>1?years+' 年前的今天':'去年的今天'} · ${pick.day.replaceAll('-','.')}`;$('echo-null').hidden=true;const btn=$('echo-entry');btn.hidden=false;btn.dataset.id=pick.id;btn.innerHTML=`<span class="echo-cat cat-${pick.category}">${names[pick.category]}</span><strong>${esc(pick.title)}</strong>`;}
function renderHeatmap(){ActivityStarMap.render(DATA.entries);}
function showReader(id){const e=DATA.entries.find(x=>x.id===id);if(!e||e.category==='diary'){showMissing();return;}reading=id;updateShare(e);if(e.image&&!e.audio){openLightbox(id);return;}dismissLightbox();$('reader-meta').textContent=`${names[e.category]} / ${e.day}${e.medium?` / ${e.medium}`:''}${e.size?` / ${e.size}`:''}`;$('reader-title').textContent=e.title;$('reader-body').textContent=e.body;$('reader-tags').textContent=e.tags;$('reader-image').hidden=!e.image;if(e.image)$('reader-image').src=e.image;else $('reader-image').removeAttribute('src');syncPlayButtons();ReaderView.open($('reader'),id);}
function openLightbox(id){
  dismissReader();
  lbList=lastEntries.filter(e=>e.image&&!e.audio);
  const target=DATA.entries.find(e=>e.id===id);
  if(!lbList.some(e=>e.id===id))lbList=target?[target]:[];
  lbIndex=lbList.findIndex(e=>e.id===id);if(lbIndex<0){showMissing();return;}
  renderLightbox();$('lightbox').hidden=false;$('lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}

function renderLightbox(){const e=lbList[lbIndex];if(!e){closeLightbox();return;}reading=e.id;updateShare(e);const img=$('lb-image');img.src=e.image;img.alt=e.title;img.classList.remove('lb-in');void img.offsetWidth;img.classList.add('lb-in');const meta=$('lb-meta');meta.className='lb-meta cat-'+e.category;meta.textContent=[names[e.category],e.day.replaceAll('-','.'),e.medium,e.size].filter(Boolean).join(' · ');$('lb-title').textContent=e.title;$('lb-tags').textContent=e.tags?e.tags.split(/[,，]/).filter(Boolean).map(t=>'# '+t.trim()).join('　'):'';$('lb-count').textContent=lbList.length>1?`${lbIndex+1} / ${lbList.length}`:'';}
function stepLightbox(d){if(lbList.length)entryRouter.replace(lbList[(lbIndex+d+lbList.length)%lbList.length].id);}
function dismissLightbox(){if(!$('lightbox').hidden){$('lightbox').hidden=true;$('lightbox').classList.remove('open');if(document.body.style.position!=='fixed')document.body.style.overflow='';$('lb-image').removeAttribute('src');$('lightbox').dispatchEvent(new Event('lightboxclose'));}}
function closeLightbox(){dismissLightbox();if(entryRouter&&EntryRoute.parse(location.hash,false).kind==='entry')entryRouter.close();}


document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
$('search').oninput=render;$('month').oninput=render;
$('player-audio').addEventListener('play',syncPlayButtons);
$('player-audio').addEventListener('pause',syncPlayButtons);
$('player-close').onclick=()=>{$('player-audio').pause();$('player').hidden=true;playingId=null;syncPlayButtons();};
$('echo-entry').onclick=()=>openReader($('echo-entry').dataset.id);
$('lightbox').addEventListener('click',e=>{if(e.target===$('lightbox'))closeLightbox();});
document.querySelector('[data-lb="close"]').onclick=closeLightbox;
document.querySelector('[data-lb="prev"]').onclick=()=>stepLightbox(-1);
document.querySelector('[data-lb="next"]').onclick=()=>stepLightbox(1);
document.addEventListener('keydown',e=>{if($('lightbox').hidden||document.querySelector('dialog[open]'))return;if(e.key==='Escape')closeLightbox();else if(e.key==='ArrowLeft')stepLightbox(-1);else if(e.key==='ArrowRight')stepLightbox(1);});
$('bio').textContent=DATA.settings.bio||'';
if(DATA.settings.bilibili){const a=$('bilibili');a.href=DATA.settings.bilibili;a.hidden=false;}
startEntryRoutes();

setInterval(()=>{if(!document.hidden)renderHeatmap();},60000);
