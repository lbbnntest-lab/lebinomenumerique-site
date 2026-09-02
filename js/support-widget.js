// Widget de support — bulle « Besoin d'aide ? » dans le dashboard client.
// Envoie chaque message à wf53 (webhook support-message) avec l'access_token
// du client connecté. Autonome : CSS injecté, aucune dépendance à style.css.
// Voir MASTER_PLAN.md §E-ter + migration 75.
(function () {
  var sessionId = "sup_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var accessToken = null;
  var envoiEnCours = false;

  var CSS = ""
    + "#sup-bulle{position:fixed;bottom:20px;right:20px;z-index:9998;background:#1F6F78;color:#fff;"
    + "border:none;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;"
    + "cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2)}"
    + "#sup-panneau{position:fixed;bottom:20px;right:20px;z-index:9999;width:min(360px,calc(100vw - 32px));"
    + "height:min(520px,calc(100vh - 40px));background:#fff;border:1px solid #e2e2e4;border-radius:14px;"
    + "display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22);"
    + "font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"
    + "#sup-panneau.sup-hidden,#sup-bulle.sup-hidden{display:none}"
    + "#sup-head{background:#1F6F78;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:600}"
    + "#sup-head button{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1}"
    + "#sup-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f7f7f8}"
    + ".sup-msg{max-width:85%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}"
    + ".sup-msg-assistant{background:#fff;border:1px solid #e5e7eb;align-self:flex-start}"
    + ".sup-msg-utilisateur{background:#1F6F78;color:#fff;align-self:flex-end}"
    + "#sup-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}"
    + "#sup-input{flex:1;padding:9px 11px;border:1px solid #d7d7db;border-radius:8px;font:inherit}"
    + "#sup-form button{background:#1F6F78;color:#fff;border:none;border-radius:8px;padding:0 14px;font:600 14px/1 inherit;cursor:pointer}";

  function injecterCss() {
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var compteur = 0;
  function ajouterMessage(role, texte) {
    var id = "sup-m-" + compteur++;
    var zone = document.getElementById("sup-msgs");
    var el = document.createElement("div");
    el.id = id;
    el.className = "sup-msg sup-msg-" + role;
    el.textContent = texte;
    zone.appendChild(el);
    zone.scrollTop = zone.scrollHeight;
    return id;
  }

  async function envoyer(message) {
    if (envoiEnCours) return;
    envoiEnCours = true;
    var idLoading = ajouterMessage("assistant", "…");
    try {
      if (!accessToken && window.supabaseClient) {
        var s = await window.supabaseClient.auth.getSession();
        accessToken = s && s.data && s.data.session ? s.data.session.access_token : null;
      }
      var resp = await fetch(window.APP_CONFIG.N8N_BASE_URL + "/support-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, session_id: sessionId, message: message })
      });
      var data = await resp.json();
      document.getElementById(idLoading).textContent =
        data.reponse || "Je transmets votre demande à l'équipe, ils reviennent vers vous rapidement.";
    } catch (e) {
      document.getElementById(idLoading).textContent =
        "Souci technique de mon côté — réessayez dans un instant, ou écrivez à support@lebinomenumerique.fr.";
    } finally {
      envoiEnCours = false;
    }
  }

  function creer() {
    injecterCss();

    var bulle = document.createElement("button");
    bulle.id = "sup-bulle";
    bulle.type = "button";
    bulle.textContent = "Besoin d'aide ?";

    var panneau = document.createElement("div");
    panneau.id = "sup-panneau";
    panneau.className = "sup-hidden";
    panneau.innerHTML =
      '<div id="sup-head"><span>Support Le Binôme Numérique</span><button type="button" id="sup-fermer" aria-label="Fermer">✕</button></div>' +
      '<div id="sup-msgs"></div>' +
      '<form id="sup-form"><input type="text" id="sup-input" placeholder="Votre question…" autocomplete="off" required><button type="submit">Envoyer</button></form>';

    document.body.appendChild(bulle);
    document.body.appendChild(panneau);

    ajouterMessage("assistant", "Bonjour ! Je peux répondre à vos questions sur vos produits, votre espace client et votre facturation. Si je ne peux pas régler quelque chose, je transmets à l'équipe. Que puis-je faire pour vous ?");

    function ouvrir() { panneau.classList.remove("sup-hidden"); bulle.classList.add("sup-hidden"); document.getElementById("sup-input").focus(); }
    function fermer() { panneau.classList.add("sup-hidden"); bulle.classList.remove("sup-hidden"); }
    bulle.addEventListener("click", ouvrir);
    document.getElementById("sup-fermer").addEventListener("click", fermer);

    document.getElementById("sup-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var input = document.getElementById("sup-input");
      var msg = input.value.trim();
      if (!msg) return;
      ajouterMessage("utilisateur", msg);
      input.value = "";
      await envoyer(msg);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", creer);
  } else {
    creer();
  }
})();
