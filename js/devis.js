document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const codeAffiliation = params.get("code_affiliation");
  if (codeAffiliation) document.getElementById("code_affiliation").value = codeAffiliation;

  const caseRdvPhysique = document.getElementById("rdv_physique_souhaite");
  const champCodePostal = document.getElementById("champ-code-postal-rdv");
  const inputCodePostal = document.getElementById("code_postal_rdv");
  caseRdvPhysique.addEventListener("change", () => {
    champCodePostal.style.display = caseRdvPhysique.checked ? "block" : "none";
    inputCodePostal.required = caseRdvPhysique.checked;
  });

  document.getElementById("form-devis").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Envoi en cours...";

    const payload = {
      interet: document.getElementById("interet").value,
      prenom: document.getElementById("prenom").value,
      nom: document.getElementById("nom").value,
      email: document.getElementById("email").value,
      telephone: document.getElementById("telephone").value,
      budget_indicatif: document.getElementById("budget_indicatif").value,
      site_actuel_url: document.getElementById("site_actuel_url").value || null,
      rdv_physique_souhaite: document.getElementById("rdv_physique_souhaite").checked,
      code_postal_rdv: document.getElementById("rdv_physique_souhaite").checked ? document.getElementById("code_postal_rdv").value : null,
      message: document.getElementById("message").value,
      code_affiliation: document.getElementById("code_affiliation").value || null,
      source: "site_web"
    };

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/demande-devis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error("Erreur lors de l'envoi.");
      zoneMessage.innerHTML = `<p class="message-succes">Merci ! Votre demande est bien reçue, un email vient de vous être envoyé avec un lien pour réserver un appel immédiatement si vous le souhaitez.</p>`;
      document.getElementById("form-devis").reset();
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Envoyer ma demande";
    }
  });
});
