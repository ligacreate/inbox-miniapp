/* Связь с бэкендом.
   В Телеграме — POST на веб-приложение Apps Script с initData для проверки.
   На localhost без Телеграма — режим разработки: подставной пользователь и данные из mock.js. */
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  const q = new URLSearchParams(location.search);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const inTelegram = !!(tg && tg.initData);
  const DEV = !inTelegram && (local || q.has('dev'));

  let mockReady = null;
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Не загрузился ' + src));
      document.head.appendChild(s);
    });
  }

  async function call(action, params) {
    if (DEV) {
      // Списки проектов и мест — из того же файла, что у бэкенда
      mockReady = mockReady || loadScript('../backend/Config.js').then(() => loadScript('mock.js'));
      await mockReady;
      // Как на сервере: имя команды и параметры едут в одном объекте, поле action занято
      if (params && 'action' in params) throw new Error('Параметр action занят именем команды');
      return window.InboxMock.call(action, params || {});
    }
    if (!window.INBOX_API_URL) throw new Error('Не задан адрес бэкенда (web/config.js)');
    const res = await fetch(window.INBOX_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ initData: tg.initData }, params || {}, { action })),
    });
    const json = await res.json();
    if (!json.ok) {
      // Сервер ответил отказом: повторять бессмысленно (в отличие от обрыва связи)
      const err = new Error(json.error === 'unauthorized' ? 'Нет доступа' : json.error || 'Ошибка');
      err.server = true; throw err;
    }
    return json.data;
  }

  window.InboxAPI = { call, DEV, inTelegram, tg };
})();
