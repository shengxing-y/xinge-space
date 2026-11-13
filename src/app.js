'use strict';
const $ = id => document.getElementById(id);
const names = {work:'工作札记', art:'画画手册', life:'生活碎片', music:'音乐手帖', diary:'私人日记'};
let state, view = 'home', filter = 'all', editing = null, reading = null, imageData = '', audioData = '', toastTimer, lastEntries = [], lbList = [], lbIndex = 0;
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function today(){const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function toast(message){$('toast').textContent=message; $('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
async function request(path, data){const options=data ? {method:'POST',headers:{'Content-Type':'application/json','X-Journal-Token':state.token},body:JSON.stringify(data)} : {};const r=await fetch(path,options);const result=await r.json();if(!r.ok)throw Error(result.error || '操作失败');return result;}
async function load(){state=await request('/api/state');$('bio').textContent=state.settings.bio;$('bilibili').hidden=!state.settings.bilibili;if(state.settings.bilibili)$('bilibili').href=state.settings.bilibili;$('set-bilibili').hidden=!!state.settings.bilibili;render();}
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
  entryRouter=EntryRoute.create({window,allowDiary:true,
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
    if(!$('reader').open&&EntryRoute.parse(location.hash,true).kind!=='list'&&!document.querySelector('dialog[open]'))entryRouter.close();
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
  button.onclick=()=>EntryShare.copy(state.entries.find(e=>e.id===reading),view);
  container.appendChild(button);return button;
}
function updateShare(entry){
  const top=$('reader').querySelector('.dialog-top');
  const actions=top.querySelector('.reader-actions')||document.createElement('div');
  actions.className='reader-actions';if(!actions.parentNode){const close=top.querySelector('.close');top.appendChild(actions);actions.appendChild(close);}
  const share=shareButton(actions,'reader-share');actions.prepend(share);share.hidden=!entry||entry.category==='diary';
  const caption=$('lightbox').querySelector('figcaption');const lb=shareButton(caption,'lb-share');lb.hidden=!entry||entry.category==='diary';
  $('edit').hidden=!entry;$('delete').hidden=!entry;
}
function openReader(id){entryRouter.open(id);}

const audioCache=new Map();
function toBlobURL(data){const i=data.indexOf(',');const bin=atob(data.slice(i+1));const u8=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)u8[j]=bin.charCodeAt(j);return URL.createObjectURL(new Blob([u8],{type:data.slice(5,i).split(';')[0]||'audio/mpeg'}));}
function audioURL(id,data){if(!data.startsWith('data:'))return data;const key=id+':'+data.length+':'+data.slice(-24);if(!audioCache.has(key))audioCache.set(key,toBlobURL(data));return audioCache.get(key);}
let playingId=null;
function playTrack(id){const e=state.entries.find(x=>x.id===id);if(!e||!e.audio)return;const pa=$('player-audio');if(playingId===id&&!pa.paused){pa.pause();return;}if(playingId!==id)pa.src=audioURL(e.id,e.audio);playingId=id;$('player-title').textContent=e.title;$('player').hidden=false;pa.play().catch(()=>{});}
function syncPlayButtons(){const on=id=>id===playingId&&!$('player-audio').paused;document.querySelectorAll('[data-play]').forEach(b=>{const p=on(b.dataset.play);b.classList.toggle('playing',p);b.textContent=p?'⏸':'▶';b.setAttribute('aria-label',p?'暂停':'播放');b.title=p?'暂停':'播放';});}
function render(){if(!state)return;$('intro').hidden=view!=='home';$('section-title').textContent=view==='home'?'最近留下的几页':names[view];$('section-kicker').textContent=({home:'RECENT PAGES / 近来',work:'WORK NOTES / 所作',art:'SKETCHBOOK / 所绘',life:'LIFE MOMENTS / 所见',music:'MUSIC NOTES / 所寄',diary:'PRIVATE PAGES / 所思'})[view];$('filters').hidden=view!=='home';$('diary-note').hidden=view!=='diary';document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+view));document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));const q=$('search').value.trim().toLowerCase();const month=$('month').value;const entries=state.entries.filter(e=>(view==='home'?e.category!=='diary'&&(filter==='all'||e.category===filter):e.category===view)&&(!month||e.day.startsWith(month))&&(!q||`${e.title} ${e.body} ${e.tags}`.toLowerCase().includes(q)));entries.splice(0,entries.length,...EntryPresentation.ordered(entries,view==='home'));$('count').textContent=`${entries.length} 页随录`;lastEntries=entries;renderEcho();renderHeatmap();
 const liveAudio=new Set(state.entries.filter(e=>e.audio).map(e=>e.id+':'+e.audio.length+':'+e.audio.slice(-24)));for(const k of audioCache.keys())if(!liveAudio.has(k)){URL.revokeObjectURL(audioCache.get(k));audioCache.delete(k);}
 const ch=$('channel-link');const chUrl=view==='art'?state.settings.xiaohongshu:view==='music'?state.settings.netease:'';ch.hidden=!chUrl;if(chUrl){ch.href=chUrl;ch.className='channel-link '+(view==='art'?'cat-art':'cat-music');$('cl-seal').textContent=view==='art'?'红':'云';$('cl-name').textContent=view==='art'?'小红书':'网易云音乐';$('cl-hint').textContent=view==='art'?'画儿都在小红书 →':'歌儿都在网易云 →';}
 $('entries').innerHTML=entries.length?entries.map(e=>EntryPresentation.card(e,names)).join(''):`<div class="empty"><h3>${q||month?'未寻到这一页':view==='music'?'谱架已备，静待发声':view==='art'?'画桌已备，静待落笔':view==='diary'?'一页空笺，留给自己':'此处尚有留白'}</h3><p>${q||month?'换个关键词，或清空月份再找找。':'从今天开始，存下一点所作、所见、所思、所声。'}</p><button class="primary" id="empty-action">${q||month?'清除筛选':'写下第一笔'}</button></div>`;
 renderFeatured();bindCards($('entries'));const action=$('empty-action');if(action)action.onclick=()=>{if(q||month){$('search').value='';$('month').value='';render();}else openEditor();};syncPlayButtons();
}
function bindCards(container){
  container.querySelectorAll('.entry-open').forEach(b=>b.onclick=()=>openReader(b.closest('.entry').dataset.id));
  container.querySelectorAll('[data-play]').forEach(b=>b.onclick=e=>{e.stopPropagation();playTrack(b.dataset.play);});
}
function renderFeatured(){
  const entries=EntryPresentation.selections(state.entries);
  $('featured').hidden=view!=='home'||!entries.length;
  $('featured-entries').innerHTML=entries.map(e=>EntryPresentation.card(e,names)).join('');
  bindCards($('featured-entries'));
}
function renderEcho(){if(!state)return;const el=$('echo');const now=new Date();const md=`${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const past=state.entries.filter(e=>e.category!=='diary'&&e.day.slice(5)===md&&e.day<`${now.getFullYear()}-`);el.hidden=false;if(!past.length){$('echo-kicker').textContent='往年今日';$('echo-entry').hidden=true;$('echo-null').hidden=false;$('echo-null').textContent='往年的这一天还没有记录——写完今天，明年这里会响起回声。';return;}const pick=past[(now.getDate()+now.getMonth())%past.length];const years=now.getFullYear()-Number(pick.day.slice(0,4));$('echo-kicker').textContent=`${years>1?years+' 年前的今天':'去年的今天'} · ${pick.day.replaceAll('-','.')}`;$('echo-null').hidden=true;const btn=$('echo-entry');btn.hidden=false;btn.dataset.id=pick.id;btn.innerHTML=`<span class="echo-cat cat-${pick.category}">${names[pick.category]}</span><strong>${esc(pick.title)}</strong>`;}
function renderHeatmap(){ActivityStarMap.render(state.entries);}
function openEditor(entry){editing=entry?.id||null;$('pinned').checked=entry?.pinned===true||entry?.pinned===1;$('featured-check').checked=entry?.featured===true||entry?.featured===1;imageData=entry?.image||'';audioData=entry?.audio||'';$('audio-file').value='';audioPreview();$('editor-title').textContent=entry?'续写这一页':'记一笔';$('category').value=entry?.category||(view==='home'?(filter==='all'?'work':filter):view);$('title').value=entry?.title||'';$('day').value=entry?.day||today();$('body').value=entry?.body||'';$('tags').value=entry?.tags||'';$('image-file').value='';$('medium').value=entry?.medium||'';$('size').value=entry?.size||'';toggleArtFields();$('editor-error').textContent='';preview();$('editor').showModal();}
function toggleArtFields(){const privateEntry=$('category').value==='diary';for(const id of ['pinned','featured-check']){$(id).disabled=privateEntry;if(privateEntry)$(id).checked=false;}$('art-fields').hidden=$('category').value!=='art';$('audio-fields').hidden=$('category').value!=='music';}
let editorAudioURL=null;
function audioPreview(){$('audio-preview').hidden=!audioData;$('remove-audio').hidden=!audioData;if(editorAudioURL){URL.revokeObjectURL(editorAudioURL);editorAudioURL=null;}if(audioData){if(audioData.startsWith('data:')){editorAudioURL=toBlobURL(audioData);$('audio-preview').src=editorAudioURL;}else $('audio-preview').src=audioData;}else $('audio-preview').removeAttribute('src');}
function preview(){$('image-preview').hidden=!imageData;$('remove-image').hidden=!imageData;if(imageData)$('image-preview').src=imageData;else $('image-preview').removeAttribute('src');}
function showReader(id){const e=state.entries.find(x=>x.id===id);if(!e){showMissing();return;}reading=id;updateShare(e);if(e.image&&!e.audio){openLightbox(id);return;}dismissLightbox();$('reader-meta').textContent=`${names[e.category]} / ${e.day}${e.medium?` / ${e.medium}`:''}${e.size?` / ${e.size}`:''}`;$('reader-title').textContent=e.title;$('reader-body').textContent=e.body;$('reader-tags').textContent=e.tags;$('reader-image').hidden=!e.image;if(e.image)$('reader-image').src=e.image;else $('reader-image').removeAttribute('src');syncPlayButtons();ReaderView.open($('reader'),id);}
function openLightbox(id){
  dismissReader();
  lbList=lastEntries.filter(e=>e.image&&!e.audio);
  const target=state.entries.find(e=>e.id===id);
  if(!lbList.some(e=>e.id===id))lbList=target?[target]:[];
  lbIndex=lbList.findIndex(e=>e.id===id);if(lbIndex<0){showMissing();return;}
  renderLightbox();$('lightbox').hidden=false;$('lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}

function renderLightbox(){const e=lbList[lbIndex];if(!e){closeLightbox();return;}reading=e.id;updateShare(e);const img=$('lb-image');img.src=e.image;img.alt=e.title;img.classList.remove('lb-in');void img.offsetWidth;img.classList.add('lb-in');const meta=$('lb-meta');meta.className='lb-meta cat-'+e.category;meta.textContent=[names[e.category],e.day.replaceAll('-','.'),e.medium,e.size].filter(Boolean).join(' · ');$('lb-title').textContent=e.title;$('lb-tags').textContent=e.tags?e.tags.split(/[,，]/).filter(Boolean).map(t=>'# '+t.trim()).join('　'):'';$('lb-count').textContent=lbList.length>1?`${lbIndex+1} / ${lbList.length}`:'';}
function stepLightbox(d){if(lbList.length)entryRouter.replace(lbList[(lbIndex+d+lbList.length)%lbList.length].id);}
function dismissLightbox(){if(!$('lightbox').hidden){$('lightbox').hidden=true;$('lightbox').classList.remove('open');if(document.body.style.position!=='fixed')document.body.style.overflow='';$('lb-image').removeAttribute('src');$('lightbox').dispatchEvent(new Event('lightboxclose'));}}
function closeLightbox(){dismissLightbox();if(entryRouter&&EntryRoute.parse(location.hash,true).kind==='entry')entryRouter.close();}

function confirmAction(title,message){return new Promise(resolve=>{const d=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-message').textContent=message;const finish=value=>{d.close();resolve(value);};$('confirm-yes').onclick=()=>finish(true);$('confirm-no').onclick=()=>finish(false);d.oncancel=()=>resolve(false);d.showModal();});}
function profile(){$('bio-input').value=state.settings.bio||'';$('bilibili-input').value=state.settings.bilibili||'';$('xiaohongshu-input').value=state.settings.xiaohongshu||'';$('netease-input').value=state.settings.netease||'';$('profile-error').textContent='';$('profile-dialog').showModal();}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$('new').onclick=()=>openEditor();$('profile').onclick=profile;$('set-bilibili').onclick=profile;$('search').oninput=render;$('month').oninput=render;document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
$('category').onchange=toggleArtFields;
$('echo-entry').onclick=()=>openReader($('echo-entry').dataset.id);
$('lightbox').addEventListener('click',e=>{if(e.target===$('lightbox'))closeLightbox();});
document.querySelector('[data-lb="close"]').onclick=closeLightbox;
document.querySelector('[data-lb="prev"]').onclick=()=>stepLightbox(-1);
document.querySelector('[data-lb="next"]').onclick=()=>stepLightbox(1);
$('lb-edit').onclick=()=>{const entry=state.entries.find(e=>e.id===reading);entryRouter.clear();dismissLightbox();openEditor(entry);};
document.addEventListener('keydown',e=>{if($('lightbox').hidden||document.querySelector('dialog[open]'))return;if(e.key==='Escape')closeLightbox();else if(e.key==='ArrowLeft')stepLightbox(-1);else if(e.key==='ArrowRight')stepLightbox(1);});
$('image-file').onchange=async()=>{const file=$('image-file').files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>8*1024*1024){$('editor-error').textContent='请选择不超过 8 MB 的 PNG、JPG、WebP 或 GIF 图片。';$('image-file').value='';return;}try{imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});$('editor-error').textContent='';preview();}catch(e){$('editor-error').textContent=e.message;}};
$('remove-image').onclick=()=>{imageData='';$('image-file').value='';preview();};
$('audio-file').onchange=async()=>{const file=$('audio-file').files[0];if(!file)return;if(!file.type.startsWith('audio/')||file.size>12*1024*1024){$('editor-error').textContent='请选择不超过 12 MB 的 MP3、WAV、OGG、FLAC 或 M4A 音频。';$('audio-file').value='';return;}try{audioData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('音频读取失败'));reader.readAsDataURL(file);});$('editor-error').textContent='';audioPreview();}catch(e){$('editor-error').textContent=e.message;}};
document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause();});},true);
$('player-audio').addEventListener('play',syncPlayButtons);
$('player-audio').addEventListener('pause',syncPlayButtons);
$('player-close').onclick=()=>{$('player-audio').pause();$('player').hidden=true;playingId=null;syncPlayButtons();};
$('remove-audio').onclick=()=>{audioData='';$('audio-file').value='';audioPreview();};
$('entry-form').onsubmit=async event=>{event.preventDefault();$('save').disabled=true;try{const category=$('category').value;await request('/api/save',{id:editing,category,pinned:category!=='diary'&&$('pinned').checked,featured:category!=='diary'&&$('featured-check').checked,title:$('title').value.trim(),day:$('day').value,body:$('body').value,tags:$('tags').value,image:imageData,audio:audioData.startsWith('/api/')?'@keep':audioData,medium:category==='art'?$('medium').value.trim():'',size:category==='art'?$('size').value.trim():''});await load();if(category==='diary'&&view!=='diary')location.hash='diary';$('editor').close();toast('这一页，已存好。');}catch(e){$('editor-error').textContent=e.message;}finally{$('save').disabled=false;}};
$('edit').onclick=()=>{const entry=state.entries.find(e=>e.id===reading);entryRouter.clear();$('reader').close();openEditor(entry);};
$('delete').onclick=async()=>{const id=reading;if(!await confirmAction('删除这一页？','删除后无法撤销。如果想留下副本，请先导出备份。'))return;try{await request('/api/delete',{id});await load();$('reader').close();entryRouter.leave();toast('已删除这一页。');}catch(e){toast(e.message);}};
$('profile-form').onsubmit=async event=>{event.preventDefault();try{await request('/api/settings',{bio:$('bio-input').value.trim(),bilibili:$('bilibili-input').value.trim(),xiaohongshu:$('xiaohongshu-input').value.trim(),netease:$('netease-input').value.trim()});$('profile-dialog').close();await load();toast('名片已更新。');}catch(e){$('profile-error').textContent=e.message;}};
$('export').onclick=async()=>{try{const backup=await request('/api/export');const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`心歌随录-备份-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份含私人日记，请妥善保管。');}catch(e){toast(e.message);}};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{const file=$('import-file').files[0];if(!file)return;try{if(file.size>64*1024*1024)throw Error('备份超过 64 MB，请拆分后导入。');const backup=JSON.parse(await file.text());if(!await confirmAction('导入这份备份？','将合并记录，同编号记录和个人名片以备份为准。建议先导出当前内容。'))return;await request('/api/import',backup);await load();toast('备份已导入。');}catch(e){toast(e.message);}finally{$('import-file').value='';}};
function registerLocalTool(){
 const context=document.modelContext;
 if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 try{Promise.resolve(context.registerTool({name:'start_journal_entry',title:'开始写一页随录',description:'打开本地随录编辑器并选择栏目，不保存记录。',inputSchema:{type:'object',properties:{category:{type:'string',enum:['work','art','life','diary']}},required:['category'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Object.hasOwn(names,input.category))throw Error('请选择有效栏目');if($('editor').open)throw Error('已有打开的编辑器，请先保存或关闭');openEditor();$('category').value=input.category;return {opened:true,category:input.category};}},{signal:lifecycle.signal})).catch(()=>{});}catch{/* 普通浏览器不支持时保留正常界面。 */}
}
load().then(()=>{startEntryRoutes();registerLocalTool();}).catch(e=>{$('entries').innerHTML='<div class="empty"><h3>暂时无法读取手记</h3><p>请确认本地服务已启动，然后刷新页面。</p></div>';toast(e.message);});

setInterval(()=>{if(!document.hidden&&state)renderHeatmap();},60000);
