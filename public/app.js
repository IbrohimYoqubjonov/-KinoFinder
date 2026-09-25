import { messages } from './i18n.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageOk = true;
function load(key,fallback) { try { return JSON.parse(localStorage.getItem(`kf:${key}`)) ?? fallback; } catch { storageOk = false; return fallback; } }
function persist(key,value) { try { localStorage.setItem(`kf:${key}`,JSON.stringify(value)); } catch { storageOk = false; toast(t('localWarning')); } }
let language = load('language','uz');
if (!messages[language]) language = 'uz';
let history = load('history',[]), saved = load('saved',[]);
if (!Array.isArray(history)) history = [];
if (!Array.isArray(saved)) saved = [];
history = history.filter(x => x && typeof x.id === 'string' && Array.isArray(x.candidates)).slice(0,30);
saved = saved.filter(x => x && Number.isInteger(x.id)).slice(0,100);
let current = null, selected = null, previewUrl = null, busy = false, xhr = null;
let status = { authenticated:false, authReady:false, recognitionReady:false };
let statusLoaded = false, toastTimer;
const t = key => messages[language][key] || messages.en[key] || key;
const icons = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  history:'<path d="M3 11a9 9 0 1 1 2.4 7M3 4v7h7"/><path d="M12 7v5l3 2"/>',
  saved:'<path d="M6 4h12v17l-6-4-6 4z"/>', settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>', arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  check:'<path d="m5 12 4 4L19 6"/>', shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>', spark:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3z"/>', x:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.film}</svg>`;
