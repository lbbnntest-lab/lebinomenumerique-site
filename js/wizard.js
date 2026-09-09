/* ============================================================================
   wizard.js — assistant de commande en étapes.

   HTML attendu :
     <form data-wizard ...>
       <div class="wiz-tete"></div>            <!-- rempli par le script -->
       <section class="wiz-step" data-titre="Votre offre"> ... </section>
       <section class="wiz-step" data-titre="Votre entreprise"> ... </section>
       ...
       <section class="wiz-step" data-titre="Récapitulatif" data-recap>
         <div class="wiz-recap" data-wiz-recap></div>
       </section>
       <div class="wiz-nav"></div>              <!-- rempli par le script -->
       <div class="wiz-msg" id="zone-message"></div>
     </form>

   - "Suivant" valide les champs requis de l'étape courante (reportValidity).
   - La dernière étape affiche "Payer" (type=submit) -> le handler submit de la
     page s'exécute normalement (les IDs de champs ne changent pas).
   - Récap : lignes auto depuis les champs [data-recap] ; la page peut fournir
     window.wizardRecap() -> { lignes:[{k,v}], total?, note? } pour surcharger.
   ========================================================================== */
(function () {
  function initWizard(form) {
    var steps = Array.prototype.slice.call(form.querySelectorAll('.wiz-step'));
    if (steps.length < 2) return;
    var tete = form.querySelector('.wiz-tete');
    var nav = form.querySelector('.wiz-nav');
    var titrePrincipal = form.getAttribute('data-titre') || 'Commander';
    var i = 0;

    // ---- construction en-tête ----
    tete.innerHTML =
      '<h1>' + titrePrincipal + '</h1>' +
      '<div class="wiz-compteur"></div>' +
      '<div class="wiz-barre"><div class="wiz-barre-fill"></div></div>' +
      '<div class="wiz-pastilles"></div>';
    var compteur = tete.querySelector('.wiz-compteur');
    var barre = tete.querySelector('.wiz-barre-fill');
    var pastilles = tete.querySelector('.wiz-pastilles');

    steps.forEach(function (s, idx) {
      var nom = s.getAttribute('data-titre') || ('Étape ' + (idx + 1));
      var p = document.createElement('div');
      p.className = 'wiz-pastille';
      p.innerHTML = '<span class="rond" data-num="' + (idx + 1) + '"></span><span>' + nom + '</span>';
      p.addEventListener('click', function () { if (idx < i) aller(idx); });
      pastilles.appendChild(p);

      // titre h2 injecté si absent
      if (!s.querySelector('h2')) {
        var h = document.createElement('h2');
        h.textContent = nom;
        s.insertBefore(h, s.firstChild);
      }
    });

    // ---- navigation ----
    nav.innerHTML =
      '<button type="button" class="wiz-prec" hidden>← Précédent</button>' +
      '<button type="button" class="btn btn-primaire wiz-suiv">Suivant</button>' +
      '<button type="submit" class="btn btn-primaire wiz-payer" hidden></button>';
    var btnPrec = nav.querySelector('.wiz-prec');
    var btnSuiv = nav.querySelector('.wiz-suiv');
    var btnPayer = nav.querySelector('.wiz-payer');
    var labelPayer = form.getAttribute('data-cta') || 'Continuer vers le paiement';

    btnPrec.addEventListener('click', function () { aller(i - 1); });
    btnSuiv.addEventListener('click', function () {
      if (!validerEtape(steps[i], i)) return;
      aller(i + 1);
    });

    function validerEtape(step, idx) {
      var champs = step.querySelectorAll('input, select, textarea');
      for (var k = 0; k < champs.length; k++) {
        var c = champs[k];
        if (c.disabled || c.type === 'hidden' || c.offsetParent === null) continue;
        // ne pas bloquer sur un champ dans un <details> replié
        var det = c.closest('details');
        if (det && !det.open) continue;
        if (!c.checkValidity()) { c.reportValidity(); return false; }
      }
      // validateur métier optionnel fourni par la page : renvoie true | message d'erreur
      if (typeof window.wizardValiderEtape === 'function') {
        var r = window.wizardValiderEtape(idx);
        if (r !== true && r != null) {
          var zone = form.querySelector('#zone-message') || form.querySelector('.wiz-msg');
          if (zone) zone.innerHTML = '<p class="message-erreur">' + echap(r) + '</p>';
          return false;
        }
      }
      return true;
    }

    function estRecap(step) { return step.hasAttribute('data-recap'); }

    function rendreRecap(step) {
      var cible = step.querySelector('[data-wiz-recap]');
      if (!cible) return;
      var data = (typeof window.wizardRecap === 'function') ? window.wizardRecap() : null;
      var lignes = data && data.lignes ? data.lignes : lignesAuto();
      var html = lignes.map(function (l) {
        return '<div class="wiz-recap-ligne"><span class="k">' + echap(l.k) +
               '</span><span class="v">' + echap(l.v) + '</span></div>';
      }).join('');
      if (data && data.total) {
        html += '<div class="wiz-recap-total"><span class="k">' +
                echap(data.totalLabel || 'À régler maintenant') +
                '</span><span class="v">' + echap(data.total) + '</span></div>';
      }
      if (data && data.note) html += '<p class="wiz-recap-note">' + echap(data.note) + '</p>';
      cible.innerHTML = html;
    }

    function lignesAuto() {
      var out = [];
      form.querySelectorAll('[data-recap]').forEach(function (c) {
        var val = '';
        if (c.tagName === 'SELECT') val = c.options[c.selectedIndex] ? c.options[c.selectedIndex].text : '';
        else if (c.type === 'checkbox') val = c.checked ? 'Oui' : '';
        else val = (c.value || '').trim();
        if (!val) return;
        var lab = c.getAttribute('data-recap') || labelDe(c);
        out.push({ k: lab, v: val });
      });
      return out;
    }

    function labelDe(c) {
      var l = c.closest('.champ') ? c.closest('.champ').querySelector('label') : null;
      return l ? l.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : c.name || c.id;
    }

    function echap(s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
      });
    }

    // ---- affichage d'une étape ----
    function aller(n, sansScroll) {
      if (n < 0 || n >= steps.length) return;
      i = n;
      steps.forEach(function (s, idx) { s.classList.toggle('is-active', idx === i); });
      Array.prototype.forEach.call(pastilles.children, function (p, idx) {
        p.classList.toggle('active', idx === i);
        p.classList.toggle('faite', idx < i);
      });
      var zone = form.querySelector('#zone-message') || form.querySelector('.wiz-msg');
      if (zone) zone.innerHTML = '';
      var pct = Math.round(((i + 1) / steps.length) * 100);
      barre.style.width = pct + '%';
      compteur.innerHTML = 'Étape ' + (i + 1) + ' sur ' + steps.length +
        ' <span class="wiz-etape-nom">· ' + (steps[i].getAttribute('data-titre') || '') + '</span>';

      var dernier = i === steps.length - 1;
      btnPrec.hidden = i === 0;
      btnSuiv.hidden = dernier;
      btnPayer.hidden = !dernier;
      btnPayer.textContent = labelPayer;

      if (estRecap(steps[i])) rendreRecap(steps[i]);
      if (!sansScroll) {
        var y = form.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }

    aller(0, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-wizard]').forEach(initWizard);
  });
})();
