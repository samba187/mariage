# Gestion de mariage (PWA)

Budget et prestataires, liste d'invités, plan de salle 2D. Installable sur
téléphone, utilisable à deux, synchronisé en direct.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (PostgreSQL, Auth, Realtime)
- react-konva pour le plan de salle
- Service Worker maison (hors-ligne + notifications push)

## Installation

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. SQL Editor → exécuter [`supabase/schema.sql`](supabase/schema.sql).
3. Authentication → Sign In / Providers → activer **Anonymous Sign-Ins**.
4. Project Settings → API → copier `Project URL` et la clé `anon public`.

Sur une base créée avec une version antérieure, exécuter
[`supabase/migration-02-echeancier.sql`](supabase/migration-02-echeancier.sql)
au lieu de `schema.sql`.

### 2. Variables d'environnement

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` suffisent pour
démarrer. Pour les notifications, générer une paire de clés VAPID :

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

### 3. Lancer

```bash
npm install && npm run dev
```

Aucun compte à créer : une session anonyme et un espace sont créés au premier
chargement.

## Fonctionnement

### Prestataires et versements

Un prestataire a un **montant de contrat** et une liste de **versements**.
Chaque versement a un libellé, un montant, une date et une case « payé ».
Le reste à payer se calcule seul.

Deux façons d'ajouter des versements :

- **Une seule fois** — un versement daté (acompte, solde...).
- **Tous les mois** — par exemple 250 € le 5 de chaque mois pendant 12 mois :
  l'app crée les 12 versements datés d'un coup, chacun avec son rappel et sa
  case à cocher.

Une échéance peut aussi être marquée « le jour du mariage » : elle prend
automatiquement la date saisie dans Paramètres.

### Invités

Adulte / enfant / bébé, statut RSVP, régime alimentaire, groupe, table
assignée. Compteurs, recherche et filtres.

### Plan de salle

Tables rondes (6/8/10/12) ou rectangulaires, en glisser-déposer. Repères :
piste de danse, DJ, entrée, buffet. Tables et repères se redimensionnent par
la poignée du coin bas-droit, et se suppriment par la croix. Placement d'un
invité : le sélectionner dans le panneau, puis cliquer une chaise libre.

### Accès à deux

Paramètres → Accès à deux → envoyer le lien. En l'ouvrant, le second
téléphone rejoint le même espace. Pas de compte, pas de mot de passe.

### Notifications

Rappels à J-14, J-7, la veille et le jour même de chaque versement non payé.
À activer par appareil dans Paramètres.

Pour que les rappels partent **application fermée**, il faut le déploiement en
ligne et deux variables supplémentaires :

- `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API)
- `CRON_SECRET` (chaîne aléatoire au choix)

[`vercel.json`](vercel.json) déclenche `/api/cron/payment-reminders` chaque
jour à 8h.

## Déploiement sur Vercel

1. Pousser sur GitHub, importer le dépôt sur [vercel.com](https://vercel.com).
2. Renseigner les variables d'environnement.
3. Déployer. HTTPS est requis pour l'installation PWA et les notifications.
4. Sur mobile : ouvrir l'URL → « Ajouter à l'écran d'accueil ».

## Structure

```
src/
  app/
    (app)/                  tableau de bord, prestataires, invités, plan, paramètres
    join/[code]/            rejoindre un espace partagé
    api/cron/               envoi des rappels
    manifest.ts             manifest PWA
  components/               vendors/, guests/, floorplan/, layout/, ui/
  hooks/                    use-household, use-vendors, use-guests, use-tables...
  lib/                      clients Supabase, calculs de statut et d'échéance
supabase/schema.sql         schéma complet + RLS + Realtime
public/sw.js                cache hors-ligne et notifications push
```

## Sécurité

Les policies Row Level Security de Supabase cloisonnent tout par espace : un
utilisateur ne lit et n'écrit que les données des espaces dont il est membre.