const page = () => ['home','history','saved','settings','results'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true,4500); }
function errorText(code) { return messages[language].errors[code] || messages[language].errors.SERVER_ERROR; }
function date(value) { return new Date(value).toLocaleDateString({uz:'uz-UZ',ru:'ru-RU',en:'en-GB'}[language],{month:'short',day:'numeric'}); }
function go(name) { if (page() === name) render(); else location.hash = name; }
function setCurrent(result) { current = result; go('results'); }
function demoResult() { return {id:'demo',mode:'demo',createdAt:new Date().toISOString(),frameCount:0,duration:0,candidates:[{id:157336,title:'Interstellar',year:'2014',overview:t('demoOverview'),evidence:t('demoEvidence'),strength:'moderate',poster:null,url:'https://www.themoviedb.org/movie/157336',demo:true}]}; }
function empty(kind) { return `<div class="empty-state"><span class="empty-icon">${icon(kind === 'saved' ? 'saved' : 'film')}</span><h3>${t(kind === 'saved' ? 'emptySaved' : 'emptyHistory')}</h3><p>${t(kind === 'saved' ? 'emptySavedCopy' : 'emptyHistoryCopy')}</p><button class="text-button" data-action="home">${t('home')} ${icon('arrow')}</button></div>`; }
function statusBanner() {
  return `<div class="service-status ${status.recognitionReady ? 'ready' : ''}"><span class="status-light"></span><div><b>${navigator.onLine ? t(status.recognitionReady ? 'ready' : 'notReady') : t('offline')}</b><p>${t('serviceNote')}</p></div></div>`;
}
function renderHome() {
  return `<section class="hero"><div><span class="eyebrow"><span class="small-spark">✳</span> ${t('eyebrow')}</span><h1>${t('hero1')}<br><span>${t('hero2')}</span></h1><p>${t('intro')}</p></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="film-tile tile-back"></div><div class="film-tile tile-front"><span>SCENE / 001</span><div class="art-moon"></div><div class="art-mountain"></div><b>THE NEXT<br>DISCOVERY.</b><i>▶</i></div><span class="art-star">✳</span></div></section>
  <div class="discovery-grid"><section class="upload-panel"><div class="panel-heading"><span><i class="live-dot"></i> ${t('home')}</span><span class="muted">01 / 03</span></div>
    <div id="dropzone" class="dropzone ${selected ? 'has-video' : ''}">${selected ? `<video id="preview" src="${esc(previewUrl)}" controls playsinline preload="metadata"></video><div class="selected-info"><span class="eyebrow">${t('selected')}</span><h3>${esc(selected.name)}</h3><p>${(selected.size/1024/1024).toFixed(1)} MB</p><button class="text-button" data-action="choose">${t('change')}</button></div>` : `<div class="upload-glyph">${icon('upload')}<span>+</span></div><h2><span class="desktop-label">${t('upload')}</span><span class="mobile-label">${t('uploadMobile')}</span></h2><p>${t('uploadCopy')}</p><button class="button primary" data-action="choose">${icon('film')}${t('choose')} ${icon('arrow')}</button><span class="file-limits">${t('limits')}</span>`}</div>
    <input type="file" id="video-file" accept="video/*,.mp4,.mov,.webm" hidden>
    ${selected ? `<label class="consent"><input id="consent" type="checkbox"><span>${t('consent')}</span></label><button id="analyze" class="button primary full" disabled>${icon('spark')}${t('analyze')}</button>` : ''}
    <p class="privacy-line">${icon('shield')} ${t('privacy')}</p><div id="upload-error" class="error" role="alert"></div>
  </section><aside class="how-panel"><span class="eyebrow">THE PROCESS</span><h2>${t('how')}</h2>${[1,2,3].map(n => `<div class="step"><span class="step-number">0${n}</span><div><h3>${t(`step${n}`)}</h3><p>${t(`step${n}Copy`)}</p></div></div>`).join('')}<div class="tiny-note">${icon('spark')} ${t('serviceNote')}</div></aside></div>
  ${statusBanner()}<section class="sample-banner"><div class="sample-art" aria-hidden="true"><span>01</span><i>✦</i></div><div><span class="eyebrow">${t('preview')}</span><h2>${t('demoTitle')}</h2><p>${t('demoCopy')}</p></div><button class="button secondary" data-action="demo">${t('demo')}${icon('arrow')}</button></section>
  <section class="recent-section"><div class="section-heading"><h2>${t('recent')}</h2><button class="text-button" data-action="history">${t('seeAll')}${icon('arrow')}</button></div>${history.length ? historyRows(history.slice(0,3)) : empty('history')}</section>`;
}
function historyRows(items) { return `<div class="history-list">${items.map(item => `<button class="history-row" data-history="${esc(item.id)}"><span class="history-thumb">${icon('film')}</span><span><b>${esc(item.candidates[0]?.title || t('noMatch'))}</b><small>${item.mode === 'demo' ? 'DEMO · ' : ''}${date(item.createdAt)}${item.duration ? ` · ${Math.round(item.duration)}s` : ''}</small></span>${icon('arrow')}</button>`).join('')}</div>`; }
function movieCard(movie,index=0,isDemo=false) {
  const stored = saved.some(s => s.id === movie.id);
  const safePoster = /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[a-zA-Z0-9._-]+$/.test(movie.poster || '') ? movie.poster : null;
  return `<article class="movie-card"><div class="movie-poster ${safePoster ? '' : 'generated-poster'}">${safePoster ? `<img src="${esc(safePoster)}" alt="${esc(movie.title)}" loading="lazy">` : `<span class="poster-orbit"></span><b>${esc(movie.title)}</b><small>${esc(movie.year)}</small>`}<span class="movie-index">0${index+1}</span></div><div class="movie-info"><span class="eyebrow">${isDemo || movie.demo ? 'DEMO' : t(movie.strength || 'weak')} <span class="muted">/ ${esc(movie.year)}</span></span><h2>${esc(movie.title)}</h2><p>${esc(movie.overview || t('noOverview'))}</p><div class="evidence"><b>${icon('spark')} ${t('evidence')}</b><p>${esc(movie.evidence)}</p></div><div class="movie-actions"><button class="button ${stored ? 'saved-button' : 'primary'}" data-save="${movie.id}">${icon(stored ? 'check' : 'saved')}${t(stored ? 'unsave' : 'save')}</button><a class="text-button" href="https://www.themoviedb.org/movie/${Number(movie.id)}" target="_blank" rel="noopener noreferrer">${t('details')} ↗</a></div></div></article>`;
}
function renderResults() {
  if (!current) return `<div class="page-heading"><h1>${t('results')}</h1></div>${empty('history')}`;
  const demo = current.mode === 'demo';
  return `<div class="page-heading"><span class="eyebrow">${demo ? t('demoLabel') : 'YOUR DISCOVERY'}</span><h1>${t(current.candidates.length ? 'results' : 'unknown')}</h1><p>${t(current.candidates.length ? 'resultsCopy' : 'unknownCopy')}</p></div>${demo ? `<div class="demo-notice">${icon('film')} ${t('demoCopy')}</div>` : `<div class="result-meta">${current.frameCount} ${t('frames')} · ${Math.round(current.duration)}s · ${date(current.createdAt)}</div>`}${!demo && current.audioStatus !== 'used' ? `<p class="muted">${t(current.audioStatus === 'absent' ? 'audioAbsent' : current.audioStatus === 'no_speech' ? 'noSpeech' : 'audioMissing')}</p>` : ''}<div class="results-list">${current.candidates.map((m,i) => movieCard(m,i,demo)).join('')}</div><button class="button secondary" data-action="home">${icon('upload')}${t('retry')}</button>`;
}
function renderSettings() {
  return `<div class="page-heading"><span class="eyebrow">MAKE IT YOURS</span><h1>${t('settings')}</h1><p>${t('settingsCopy')}</p></div><div class="settings-grid"><section class="setting-card"><span class="setting-icon">Aa</span><h2>${t('language')}</h2><p>${t('languageCopy')}</p><div class="language-options">${[['uz','O‘zbekcha'],['ru','Русский'],['en','English']].map(([id,name]) => `<button data-language="${id}" class="${language === id ? 'active' : ''}" aria-pressed="${language === id}">${name}</button>`).join('')}</div></section><section class="setting-card"><span class="setting-icon">↗</span><h2>${t('install')}</h2><p>${t('installCopy')}</p><div class="install-steps"><span>Safari</span><span>↑</span><span>＋</span><span>K.</span></div></section><section class="setting-card"><span class="setting-icon">${icon('history')}</span><h2>${t('storage')}</h2><p>${t('storageCopy')}</p><button class="text-button danger" data-action="clear">${t('clear')}</button></section><section class="setting-card"><span class="setting-icon">${icon('shield')}</span><h2>${t('access')}</h2><p>${t(status.authenticated ? 'unlocked' : 'accessCopy')}</p><button class="button secondary" data-action="${status.authenticated ? 'logout' : 'access'}">${t(status.authenticated ? 'logout' : 'unlock')}</button></section></div><section class="privacy-card"><h2>${t('privacyTitle')}</h2><p>${t('privacyCopy')}</p><p class="attribution"><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" class="tmdb-wordmark">TMDB</a> ${t('attribution')}</p></section>${statusBanner()}`;
}
function renderProcessing() { return `<section class="processing"><div class="scanner">${icon('film')}<span></span></div><span class="eyebrow">CONNECTING THE CLUES</span><h1>${t('processing')}</h1><p>${t('processingCopy')}</p><div id="processing-stage" role="status" aria-live="polite">${t('uploading')}</div><progress id="upload-progress" max="100" value="0" aria-label="Upload"></progress><button class="button secondary" data-action="cancel">${t('cancel')}</button></section>`; }
function render() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  const route = page();
  $('#page-name').textContent = t(route === 'results' ? 'home' : route);
  $('#access-button').ariaLabel = t('access');
  $('#close-dialog').ariaLabel = t('close');
  $('#nav').innerHTML = ['home','history','saved','settings'].map(name => `<a href="#${name}" class="nav-link ${route === name || name === 'home' && route === 'results' ? 'active' : ''}" ${route === name ? 'aria-current="page"' : ''}>${icon(name === 'home' ? 'search' : name)}<span>${t(name)}</span>${name === 'saved' && saved.length ? `<small>${saved.length}</small>` : ''}</a>`).join('');
  if (busy) $('#main').innerHTML = renderProcessing();
  else if (route === 'home') $('#main').innerHTML = renderHome();
  else if (route === 'results') $('#main').innerHTML = renderResults();
  else if (route === 'settings') $('#main').innerHTML = renderSettings();
  else $('#main').innerHTML = `<div class="page-heading"><span class="eyebrow">YOUR COLLECTION</span><h1>${t(route)}</h1><p>${t(`${route}Copy`)}</p></div>${route === 'history' ? history.length ? historyRows(history) : empty('history') : saved.length ? `<div class="results-list">${saved.map((m,i) => movieCard(m,i)).join('')}</div>` : empty('saved')}`;
  const file = $('#video-file');
  if (file) file.addEventListener('change',() => selectFile(file.files[0]));
  const zone = $('#dropzone');
  if (zone) {
    zone.addEventListener('dragover',e => {e.preventDefault(); zone.classList.add('dragging');});
    zone.addEventListener('dragleave',() => zone.classList.remove('dragging'));
    zone.addEventListener('drop',e => {e.preventDefault(); zone.classList.remove('dragging'); selectFile(e.dataTransfer.files[0]);});
  }
  $('#consent')?.addEventListener('change',e => $('#analyze').disabled = !e.target.checked);
  $('#analyze')?.addEventListener('click',analyze);
  $('#preview')?.addEventListener('error',() => {
    const note = document.createElement('p');
    note.className = 'preview-note';
    note.textContent = {uz:'Bu brauzer videoni oldindan ko‘rsata olmadi. Serverda tahlil qilish uchun yuborishingiz mumkin.',ru:'Браузер не может показать это видео. Его всё равно можно отправить на сервер для анализа.',en:'This browser cannot preview this video. You can still submit it for server-side analysis.'}[language];
    $('#preview')?.replaceWith(note);
  },{once:true});
}
function selectFile(file) {
  if (!file) return;
  if (file.size > 60*1024*1024) return toast(errorText('FILE_TOO_LARGE'));
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm)$/i.test(file.name)) return toast(errorText('INVALID_VIDEO'));
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selected = file; previewUrl = URL.createObjectURL(file); render();
}
function releaseFile() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; selected = null; }
async function refreshStatus() { try { const res = await fetch('/api/status',{cache:'no-store'}); if (res.ok) {status = await res.json();statusLoaded = true;} } catch {} }
function showAccess() { $('#login-error').textContent = statusLoaded && !status.authReady ? t('authMissing') : ''; $('#access-dialog').showModal(); }
async function analyze() {
  if (!selected || !$('#consent')?.checked || busy) return;
  await refreshStatus();
  if (!navigator.onLine) return toast(t('offline'));
  if (!status.authenticated) return showAccess();
  if (!status.recognitionReady) return toast(errorText('RECOGNITION_NOT_CONFIGURED'));
  busy = true; render();
  const form = new FormData(); form.append('video',selected); form.append('language',language);
  xhr = new XMLHttpRequest(); xhr.open('POST','/api/recognize'); xhr.timeout = 195000;
  const finish = () => {busy = false; xhr = null;};
  xhr.upload.onprogress = e => {const progress = $('#upload-progress'); if (progress && e.lengthComputable) progress.value = Math.round(e.loaded/e.total*100);};
  xhr.upload.onload = () => {if ($('#processing-stage')) $('#processing-stage').textContent = t('analyzing'); $('#upload-progress')?.removeAttribute('value');};
  xhr.onload = () => {
    const request = xhr; finish();
    let body; try {body = JSON.parse(request.responseText);} catch {render(); return toast(errorText('SERVER_ERROR'));}
    if (request.status >= 200 && request.status < 300 && Array.isArray(body.candidates)) {
      history = [body,...history].slice(0,30); persist('history',history); releaseFile(); setCurrent(body);
    } else {render(); toast(errorText(body.error)); if (request.status === 401) showAccess();}
  };
  xhr.onerror = xhr.ontimeout = () => {finish();render();toast(errorText('NETWORK'));};
  xhr.onabort = () => {finish();render();toast(t('cancelled'));};
  xhr.send(form);
}
document.addEventListener('click',async e => {
  const button = e.target.closest('[data-action],[data-save],[data-history],[data-language]');
  if (!button) return;
  if (button.dataset.language) {language = button.dataset.language;persist('language',language);if(current?.mode === 'demo')current = demoResult();render();return;}
  if (button.dataset.history) {const item = history.find(i => i.id === button.dataset.history);if(item)setCurrent(item);return;}
  if (button.dataset.save) {
    const id = Number(button.dataset.save), exists = saved.some(m => m.id === id);
    const movie = current?.candidates.find(m => m.id === id) || saved.find(m => m.id === id);
    if (!movie) return;
    saved = exists ? saved.filter(m => m.id !== id) : [{...movie,demo:current?.mode === 'demo' || movie.demo},...saved].slice(0,100);
    persist('saved',saved);render();toast(t(exists ? 'removedToast' : 'savedToast'));return;
  }
  const action = button.dataset.action;
  if (['home','history','saved','settings'].includes(action)) go(action);
  if (action === 'choose') $('#video-file').click();
  if (action === 'demo') setCurrent(demoResult());
  if (action === 'access') showAccess();
  if (action === 'cancel') xhr?.abort();
  if (action === 'clear' && confirm(t('clearConfirm'))) {history=[];saved=[];current=null;persist('history',history);persist('saved',saved);render();toast(t('cleared'));}
  if (action === 'logout') {try {const res = await fetch('/api/logout',{method:'POST'});if(!res.ok)throw new Error();status.authenticated=false;releaseFile();render();}catch{toast(errorText('NETWORK'));}}
});
$('#access-button').addEventListener('click',() => status.authenticated ? go('settings') : showAccess());
$('#close-dialog').addEventListener('click',() => $('#access-dialog').close());
$('#login-form').addEventListener('submit',async e => {
  e.preventDefault();const button = e.target.querySelector('button');button.disabled=true;
  try {
    const response = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('#beta-code').value})});
    const result = await response.json();
    if (!response.ok) {$('#login-error').textContent=errorText(result.error);return;}
    $('#beta-code').value='';$('#access-dialog').close();await refreshStatus();render();toast(t('unlocked'));
  } catch {$('#login-error').textContent=errorText('NETWORK');} finally {button.disabled=false;}
});
window.addEventListener('hashchange',() => {render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});});
window.addEventListener('offline',() => {if(!busy)render();toast(t('offline'));});
window.addEventListener('online',async () => {await refreshStatus();if(!busy)render();});
render();
refreshStatus().then(() => {if (!busy) render();});
if (!storageOk) toast(t('localWarning'));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
