/* Мини-апп «Инбокс»: пять экранов по макету, данные — с бэкенда (api.js). */
(function () {
  const { call, DEV, inTelegram, tg } = window.InboxAPI;
  const app = document.getElementById('app');
  const $ = (s, r) => (r || app).querySelector(s);
  const $$ = (s, r) => (r || app).querySelectorAll(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Телеграм: тема, высота, вибрация ----------
  function applyTheme() {
    const p = (inTelegram && tg.themeParams) || {};
    const dark = inTelegram && tg.colorScheme ? tg.colorScheme === 'dark'
      : (new URLSearchParams(location.search).get('theme') === 'dark' ||
         (!new URLSearchParams(location.search).get('theme') && matchMedia('(prefers-color-scheme: dark)').matches));
    document.documentElement.classList.toggle('dark', dark);
    const map = { '--bg': p.secondary_bg_color, '--card': p.section_bg_color || p.bg_color, '--fg': p.text_color,
      '--muted': p.hint_color, '--accent': p.button_color, '--on-accent': p.button_text_color, '--line': p.section_separator_color };
    Object.entries(map).forEach(([k, v]) => v ? document.documentElement.style.setProperty(k, v) : document.documentElement.style.removeProperty(k));
    if (tg && tg.setHeaderColor && p.secondary_bg_color) { try { tg.setHeaderColor('secondary_bg_color'); tg.setBackgroundColor('secondary_bg_color'); } catch (e) {} }
  }
  if (tg) {
    tg.ready(); tg.expand();
    if (tg.disableVerticalSwipes) try { tg.disableVerticalSwipes(); } catch (e) {}
    tg.onEvent && tg.onEvent('themeChanged', applyTheme);
  }
  applyTheme();
  const hap = (kind) => { try {
    const h = tg && tg.HapticFeedback; if (!h || !inTelegram) return;
    if (kind === 'success' || kind === 'error') h.notificationOccurred(kind); else h.impactOccurred(kind || 'light');
  } catch (e) {} };

  if (!inTelegram && !DEV) {
    app.insertAdjacentHTML('beforeend', '<div class="gate"><h3>Откройте из Телеграма</h3><p>Инбокс работает внутри Телеграма.</p></div>');
    return;
  }
  if (DEV) app.insertAdjacentHTML('beforeend', '<div class="devbadge">разработка · подставные данные</div>');

  // ---------- Мелочи ----------
  function toast(t, isErr) {
    const el = $('#toast');
    if (!isErr && Date.now() - (el._err || 0) < 2500) return; // сообщение об ошибке не перекрываем
    if (isErr) el._err = Date.now();
    el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), isErr ? 3000 : 2000);
  }
  function fail(err) { console.error(err); hap('error'); toast(err && err.message ? 'Не вышло: ' + err.message : 'Не вышло', true); }
  const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2]; };
  const pn = (n, f) => n + ' ' + plural(n, f);
  const DAY = 864e5;
  function ago(ts) {
    if (!ts) return '';
    const d = Math.floor((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
    if (d <= 0) return 'сегодня'; if (d === 1) return 'вчера'; if (d < 7) return pn(d, ['день', 'дня', 'дней']) + ' назад';
    if (d < 14) return 'неделю назад'; if (d < 30) return Math.floor(d / 7) + ' недели назад';
    if (d < 60) return 'месяц назад'; return pn(Math.floor(d / 30), ['месяц', 'месяца', 'месяцев']) + ' назад';
  }
  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  function weekDate() { // «на неделе» — ближайшая пятница; с пятницы по воскресенье — через два дня
    const d = new Date(), w = d.getDay(); const toFri = (5 - w + 7) % 7;
    return addDays(w === 5 || w === 6 || w === 0 ? 2 : toFri);
  }
  function humanDate(s) {
    if (!s) return ''; if (s === addDays(0)) return 'сегодня'; if (s === addDays(1)) return 'завтра';
    const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function linkKind(u) {
    const h = host(u);
    if (/instagram/.test(h)) return 'Рилс'; if (/threads/.test(h)) return 'Ветка'; if (/maps|2gis/.test(u)) return 'Место';
    if (/youtu/.test(h)) return 'Видео'; if (/t\.me/.test(h)) return 'Пост в Телеграме'; return 'Статья';
  }
  function openLink(u) { if (!u) return; if (tg && tg.openLink && inTelegram) tg.openLink(u); else window.open(u, '_blank', 'noopener'); }
  const todayLabel = () => { const s = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); return s[0].toUpperCase() + s.slice(1); };
  $$('[data-today]').forEach((el) => el.textContent = todayLabel());

  // ---------- Состояние ----------
  const S = {
    config: { projects: [], places: [], defaultPlace: 'Прочитать' },
    today: null,
    deck: { task: [], link: [], someday: [] },
    done: { task: 0, link: 0, someday: 0 },
    deckName: 'task',
    ideas: [], someday: [],
    ideaFilter: 'all', somedayFilter: 'all',
  };

  // ---------- Память телефона: кэш и очередь отправки ----------
  // Экраны сначала показывают то, что было в прошлый раз, свежее подтягивается в фоне.
  // Все изменения ложатся в очередь в памяти телефона и уходят в Google по одному;
  // без связи очередь ждёт и отправляется сама. Закрыли мини-апп — уйдёт при следующем открытии.
  const store = {
    get(k, d) { try { const v = localStorage.getItem('inbox:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('inbox:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const OB = { items: store.get('outbox', []), busy: false, timer: 0, delay: 0, offline: false };
  function obSave() { store.set('outbox', OB.items); renderSync(); }
  function renderSync() {
    const el = $('#sync'), n = OB.items.length;
    el.hidden = !n && !OB.offline;
    el.classList.toggle('off', OB.offline);
    el.textContent = OB.offline ? (n ? 'нет связи · ' + pn(n, ['запись ждёт', 'записи ждут', 'записей ждут']) : 'нет связи') : 'отправляю ' + n;
  }
  function send(action, params) {
    OB.items.push({ key: Date.now() + '-' + Math.random().toString(36).slice(2, 7), action, params: params || {} });
    obSave(); pump();
  }
  async function pump() {
    if (OB.busy || !OB.items.length) return;
    OB.busy = true; clearTimeout(OB.timer);
    while (OB.items.length) {
      const it = OB.items[0];
      try {
        const r = await call(it.action, it.params);
        OB.items.shift(); OB.offline = false; OB.delay = 0; obSave();
        if (it.action === 'undo' && r && !r.undone) toast('Возвращать нечего');
      } catch (e) {
        if (e && e.server) { OB.items.shift(); obSave(); fail(e); continue; } // сервер отказал — не повторяем
        OB.offline = true; OB.delay = Math.min(60000, (OB.delay || 1500) * 2); renderSync();
        OB.timer = setTimeout(pump, OB.delay); OB.busy = false; return;
      }
    }
    OB.busy = false; renderSync(); refreshAll();
  }
  const kick = () => { if (OB.items.length && !OB.busy) { OB.delay = 0; pump(); } };
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { kick(); if (!OB.items.length) refreshAll(); } });

  // Что ещё не дошло до Google — чтобы старые данные не воскрешали уже решённое
  const queued = (action) => OB.items.filter((x) => x.action === action);
  function decidedIds() { const s = new Set(); queued('decide').forEach((x) => s.add(x.params.kind + ':' + x.params.id)); return s; }
  function queuedSaves(type, date) {
    const out = [];
    queued('save').forEach((x) => (x.params.items || []).forEach((it, i) => {
      if (it.type === type && (date === undefined || (it.date || (type === 'meet' ? addDays(0) : '')) === date)) out.push(Object.assign({ tmp: x.key + ':' + i }, it));
    }));
    return out;
  }
  // Загрузка: сначала кэш, потом свежее. apply(data) вызывается один или два раза.
  async function load(key, action, params, apply) {
    const c = store.get('c:' + key);
    if (c) apply(c, true);
    try {
      const r = await call(action, params);
      store.set('c:' + key, r);
      if (OB.offline && !OB.items.length) { OB.offline = false; renderSync(); }
      apply(r, false);
    } catch (e) {
      if (e && e.server) fail(e);
      else { OB.offline = true; renderSync(); if (!c) toast('Нет связи — покажу, как только появится'); }
    }
  }
  function refreshAll() {
    loadToday(true); loadDeck();
    if (current === 'ideas') loadIdeas(); if (current === 'someday') loadSomeday();
  }

  // ---------- Навигация ----------
  let current = 'today';
  function go(name) {
    closeCap(); current = name;
    $$('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + name));
    $$('.bar .ti[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === name));
    if (name === 'today') { S.day = 0; loadToday(); }
    if (name === 'razbor') renderDeck();
    if (name === 'ideas') loadIdeas();
    if (name === 'someday') loadSomeday();
  }
  app.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.go === 'razbor' && S.deckName === 'someday') setDeck(firstDeck()); go(g.dataset.go); }
    const o = e.target.closest('[data-open=capture]'); if (o) { app.classList.contains('capturing') ? closeCap() : openCap(); }
  });

  // ---------- Сегодня ----------
  // Листание дней: S.day — смещение от сегодня (0 — сегодня, 1 — завтра)
  S.day = 0;
  function dayTitle(off) {
    if (off === 0) return 'Сегодня'; if (off === 1) return 'Завтра'; if (off === -1) return 'Вчера'; if (off === 2) return 'Послезавтра';
    const s = new Date(addDays(off) + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long' }); return s[0].toUpperCase() + s.slice(1);
  }
  function dayHeader() {
    const off = S.day, d = new Date(addDays(off) + 'T12:00:00');
    const full = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#day-date').textContent = full[0].toUpperCase() + full.slice(1);
    $('#day-title').textContent = dayTitle(off);
    $('#tasks-h').textContent = off === 0 ? 'Дела на сегодня' : off === 1 ? 'Дела на завтра' : off === -1 ? 'Дела на вчера' : 'Дела на этот день';
  }
  function shiftDay(dir) {
    const next = Math.max(-30, Math.min(60, S.day + dir)); if (next === S.day) return;
    S.day = next; hap('light'); dayHeader();
    const body = $('#day-body'); body.className = ''; void body.offsetWidth; body.className = dir > 0 ? 'slide-l' : 'slide-r';
    $('#meetings').innerHTML = '<div class="skeleton"></div>'; $('#tasks').innerHTML = '<div class="skeleton"></div>'; $('#cnt').textContent = '';
    loadToday();
  }
  $$('.dnav [data-day]').forEach((b) => b.onclick = () => shiftDay(+b.dataset.day));
  (function swipeDays() {
    const el = $('#s-today'); let sx = 0, sy = 0, on = false;
    el.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!on) return; on = false; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftDay(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  function loadToday() {
    const date = addDays(S.day); dayHeader();
    return load('today:' + date, 'today', { date }, (t) => {
      if (date !== addDays(S.day)) return; // пока грузилось, перелистнули дальше
      S.today = t; renderToday();
    });
  }
  function renderToday() {
    const t = S.today; if (!t) return;
    const now = Date.now(), isToday = S.day === 0, date = addDays(S.day);
    // Записанное, но ещё не отправленное — сразу на своём дне, полупрозрачным
    const extraM = queuedSaves('meet', date).map((x) => {
      const st = x.time ? new Date(date + 'T' + x.time + ':00').getTime() : 0;
      return { id: x.tmp, title: x.title, sub: 'отправляется', allDay: !x.time, start: x.time || '', startTs: st, endTs: st + 3600e3, pending: true };
    });
    const m = t.meetings.concat(extraM).sort((a, b) => (a.allDay ? -1 : a.startTs) - (b.allDay ? -1 : b.startTs));
    // Отметки «сделано», которые ещё в очереди
    const doneQ = {}; queued('taskDone').forEach((x) => doneQ[x.params.id] = x.params.done);
    t.tasks.forEach((x) => { if (x.id in doneQ) x.done = doneQ[x.id]; });
    const tasks = t.tasks.concat(queuedSaves('task', date).map((x) => ({ id: x.tmp, title: x.title, project: x.project, done: false, pending: true })));
    S.todayTasks = tasks;
    let html = '';
    if (!m.length) html = '<div class="muted">' + (isToday ? 'Встреч сегодня нет' : 'Встреч нет') + '</div>';
    const justEnded = isToday ? m.filter((x) => !x.allDay && x.endTs <= now && now - x.endTs < 2 * 3600e3 && !dismissed(x.id)).pop() : null;
    let nowShown = false;
    const nowLine = () => {
      let s = '';
      if (justEnded) s += `<div class="after"><b>${esc(justEnded.title)} закончился</b>О чём договорились? Надиктуйте, я разложу в дела.<br><button data-after="${esc(justEnded.id)}">Записать итоги</button><button class="x" data-dismiss="${esc(justEnded.id)}">Не нужно</button></div>`;
      const d = new Date(); s = `<div class="now">сейчас ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</div>` + s;
      return s;
    };
    m.forEach((x, i) => {
      const past = !x.allDay && x.endTs <= now;
      if (isToday && !nowShown && !x.allDay && x.startTs > now && i > 0) { html += nowLine(); nowShown = true; }
      html += `<div class="meet${past ? ' past' : ''}${x.pending ? ' pending' : ''}"><time>${x.allDay ? 'день' : esc(x.start)}</time><div><div class="t">${esc(x.title)}</div>${x.sub ? `<div class="s">${esc(x.sub)}</div>` : ''}</div></div>`;
    });
    if (isToday && !nowShown && m.length && m.some((x) => !x.allDay && x.endTs <= now)) html += nowLine();
    $('#meetings').innerHTML = html;

    $('#tasks').innerHTML = tasks.length ? tasks.map((x) =>
      `<div class="task${x.done ? ' done' : ''}${x.pending ? ' pending' : ''}" data-id="${esc(x.id)}"><div class="box"></div><div><div class="t">${esc(x.title)}</div>${x.project ? `<div class="s">${esc(x.project)}</div>` : ''}</div></div>`).join('')
      : '<div class="muted">' + (isToday ? 'На сегодня дел нет' : 'Дел на этот день нет') + '</div>';
    updCount();
    renderPending();
  }
  function updCount() { const l = S.todayTasks || []; $('#cnt').textContent = l.length ? l.filter((x) => x.done).length + ' из ' + l.length : ''; }
  const dismissed = (id) => { try { return localStorage.getItem('after:' + id) === '1'; } catch (e) { return false; } };
  const dismiss = (id) => { try { localStorage.setItem('after:' + id, '1'); } catch (e) {} };
  $('#meetings').addEventListener('click', (e) => {
    const a = e.target.closest('[data-after]'), d = e.target.closest('[data-dismiss]');
    if (a) { const m = S.today.meetings.find((x) => x.id === a.dataset.after); dismiss(a.dataset.after); openCap('Итоги встречи «' + (m ? m.title : '') + '»: '); renderToday(); }
    if (d) { dismiss(d.dataset.dismiss); renderToday(); }
  });
  $('#tasks').addEventListener('click', (e) => {
    const el = e.target.closest('.task'); if (!el) return;
    const t = (S.todayTasks || []).find((x) => x.id === el.dataset.id); if (!t) return;
    if (t.pending) { toast('Это дело ещё отправляется'); return; }
    t.done = !t.done; el.classList.toggle('done', t.done); updCount();
    if (t.done) { hap('success'); toast('Готово'); } else hap('light');
    send('taskDone', { id: t.id, done: t.done });
  });

  function pendingCounts() {
    if (S.deckLoaded) return { tasks: S.deck.task.length, links: S.deck.link.length };
    return (S.today && S.today.pending) || { tasks: 0, links: 0 };
  }
  function renderPending() {
    const p = pendingCounts(), n = p.tasks + p.links;
    $('#badge').textContent = n ? String(n) : '';
    $('#go-n').textContent = n;
    $('#go-t').textContent = n ? 'Разобрать за ' + pn(Math.max(1, Math.round(n * 8 / 60)), ['минуту', 'минуты', 'минут']) : 'Всё разобрано';
    $('#go-s').textContent = n ? pn(p.tasks, ['дело', 'дела', 'дел']) + ' и ' + pn(p.links, ['сохранёнка', 'сохранёнки', 'сохранёнок']) : 'Новое придёт из бота и из «+»';
  }

  // ---------- Разбор ----------
  const stage = $('.stage'), empty = $('.empty'), actions = $('.actions'), tray = $('.tray'), prog = $('.prog b'), tabs = $$('#s-razbor .tabs .tab');
  let dragging = false;
  function loadDeck() {
    return load('deck', 'deck', {}, (d) => {
      const gone = decidedIds();
      S.deck.task = d.task.filter((x) => !gone.has('task:' + x.id));
      S.deck.link = d.link.filter((x) => !gone.has('link:' + x.id));
      S.deckLoaded = true;
      // Не перерисовывать карточку под пальцем или с открытым выбором
      if (current === 'razbor' && (dragging || tray.classList.contains('on'))) counts(); else renderDeck();
    });
  }
  const firstDeck = () => (S.deck.task.length || !S.deck.link.length ? 'task' : 'link');
  function setDeck(name) {
    S.deckName = name;
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.deck === name));
    $('[data-deck=someday]').hidden = !(name === 'someday' || S.deck.someday.length);
  }
  tabs.forEach((t) => t.onclick = () => { setDeck(t.dataset.deck); renderDeck(); });

  function cardEl(it, kind) {
    const c = document.createElement('div'); c.className = 'card';
    let inner = '';
    if (kind === 'task') {
      inner = `<div class="kicker"><span class="dot"></span>${esc(it.src)} · ${esc(ago(it.ts))}</div><div class="ctitle">${esc(it.title)}</div><div class="spacer"></div><div class="dest">Проект<b>${esc(it.project || 'Без проекта')}</b></div>`;
    } else if (kind === 'link') {
      const h = host(it.url);
      inner = `<div class="thumb" data-url="${esc(it.url)}">${esc(linkKind(it.url))}${h ? ' · открыть' : ''}</div><div class="kicker"><span class="dot"></span>${esc(h || 'ссылка')} · ${esc(ago(it.ts))}</div><div class="ctitle">${esc(it.title)}</div><div class="spacer"></div><div class="dest">Положу в<b>${esc(it.place)}</b></div>`;
    } else {
      inner = `<div class="kicker"><span class="dot"></span>${it.type === 'link' ? 'Ссылка' : 'Дело'} · в «Однажды» ${esc(pn(daysSince(it.ts), ['день', 'дня', 'дней']))}</div><div class="ctitle">${esc(it.title)}</div>${it.url ? `<div class="curl">${esc(host(it.url))}</div>` : ''}<div class="spacer"></div><div class="dest">Беру — вернётся в разбор<b>${esc(it.project || (it.type === 'link' ? 'Сохранёнки' : 'Дела'))}</b></div>`;
    }
    c.innerHTML = inner + '<div class="stamp take">Беру</div><div class="stamp later">Однажды</div>';
    return c;
  }
  const daysSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / DAY));

  function counts() {
    tabs.forEach((t) => t.querySelector('i').textContent = S.deck[t.dataset.deck].length || '');
    renderPending();
  }
  function renderDeck() {
    stage.querySelectorAll('.card').forEach((c) => c.remove());
    tray.classList.remove('on'); app.classList.remove('choosing'); actions.style.display = 'flex';
    const name = S.deckName, l = S.deck[name], done = S.done[name];
    prog.style.width = (l.length + done ? done / (l.length + done) * 100 : 0) + '%';
    counts();
    $('#empty-p').textContent = !S.deckLoaded ? 'Загружаю…' : name === 'someday' ? 'Пять старых карточек перебраны.' : 'Всё разложено. Новое придёт из бота.';
    empty.classList.toggle('on', !l.length);
    $('.later-btn').disabled = $('.take-btn').disabled = $('.trash').disabled = !l.length;
    $('.later-btn').textContent = name === 'someday' ? 'Ещё полежит' : 'Однажды';
    $('.take-btn').textContent = name === 'someday' ? 'Вернуть' : 'Беру';
    if (l[1]) { const b = cardEl(l[1], name); b.classList.add('back'); stage.appendChild(b); }
    if (l[0]) { const c = cardEl(l[0], name); stage.appendChild(c); drag(c); }
  }
  function pull(dx) { const k = Math.min(Math.abs(dx) / 120, 1); stage.style.setProperty('--r', dx > 0 ? k * .9 : 0); stage.style.setProperty('--l', dx < 0 ? k * .9 : 0); }
  function drag(c) {
    let sx = 0, dx = 0, down = false, moved = false, armed = 0;
    c.addEventListener('pointerdown', (e) => { if (tray.classList.contains('on')) return; down = true; dragging = true; moved = false; sx = e.clientX; c.setPointerCapture(e.pointerId); c.classList.remove('snap'); });
    c.addEventListener('pointermove', (e) => {
      if (!down) return; dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
      c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      c.querySelector('.take').style.opacity = Math.max(0, dx / 90); c.querySelector('.later').style.opacity = Math.max(0, -dx / 90); pull(dx);
      const now = dx > 90 ? 1 : dx < -90 ? -1 : 0; if (now && now !== armed) hap('light'); armed = now;
    });
    const up = () => {
      if (!down) return; down = false; dragging = false;
      if (dx > 90) decide('take'); else if (dx < -90) decide('later');
      else { c.classList.add('snap'); c.style.transform = ''; c.querySelectorAll('.stamp').forEach((s) => s.style.opacity = 0); pull(0); }
      dx = 0; armed = 0;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('click', (e) => { const t = e.target.closest('.thumb'); if (t && !moved) openLink(t.dataset.url); });
  }
  function fly(dx, dy, then) {
    const c = stage.querySelector('.card:not(.back)'); if (!c) return then();
    c.classList.add('fly'); c.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 21}deg)`; c.style.opacity = 0; pull(0);
    setTimeout(then, 300);
  }
  // Отправить решение: карточка улетает сразу, сервер — следом по очереди
  function commit(action, extra, dir, msg) {
    const name = S.deckName, it = S.deck[name][0]; if (!it) return;
    hap(action === 'take' ? 'medium' : 'light');
    S.hist.push({ deck: name, item: it });
    fly(dir[0], dir[1], () => {
      S.deck[name] = S.deck[name].filter((x) => x !== it); S.done[name]++;
      if (name === 'someday') S.someday = S.someday.filter((x) => x.id !== it.id);
      renderDeck(); if (msg) toast(msg);
    });
    send('decide', Object.assign({ kind: name, id: it.id, decision: action }, extra));
  }
  S.hist = [];

  function decide(kind) {
    const name = S.deckName, it = S.deck[name][0]; if (!it) return;
    if (kind === 'later') return commit('later', {}, [-420, 0], name === 'someday' ? 'Пусть ещё полежит' : 'В «Однажды»');
    if (kind === 'trash') return commit('trash', {}, [0, 520], 'В корзину');
    if (name === 'someday') return commit('take', {}, [420, 0], 'Вернула в разбор');
    // «Беру» — спрашиваем срок или место
    const c = stage.querySelector('.card:not(.back)');
    c.classList.add('snap'); c.style.transform = 'translateY(-6px) scale(.97)'; c.querySelectorAll('.stamp').forEach((s) => s.style.opacity = 0); pull(0);
    actions.style.display = 'none'; app.classList.add('choosing');
    if (name === 'task') showTray('Когда беретесь?', [['Сегодня', addDays(0), 1], ['Завтра', addDays(1)], ['На неделе', weekDate()], ['Дата…', '__date'], ['Отмена', '__cancel', 0, 'ghost']]);
    else linkTray(it, false);
  }
  function linkTray(it, all) {
    const P = S.config.places;
    let opts;
    if (all) opts = P.map((p) => [p, p, p === it.place ? 1 : 0]).concat([['Отмена', '__cancel', 0, 'ghost']]);
    else {
      const alt = ['Прочитать', 'Идея поста'].filter((p) => p !== it.place && P.includes(p));
      opts = [[it.place, it.place, 1]].concat(alt.map((p) => [p, p]), [['Сделать делом', '__task'], ['Другое место…', '__more'], ['Отмена', '__cancel', 0, 'ghost']]);
    }
    showTray('Куда положить? Подсвечено предложение', opts);
  }
  function showTray(title, opts) {
    tray.innerHTML = `<p>${esc(title)}</p>` + opts.map(([t, v, s, cls]) => `<button class="choice${s ? ' sugg' : ''}${cls ? ' ' + cls : ''}" data-v="${esc(v)}">${esc(t)}</button>`).join('');
    tray.classList.add('on');
  }
  tray.addEventListener('click', (e) => {
    const b = e.target.closest('.choice'); if (!b) return;
    const v = b.dataset.v, name = S.deckName, it = S.deck[name][0];
    if (v === '__cancel') return renderDeck();
    if (v === '__more') return linkTray(it, true);
    if (v === '__date') { const dp = $('#datepick'); dp.value = addDays(0); dp.min = addDays(0); try { dp.showPicker(); } catch (err) { dp.focus(); dp.click(); } return; }
    if (name === 'task') commit('take', { when: v }, [420, 0], 'Беру: ' + humanDate(v));
    else if (v === '__task') commit('take', { place: '__task' }, [420, 0], 'Стало делом, срок спрошу в разборе');
    else commit('take', { place: v }, [420, 0], 'В «' + v + '»');
  });
  $('#datepick').addEventListener('change', (e) => { const v = e.target.value; if (v) commit('take', { when: v }, [420, 0], 'Беру: ' + humanDate(v)); });
  $('.later-btn').onclick = () => decide('later');
  $('.take-btn').onclick = () => decide('take');
  $('.trash').onclick = () => decide('trash');
  $('.undo').onclick = () => {
    hap('light');
    const h = S.hist.pop();
    if (h) { // карточка возвращается сразу
      const d = h.deck;
      S.deck[d].unshift(h.item); S.done[d] = Math.max(0, S.done[d] - 1);
      if (d === 'someday') S.someday.push(h.item);
      setDeck(d); renderDeck(); toast('Вернула последнее');
      // Если решение ещё не ушло в Google — просто вычёркиваем его из очереди
      const i = OB.items.map((x) => x.action === 'decide' && x.params.id === h.item.id && x.params.kind === d).lastIndexOf(true);
      if (i > 0 || (i === 0 && !OB.busy)) { OB.items.splice(i, 1); obSave(); return; }
    } else toast('Возвращаю последнее решение');
    send('undo');
  };

  // ---------- Идеи ----------
  function loadIdeas() {
    return load('ideas', 'ideas', {}, (l) => {
      const gone = new Set(queued('ideaToTask').map((x) => x.params.id));
      S.ideas = l.filter((x) => !gone.has(x.id)); renderIdeaFilters(); renderIdeas();
    });
  }
  function renderIdeaFilters() {
    const f = ['all'].concat(S.config.projects, ['']);
    $('#idea-filters').innerHTML = f.map((p) => `<button class="tab${S.ideaFilter === p ? ' on' : ''}" data-p="${esc(p)}">${p === 'all' ? 'Все' : p || 'Без проекта'}</button>`).join('');
  }
  $('#idea-filters').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (!b) return; S.ideaFilter = b.dataset.p; renderIdeaFilters(); renderIdeas(); });
  function renderIdeas() {
    const all = queuedSaves('idea').map((x) => ({ id: x.tmp, text: x.title, project: x.project, ts: Date.now(), pending: true })).concat(S.ideas);
    $('#ideas-n').textContent = pn(all.length, ['идея', 'идеи', 'идей']);
    if (searchQ.length >= 2) return;
    const l = all.filter((i) => S.ideaFilter === 'all' || (i.project || '') === S.ideaFilter);
    $('#ideas').innerHTML = l.length ? l.map((i) => `<div class="idea${i.pending ? ' pending' : ''}" data-id="${esc(i.id)}"><div class="t">${esc(i.text)}</div><div class="s"><span class="tag">${esc(i.project || 'Без проекта')}</span>${esc(ago(i.ts))}<button class="act" data-act="totask">Сделать делом</button></div></div>`).join('')
      : '<div class="muted">' + (all.length ? 'В этом проекте идей пока нет' : 'Идей пока нет. Нажмите «+» и запишите первую.') + '</div>';
  }
  $('#ideas').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act=totask]'); if (!a) return;
    const el = a.closest('.idea'), id = el.dataset.id;
    if (el.classList.contains('pending')) { toast('Эта идея ещё отправляется'); return; }
    el.classList.add('gone'); hap('light');
    setTimeout(() => { S.ideas = S.ideas.filter((x) => x.id !== id); renderIdeas(); }, 300);
    toast('Стало делом, срок спрошу в разборе');
    send('ideaToTask', { id });
  });
  let searchQ = '', searchT = 0;
  $('#q').addEventListener('input', (e) => {
    searchQ = e.target.value.trim();
    clearTimeout(searchT);
    if (searchQ.length < 2) { $('#idea-filters').style.display = ''; return renderIdeas(); }
    $('#idea-filters').style.display = 'none';
    searchT = setTimeout(async () => {
      const q = searchQ;
      try {
        const r = await call('search', { q });
        if (q !== searchQ) return;
        $('#ideas').innerHTML = r.items.length ? r.items.map((i) => `<div class="idea"><div class="t">${esc(i.title)}</div><div class="s"><span class="tag">${esc(i.kind)}</span>${esc(i.sub || '')}</div></div>`).join('') : '<div class="muted">Ничего не нашла</div>';
      } catch (err) { fail(err); }
    }, 300);
  });

  // ---------- Однажды ----------
  function loadSomeday() {
    return load('someday', 'someday', {}, (l) => {
      const gone = new Set(queued('unsomeday').map((x) => x.params.id));
      const dec = decidedIds();
      S.someday = l.filter((x) => !gone.has(x.id) && !dec.has('someday:' + x.id)); renderSomeday();
    });
  }
  function renderSomeday() {
    $('#someday-n').textContent = 'Отложено на потом · ' + S.someday.length;
    $('#revisit').hidden = S.someday.length < 1;
    const f = S.somedayFilter;
    const l = S.someday.filter((x) => f === 'all' || x.type === f).slice().sort((a, b) => b.ts - a.ts);
    $('#someday').innerHTML = l.length ? l.map((x) => `<div class="idea" data-id="${esc(x.id)}"><div class="t">${esc(x.title)}</div><div class="s"><span class="tag">${x.type === 'link' ? 'Ссылка' : 'Дело'}</span><span class="age">${esc(pn(daysSince(x.ts), ['день', 'дня', 'дней']))}</span><button class="act" data-act="back">Вернуть</button></div></div>`).join('')
      : '<div class="muted">Здесь пусто. Сюда попадает всё, что в разборе ушло в «Однажды».</div>';
  }
  $('#someday-filters').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (!b) return; S.somedayFilter = b.dataset.f; $$('#someday-filters .tab').forEach((x) => x.classList.toggle('on', x === b)); renderSomeday(); });
  $('#someday').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act=back]'); if (!a) return;
    const el = a.closest('.idea'), id = el.dataset.id;
    el.classList.add('gone'); hap('light'); toast('Вернула в разбор');
    setTimeout(() => { S.someday = S.someday.filter((x) => x.id !== id); renderSomeday(); }, 300);
    send('unsomeday', { id });
  });
  $('#revisit-go').onclick = () => {
    S.deck.someday = S.someday.slice().sort((a, b) => a.ts - b.ts).slice(0, 5); S.done.someday = 0;
    setDeck('someday'); go('razbor');
  };

  // ---------- «+»: запись ----------
  const KINDS = { task: 'Дело', idea: 'Идея', meet: 'Встреча', link: 'Ссылка' };
  const KIND_ORDER = ['task', 'idea', 'meet', 'link'];
  let manual = null, parsed = [];
  const HINT = 'Попробуйте: «созвон с Мариной в четверг в 15»';
  function guess(v) { // мгновенная подсказка, пока пишете; настоящий разбор делает Claude
    v = v.toLowerCase();
    if (/https?:|www\.|\.ru\b|\.com\b/.test(v)) return ['link', 'Ссылка · место подберу, уточним в разборе'];
    if (/(в|во) (понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)|завтра в|в \d{1,2}(:\d\d)?\b|созвон|встреч|набрать/.test(v)) {
      const m = v.match(/(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|завтра)/), h = v.match(/в (\d{1,2})(:\d\d)?\b/);
      return ['meet', 'Встреча' + (m ? ' · ' + m[1] : '') + (h ? ' · ' + h[1] + (h[2] || ':00') : '') + ' → в календарь'];
    }
    if (/^(купить|написать|позвонить|отправить|оплатить|сделать|ответить|заказать|забронировать|собрать|отдать)/.test(v)) return ['task', 'Дело → во входящие дела, срок спрошу в разборе'];
    if (v.trim().length > 3) return ['idea', 'Идея → проект подберу сам'];
    return [null, ''];
  }
  const cap = $('#cap');
  cap.addEventListener('input', () => {
    const [k, txt] = guess(cap.value);
    if (!manual) $$('.kinds .tab').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    $('#guess').innerHTML = k ? 'Похоже на: <b>' + esc(txt) + '</b>' : HINT;
  });
  $$('.kinds .tab').forEach((b) => b.onclick = () => { manual = manual === b.dataset.k ? null : b.dataset.k; $$('.kinds .tab').forEach((x) => x.classList.toggle('on', x.dataset.k === manual)); });

  function openCap(prefill) {
    app.classList.add('capturing'); showCompose();
    if (prefill) { cap.value = prefill; cap.dispatchEvent(new Event('input')); }
    setTimeout(() => { cap.focus(); cap.setSelectionRange(cap.value.length, cap.value.length); }, 300);
    if (tg && tg.BackButton && inTelegram) tg.BackButton.show();
  }
  function closeCap() { app.classList.remove('capturing'); stopRec(); if (tg && tg.BackButton && inTelegram) tg.BackButton.hide(); }
  if (tg && tg.BackButton) tg.BackButton.onClick(closeCap);
  $('.scrim').onclick = closeCap;
  function resetCompose() { cap.value = ''; manual = null; $$('.kinds .tab').forEach((x) => x.classList.remove('on')); $('#guess').textContent = HINT; }
  function showCompose() { $('#compose').hidden = false; $('#confirm').hidden = true; confirmNote = ''; }

  $('#save').onclick = async () => {
    const v = cap.value.trim();
    if (!v) { toast('Сначала напишите или надиктуйте'); return; }
    const btn = $('#save'); btn.disabled = true; btn.textContent = 'Разбираю…';
    try {
      parsed = (await call('capture', { text: v, hint: manual || '' })).items || [];
      if (!parsed.length) parsed = [rawItem(v)];
      showConfirm();
    } catch (e) {
      if (e && e.server) { fail(e); return; }
      parsed = [rawItem(v)]; showConfirm('Нет связи, Claude не разобрал. Проверьте тип — запись уйдёт, когда появится связь');
    }
    finally { btn.disabled = false; btn.textContent = 'Сохранить'; }
  };
  function rawItem(v) {
    const url = (v.match(/https?:\/\/\S+/) || [''])[0];
    return { type: manual || guess(v)[0] || 'idea', title: v, date: '', time: '', project: '', place: url ? S.config.defaultPlace : '', url };
  }
  function metaOf(it) {
    const p = [];
    if (it.type === 'meet') p.push((humanDate(it.date) || 'сегодня') + (it.time ? ' в ' + it.time : ', весь день') + ' → календарь');
    if (it.type === 'task') p.push(it.date ? 'срок ' + humanDate(it.date) + ' → в дела' : 'без срока → в разбор');
    if (it.type === 'link') p.push('→ ' + (it.place || S.config.defaultPlace) + (it.url ? ' · ' + host(it.url) : ''));
    if (it.type === 'idea') p.push('→ идеи');
    if (it.project) p.push(it.project);
    return p.join(' · ');
  }
  // Срок дела прямо при записи: выбранный день уходит в Google Tasks, «Без срока» — в разбор
  function dueChips(it) {
    const opts = [['Сегодня', addDays(0)], ['Завтра', addDays(1)], ['На неделе', weekDate()]];
    const known = opts.some(([, v]) => v === it.date);
    const custom = it.date && !known;
    return '<div class="dues">' + opts.map(([t, v]) => `<button class="due${it.date === v ? ' on' : ''}" data-due="${v}">${t}</button>`).join('') +
      `<button class="due${custom ? ' on' : ''}" data-due="__date">${custom ? esc(humanDate(it.date)) : 'Дата…'}</button>` +
      `<button class="due${it.date ? '' : ' on'}" data-due="">Без срока</button></div>`;
  }
  let confirmNote = '';
  function showConfirm(note) {
    if (note !== undefined) confirmNote = note;
    $('#compose').hidden = true; $('#confirm').hidden = false;
    const n = parsed.length;
    $('#confirm').innerHTML = `<h3>${n === 1 ? 'Вот что получилось' : 'Нашла ' + pn(n, ['запись', 'записи', 'записей'])}</h3><div class="hint">${esc(confirmNote || 'Тип меняется нажатием, текст можно поправить')}</div>` +
      parsed.map((it, i) => `<div class="item" data-i="${i}"><button class="kind">${KINDS[it.type]}</button><div class="body"><input value="${esc(it.title)}"><div class="meta">${esc(metaOf(it))}</div>${it.type === 'task' ? dueChips(it) : ''}</div><button class="drop" aria-label="Убрать">✕</button></div>`).join('') +
      '<input type="date" class="datepick" id="duepick" tabindex="-1">' +
      `<div class="sheet-row"><button class="btn big secondary" id="back">Назад</button><button class="btn big take-btn" id="commit"${n ? '' : ' disabled'}>Сохранить${n > 1 ? ' ' + n : ''}</button></div>`;
  }
  $('#confirm').addEventListener('change', (e) => {
    if (e.target.id !== 'duepick' || !e.target.value) return;
    parsed[e.target.dataset.i].date = e.target.value; showConfirm();
  });
  $('#confirm').addEventListener('input', (e) => { const row = e.target.closest('.item'); if (row && e.target.tagName === 'INPUT') parsed[row.dataset.i].title = e.target.value; });
  $('#confirm').addEventListener('click', async (e) => {
    const row = e.target.closest('.item');
    if (e.target.closest('.kind') && row) { const it = parsed[row.dataset.i]; it.type = KIND_ORDER[(KIND_ORDER.indexOf(it.type) + 1) % 4]; if (it.type === 'link' && !it.place) it.place = S.config.defaultPlace; hap('light'); return showConfirm(); }
    if (e.target.closest('.drop') && row) { parsed.splice(+row.dataset.i, 1); return showConfirm(); }
    const due = e.target.closest('.due');
    if (due && row) {
      if (due.dataset.due === '__date') {
        const dp = $('#duepick'); dp.dataset.i = row.dataset.i; dp.min = addDays(0); dp.value = parsed[row.dataset.i].date || addDays(0);
        try { dp.showPicker(); } catch (err) { dp.focus(); dp.click(); }
        return;
      }
      parsed[row.dataset.i].date = due.dataset.due; hap('light'); return showConfirm();
    }
    if (e.target.id === 'back') return showCompose();
    if (e.target.id === 'commit') {
      const items = parsed.filter((x) => x.title.trim());
      if (!items.length) return;
      send('save', { items }); // уходит в фоне, шторка закрывается сразу
      hap('success'); resetCompose(); closeCap();
      const by = {}; items.forEach((x) => by[x.type] = (by[x.type] || 0) + 1);
      const F = { task: ['дело', 'дела', 'дел'], idea: ['идея', 'идеи', 'идей'], meet: ['встреча', 'встречи', 'встреч'], link: ['ссылка', 'ссылки', 'ссылок'] };
      toast('Записано: ' + Object.keys(by).map((k) => pn(by[k], F[k])).join(', '));
      renderToday(); if (current === 'ideas') renderIdeas();
    }
  });

  // Надиктовать: распознавание речи браузера, если оно есть
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function stopRec() { if (rec) { try { rec.stop(); } catch (e) {} rec = null; $('.mic').classList.remove('rec'); } }
  $('.mic').onclick = () => {
    if (rec) return stopRec();
    if (!SR) { toast('Нажмите микрофон на клавиатуре — так диктовать проще'); cap.focus(); return; }
    rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = true;
    const base = cap.value ? cap.value.trim() + ' ' : '';
    rec.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; cap.value = base + t; cap.dispatchEvent(new Event('input')); };
    rec.onend = stopRec; rec.onerror = () => { stopRec(); toast('Микрофон недоступен — попробуйте с клавиатуры'); };
    try { rec.start(); $('.mic').classList.add('rec'); toast('Говорите, я слушаю…'); } catch (e) { stopRec(); }
  };

  // ---------- Старт ----------
  (function start() {
    S.config = store.get('c:config', S.config);
    call('config').then((c) => { S.config = c; store.set('c:config', c); }).catch(() => {});
    renderSync(); loadToday(); loadDeck(); pump();
  })();
})();
