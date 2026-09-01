// Добавляет вкладку «live» в нижний переключатель основного интерфейса.
// Отдельным файлом, чтобы не трогать apt.js: своя кнопка перехватывает клик
// в фазе перехвата, поэтому логика переключения видов её не видит.
(function(){
  function add(){
    var nav=document.getElementById('slider');
    if(!nav||nav.querySelector('[data-live-tab]')) return true;
    var b=document.createElement('button');
    b.type='button'; b.textContent='live'; b.setAttribute('data-live-tab','1');
    b.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      location.href='/live.html';
    },true);
    nav.appendChild(b);
    return true;
  }
  if(!add()){
    var t=setInterval(function(){ if(add()) clearInterval(t); },400);
    setTimeout(function(){ clearInterval(t); },10000);
  }
})();
