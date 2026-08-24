// Chatbot en marque blanche — widget embarquable pour le site d'un CLIENT
// externe (pas le site du Binôme Numérique). Contrairement à chatbot-widget.js
// (qui s'appuie sur css/style.css déjà chargé sur nos propres pages), ce
// fichier est entièrement autonome : il injecte son propre <style>, car le
// site du client n'a aucune raison de connaître notre feuille de style.
//
// Intégration côté client : <script src=".../chatbot-widget-client.js" data-token="XXXX"></script>
(function () {
  const scriptTag = document.currentScript;
  const token = scriptTag ? scriptTag.getAttribute("data-token") : null;
  if (!token) {
    console.error("chatbot-widget-client.js : attribut data-token manquant sur la balise <script>.");
    return;
  }

  const N8N_BASE_URL = "https://lbn.app.n8n.cloud/webhook";
  const sessionId = "sessclient_" + Math.random().toString(36).slice(2);

  const COULEURS = {
    bleu: "#1F6F78", vert: "#2E7D32", rouge: "#B23A2E", orange: "#C9702A",
    jaune: "#C9A227", violet: "#6C4A9C", rose: "#C24F82", noir: "#1A1A1A",
    gris: "#4B5A66", marron: "#6B4A33", turquoise: "#1F9E8F"
  };

  function injecterStyle(couleurHex) {
    const style = document.createElement("style");
    style.textContent = `
      #lbn-chatbot-bulle {
        position: fixed; bottom: 24px; right: 24px; width: 58px; height: 58px;
        border-radius: 50%; background: ${couleurHex}; color: #fff;
        font-size: 1.5rem; border: none; box-shadow: 0 6px 20px rgba(0,0,0,.18); cursor: pointer; z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      }
      #lbn-chatbot-panneau {
        position: fixed; bottom: 92px; right: 24px; width: 320px; max-width: 90vw;
        height: 420px; max-height: 70vh; background: #fff; border-radius: 14px;
        box-shadow: 0 6px 20px rgba(0,0,0,.18); display: flex; flex-direction: column; overflow: hidden; z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      }
      #lbn-chatbot-panneau.hidden { display: none; }
      #lbn-chatbot-header {
        background: ${couleurHex}; color: #fff; padding: 12px 16px;
        display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: .9rem;
      }
      #lbn-chatbot-header button { background: none; border: none; color: #fff; cursor: pointer; font-size: 1rem; }
      #lbn-chatbot-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      .lbn-chatbot-msg { padding: 8px 12px; border-radius: 12px; font-size: .88rem; max-width: 85%; line-height: 1.4; }
      .lbn-chatbot-msg-assistant { background: #eef2f6; align-self: flex-start; color: #1a1a1a; }
      .lbn-chatbot-msg-utilisateur { background: ${couleurHex}; color: #fff; align-self: flex-end; }
      .lbn-chatbot-lien { display: inline-block; margin-top: 6px; padding: 6px 12px; border-radius: 8px; background: ${couleurHex}; color: #fff; text-decoration: none; font-size: .82rem; font-weight: 600; }
      #lbn-chatbot-form { display: flex; border-top: 1px solid #e5e7eb; }
      #lbn-chatbot-form input { flex: 1; border: none; padding: 10px 12px; font-size: .9rem; font-family: inherit; }
      #lbn-chatbot-form input:focus { outline: none; }
      #lbn-chatbot-form button { border: none; background: ${couleurHex}; color: #fff; padding: 0 14px; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }

  let compteur = 0;
  function ajouterMessage(role, texte, lienHtml) {
    const id = "lbn-msg-" + (compteur++);
    const zone = document.getElementById("lbn-chatbot-messages");
    const bulle = document.createElement("div");
    bulle.id = id;
    bulle.className = "lbn-chatbot-msg lbn-chatbot-msg-" + role;
    bulle.textContent = texte;
    if (lienHtml) bulle.appendChild(lienHtml);
    zone.appendChild(bulle);
    zone.scrollTop = zone.scrollHeight;
    return id;
  }

  async function envoyerMessage(message) {
    const idLoading = ajouterMessage("assistant", "...");
    try {
      const resp = await fetch(`${N8N_BASE_URL}/chatbot-client-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_widget: token, session_id: sessionId, message })
      });
      const data = await resp.json();
      const elReponse = document.getElementById(idLoading);
      elReponse.textContent = data.reponse || "Un conseiller va revenir vers vous rapidement.";
      if (data.rdv_lien) {
        const lien = document.createElement("a");
        lien.href = data.rdv_lien;
        lien.target = "_blank";
        lien.rel = "noopener";
        lien.className = "lbn-chatbot-lien";
        lien.textContent = "Prendre rendez-vous";
        elReponse.appendChild(document.createElement("br"));
        elReponse.appendChild(lien);
      }
      if (data.devis && data.devis.prix != null) {
        const blocDevis = document.createElement("div");
        blocDevis.style.marginTop = "6px";
        blocDevis.style.fontWeight = "700";
        blocDevis.textContent = `Estimation : ${data.devis.prix} €`;
        elReponse.appendChild(blocDevis);
      }
    } catch (err) {
      document.getElementById(idLoading).textContent = "Oups, une erreur est survenue — réessayez dans un instant.";
    }
  }

  function creerWidget(couleurHex, messageAccueil) {
    injecterStyle(couleurHex);

    const bulle = document.createElement("button");
    bulle.id = "lbn-chatbot-bulle";
    bulle.textContent = "💬";
    bulle.setAttribute("aria-label", "Ouvrir le chat");

    const panneau = document.createElement("div");
    panneau.id = "lbn-chatbot-panneau";
    panneau.className = "hidden";
    panneau.innerHTML = `
      <div id="lbn-chatbot-header">
        <span>Une question ?</span>
        <button id="lbn-chatbot-fermer" aria-label="Fermer">✕</button>
      </div>
      <div id="lbn-chatbot-messages"></div>
      <form id="lbn-chatbot-form">
        <input type="text" id="lbn-chatbot-input" placeholder="Écrivez votre question..." autocomplete="off" required>
        <button type="submit">Envoyer</button>
      </form>
    `;

    document.body.appendChild(bulle);
    document.body.appendChild(panneau);

    ajouterMessage("assistant", messageAccueil || "Bonjour ! Comment puis-je vous aider ?");

    bulle.addEventListener("click", () => panneau.classList.toggle("hidden"));
    document.getElementById("lbn-chatbot-fermer").addEventListener("click", () => panneau.classList.add("hidden"));

    document.getElementById("lbn-chatbot-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("lbn-chatbot-input");
      const message = input.value.trim();
      if (!message) return;
      ajouterMessage("utilisateur", message);
      input.value = "";
      await envoyerMessage(message);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    fetch(`${N8N_BASE_URL}/chatbot-client-config?token=${encodeURIComponent(token)}`)
      .then((r) => { if (!r.ok) throw new Error("config indisponible"); return r.json(); })
      .then((config) => {
        const couleurHex = COULEURS[(config.couleur_widget || "bleu").toLowerCase()] || COULEURS.bleu;
        creerWidget(couleurHex, config.message_accueil);
      })
      .catch(() => {
        // Silencieux : si la config est introuvable/le bot suspendu, ne rien afficher
        // plutôt qu'un widget cassé sur le site du client.
      });
  });
})();
