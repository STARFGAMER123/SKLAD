// SKLAD v3.1 — логика окна настроек (выполняется в контексте страницы)
window.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  let ifaces = [];

  window.skladSettings.load().then(({ config, interfaces, serverReady }) => {
    $('port').value = config.port;
    $('dataDir').value = config.dataDir || '';
    $('autostart').checked = !!config.autostart;
    ifaces = interfaces;

    const bindSel = $('bind');
    for (const line of interfaces) {
      const [name, ip] = line.split(': ');
      const opt = document.createElement('option');
      opt.value = ip;
      opt.textContent = `${ip} (${name})`;
      bindSel.appendChild(opt);
    }
    bindSel.value = config.bind;
    if (bindSel.selectedIndex < 0) bindSel.value = '0.0.0.0';

    $('status').innerHTML = serverReady
      ? '<span class="ok">● Сервер работает · порт ' + config.port + '</span>'
      : '<span class="bad">● Сервер запускается…</span>';
  });

  $('save').addEventListener('click', async () => {
    const btn = $('save');
    btn.disabled = true;
    btn.textContent = 'Сохранение…';
    try {
      const res = await window.skladSettings.save({
        port: Number($('port').value) || 3270,
        bind: $('bind').value || '0.0.0.0',
        dataDir: $('dataDir').value.trim(),
        autostart: $('autostart').checked,
      });
      if (res.restartRequired) {
        $('status').innerHTML = '<span class="bad">● Перезапуск сервера с новым портом…</span>';
      }
      setTimeout(() => window.close(), 1200);
    } catch (e) {
      $('status').innerHTML = '<span class="bad">Ошибка сохранения</span>';
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  });
});
