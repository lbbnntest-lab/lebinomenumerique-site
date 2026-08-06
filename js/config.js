// ============================================================================
// CONFIGURATION — À remplir avant déploiement sur Hostinger
// Ce fichier ne contient QUE des clés publiques (anon key Supabase = safe
// côté client car protégée par les policies RLS). Ne JAMAIS mettre ici la
// clé service_role Supabase ni la clé secrète Stripe.
// ============================================================================

window.APP_CONFIG = {
  SUPABASE_URL: "https://byosduzwxhudjjsdexgb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_41277wV5dt7I560_voV0og_s33YZuDc",

  // URL de base de votre instance n8n (auto-hébergée ou n8n cloud)
  N8N_BASE_URL: "https://lbn.app.n8n.cloud/webhook",

  // Clé publique Stripe (pk_live_... / pk_test_...) si vous ajoutez Stripe.js
  STRIPE_PUBLIC_KEY: "pk_test_51TxaYgPYLCUOQdeILQun78Ox8b2NdWI6sY1Xda7tzHTAghNOo8J0qt7fLeeCffHQ8sno9SPSK8MvXVcbFipjnN6i0037qW6Lef",

  // Un Price ID par cycle de facturation (mensuel/trimestriel/annuel) pour
  // chaque plan — voir grille_tarifaire_complete.md pour le détail des tarifs.
  // BRIQUE_ANTI_DEMARCHAGE volontairement absente : non vendable en l'état.
  STRIPE_PRICES: {
    B2C_SOLO: { mensuel: "price_1TyoQwPYLCUOQdeI60a0KQdz", trimestriel: "price_1TyoY3PYLCUOQdeIUNtdjaqF", annuel: "price_1TyoY3PYLCUOQdeI9RnZfaWA" },
    B2C_ESSENTIEL: { mensuel: "price_1TyoaNPYLCUOQdeIVlbEN1lZ", trimestriel: "price_1TyodSPYLCUOQdeIBCfxxlsd", annuel: "price_1TyodSPYLCUOQdeIH3LeQJd5" },
    B2C_FAMILLE: { mensuel: "price_1TyodfPYLCUOQdeISDyLKASY", trimestriel: "price_1TyoeZPYLCUOQdeIgoQ3f22h", annuel: "price_1TyoeZPYLCUOQdeI822F1CCl" },
    B2C_SERENITE: { mensuel: "price_1TyofFPYLCUOQdeIURtRvHD7", trimestriel: "price_1TyogJPYLCUOQdeIhMjqtVu3", annuel: "price_1TyogJPYLCUOQdeIJewJ2BoI" },
    B2B_STARTER: { mensuel: "price_1TyoiRPYLCUOQdeIpYOLpnEZ", trimestriel: "price_1Tyok1PYLCUOQdeI3iLOwIQ1", annuel: "price_1Tyok1PYLCUOQdeIiy8Ir4oH" },
    B2B_BUSINESS: { mensuel: "price_1Tyom5PYLCUOQdeILr6PICO6", trimestriel: "price_1TyomtPYLCUOQdeIX24emex0", annuel: "price_1TyomtPYLCUOQdeIhDA8xTkJ" },
    B2B_ENTERPRISE: { mensuel: "price_1TyonUPYLCUOQdeIwYnzZr1x", trimestriel: "price_1Tyoo5PYLCUOQdeIEpzoTGBP", annuel: "price_1Tyoo5PYLCUOQdeIlrTXCKeM" },
    BRIQUE_COORDINATEUR_FAMILIAL: { mensuel: "price_1TypKlPYLCUOQdeI7a8yLk1q", trimestriel: "price_1TypLPPYLCUOQdeIhx9xUC4T", annuel: "price_1TypLPPYLCUOQdeIrp3TeLNa" },
    BRIQUE_CHASSEUR_FORFAIT: { mensuel: "price_1TypVTPYLCUOQdeI71zMyaUu", trimestriel: "price_1TypW8PYLCUOQdeIJG8cZ0wn", annuel: "price_1TypW8PYLCUOQdeIYINV0yZE" }
  },

  // Lien de votre type d'événement Cal.com ("Appel découverte 15 min")
  CAL_COM_LINK: "lebinomenumerique/decouverte-15min"
};
