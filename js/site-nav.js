// Menu mobile du site vitrine : ouvre/ferme la nav sous le header.
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('header.site nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', function () {
    var ouvert = nav.classList.toggle('ouvert');
    toggle.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    toggle.textContent = ouvert ? '✕' : '☰';
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') nav.classList.remove('ouvert');
  });
})();
