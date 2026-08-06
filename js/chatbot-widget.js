// Bulle de chat flottante — envoie chaque message au workflow n8n
// "06_chatbot_IA_site" et affiche la réponse. Zéro dépendance externe.

(function () {
  const sessionId = "sess_" + Math.random().toString(36).slice(2);

  function creerWidget() {
    const bulle = document.createElement("button");
    bulle.id = "chatbot-bulle";
    bulle.textContent = "💬";
    bulle.setAttribute("aria-label", "Ouvrir le chat");

    const panneau = document.createElement("div");
    panneau.id = "chatbot-panneau";
    panneau.className = "hidden";
    panneau.innerHTML = `
      <div id="chatbot-header">
        <span>Une question ? On répond 24/7</span>
        <button id="chatbot-fermer" aria-label="Fermer">✕</button>
      </div>
      <div id="chatbot-messages"></div>
      <form id="chatbot-form">
        <input type="text" id="chatbot-input" placeholder="Écrivez votre question..." autocomplete="off" required>
        <button type="submit">Envoyer</button>
      </form>
    `;

    document.body.appendChild(bulle);
    document.body.appendChild(panneau);

    ajouterMessage("assistant", "Bonjour ! Je suis là pour répondre à vos questions sur nos offres (secrétariat virtuel, création de site web). Tout se passe en ligne par défaut, mais un rendez-vous en personne reste possible sur demande. Comment puis-je vous aider ?");

    bulle.addEventListener("click", () => panneau.classList.toggle("hidden"));
    document.getElementById("chatbot-fermer").addEventListener("click", () => panneau.classList.add("hidden"));

    document.getElementById("chatbot-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("chatbot-input");
      const message = input.value.trim();
      if (!message) return;
      ajouterMessage("utilisateur", message);
      input.value = "";
      const idLoading = ajouterMessage("assistant", "...");

      try {
        const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/chatbot-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, session_id: sessionId })
        });
        const data = await resp.json();
        document.getElementById(idLoading).textContent = data.reponse || "Un conseiller va revenir vers vous rapidement.";
      } catch (err) {
        document.getElementById(idLoading).textContent = "Oups, une erreur est survenue. Réservez plutôt un appel gratuit via le bouton en haut de page !";
      }
    });
  }

  let compteur = 0;
  function ajouterMessage(role, texte) {
    const id = "msg-" + (compteur++);
    const zone = document.getElementById("chatbot-messages");
    const bulle = document.createElement("div");
    bulle.id = id;
    bulle.className = "chatbot-msg chatbot-msg-" + role;
    bulle.textContent = texte;
    zone.appendChild(bulle);
    zone.scrollTop = zone.scrollHeight;
    return id;
  }

  // Survol d'une offre (carte tarifaire) : ouvre le chat et donne un détail
  // contextuel sur cette offre précise. Délai de 700ms avant déclenchement
  // (annulé si la souris repart avant, pour ne pas se déclencher au simple
  // passage en scrollant) et une seule fois par carte et par visite, pour
  // ne pas être envahissant.
  const cartesDejaSignalees = new WeakSet();
  function configurerSurvolOffres(panneau) {
    const cartes = document.querySelectorAll(".carte-plan[data-chatbot-detail]");
    cartes.forEach((carte) => {
      let minuteur = null;
      carte.addEventListener("mouseenter", () => {
        if (cartesDejaSignalees.has(carte)) return;
        minuteur = setTimeout(() => {
          cartesDejaSignalees.add(carte);
          panneau.classList.remove("hidden");
          const nomOffre = carte.querySelector("h3")?.textContent || "cette offre";
          ajouterMessage("assistant", `À propos de « ${nomOffre} » : ${carte.dataset.chatbotDetail}`);
        }, 700);
      });
      carte.addEventListener("mouseleave", () => {
        if (minuteur) clearTimeout(minuteur);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    creerWidget();
    configurerSurvolOffres(document.getElementById("chatbot-panneau"));
  });
})();
