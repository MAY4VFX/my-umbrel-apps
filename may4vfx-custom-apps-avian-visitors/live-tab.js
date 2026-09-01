// Вкладка «live» в нижнем переключателе основного интерфейса.
//
// Намеренно ссылка, а не кнопка: apt.js собирает переключатель как
//   var btns = slider.querySelectorAll('button')
// и сопоставляет кнопки с массивом из трёх заголовков видов. Лишняя кнопка
// ломает это соответствие и роняет инициализацию — интерфейс остаётся без
// стилей. Ссылку тот же селектор не видит, поэтому чужая логика не меняется.
(function () {
  function add() {
    var nav = document.getElementById('slider');
    if (!nav) return false;
    if (nav.querySelector('.live-tab')) return true;

    var css = document.createElement('style');
    css.textContent =
      '#slider a.live-tab{background:transparent;border:0;color:var(--ink-soft);' +
      'text-decoration:none;font:10px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;' +
      'text-transform:uppercase;padding:11px 24px;border-radius:999px;cursor:pointer;' +
      'position:relative;z-index:1;transition:color 200ms ease}' +
      '#slider a.live-tab:hover{color:var(--ink)}' +
      '#slider a.live-tab:active{color:var(--ink)}';
    document.head.appendChild(css);

    var a = document.createElement('a');
    a.className = 'live-tab';
    a.href = '/live.html';
    a.textContent = 'live';
    a.setAttribute('aria-label', 'Живой сигнал');
    nav.appendChild(a);
    return true;
  }

  if (!add()) {
    var t = setInterval(function () { if (add()) clearInterval(t); }, 400);
    setTimeout(function () { clearInterval(t); }, 10000);
  }
})();
