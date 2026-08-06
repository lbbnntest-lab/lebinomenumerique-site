# Portail Client & Dashboard Commercial — Le Binôme Numérique

100% HTML/CSS/JS statique (aucun build, aucun serveur Node requis) — pensé pour un hébergement mutualisé abordable type **Hostinger**.

## Architecture

- **Auth + données** : [Supabase](https://supabase.com) (clé `anon` publique, protégée par les policies RLS définies dans `1_fondation_SaaS.sql` — chaque utilisateur ne voit que son propre compte).
- **Actions serveur sensibles** (création de compte, Stripe, calcul de commission) : déléguées aux workflows **n8n** (`/n8n_workflows/`), appelés en `fetch()` depuis le navigateur. La clé secrète Supabase (`service_role`) et la clé secrète Stripe restent uniquement côté n8n — jamais dans ce dossier.
- Aucune étape de build : on peut uploader le dossier tel quel en FTP.

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Landing page + grille tarifaire B2B/B2C |
| `inscription.html` | Formulaire d'inscription (bascule B2B avec champ SIRET / B2C) |
| `dashboard-client.html` | Espace client : demandes, factures, abonnement |
| `dashboard-commercial.html` | Espace commercial : lien d'affiliation, ventes, commissions |

## Déploiement sur Hostinger

1. Renseigner `js/config.js` avec vos vraies clés (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `N8N_BASE_URL`, prix Stripe).
2. Se connecter au **File Manager** Hostinger (ou FTP/FileZilla) et uploader tout le contenu de `frontend_saas/` dans `public_html/` (ou un sous-dossier si le site principal est ailleurs).
3. Activer le HTTPS gratuit (Let's Encrypt) depuis le panneau Hostinger — obligatoire pour Supabase Auth et Stripe.
4. Dans Supabase : Authentication → URL Configuration → ajouter le domaine Hostinger aux Redirect URLs.
5. Dans Stripe : Developers → Webhooks → pointer vers `https://votre-instance-n8n.com/webhook/stripe-webhook`.

## Limites volontaires (garder le hosting simple)

- Pas de framework (React/Vue) ni de bundler : évite tout risque de build cassé sur un hébergement mutualisé.
- Pas de backend PHP/Node à maintenir : toute la logique serveur vit dans n8n, déjà utilisé par le projet.
- Pour aller plus loin (SEO multi-pages, i18n, etc.), on pourra migrer vers un générateur statique (Astro/11ty) sans changer l'architecture Supabase/n8n.
