# Gestion de mariage (PWA)

Budget et prestataires, liste d'invités, plan de salle 2D. Installable sur
téléphone, utilisable à deux, synchronisé en direct.

**En ligne : https://mariage-rose-chi.vercel.app**

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (PostgreSQL, Auth anonyme, Realtime)
- react-konva pour le plan de salle
- Service Worker maison (hors-ligne + notifications push)

## Fonctionnement

### Prestataires et versements

Un prestataire a un **montant de contrat** et une liste de **versements**.
Chaque versement a un libellé, un montant, une date et une case « payé ».
Le reste à payer se calcule seul.

Deux façons d'ajouter des versements :

- **Une seule fois** — un versement daté (acompte, solde…).
- **Tous les mois** — 250 € le 5 de chaque mois pendant 12 mois : l'app crée
  les 12 versements datés d'un coup, chacun avec sa date, sa case à cocher et
  son rappel.

Un versement peut être marqué « le jour du mariage » : il prend
automatiquement la date saisie dans Paramètres.

### Invités

Adulte / enfant / bébé, statut RSVP, groupe, table assignée. Compteurs,
recherche et filtres.

### Plan de salle

Tables rondes (6/8/10/12) ou rectangulaires, en glisser-déposer. Repères :
piste de danse, DJ, entrée, buffet. Tables et repères se redimensionnent par
la poignée du coin bas-droit et se suppriment par la croix. Pour placer un
invité : le sélectionner dans le panneau, puis cliquer une chaise libre.

### Accès à deux

Paramètres → Accès à deux → envoyer le lien. En l'ouvrant, le second
téléphone rejoint le même espace ; son espace vide est abandonné. Pas de
compte, pas de mot de passe.

Sans ce lien, **chaque appareil crée son propre espace** : les deux
téléphones auraient deux mariages séparés.

### Rappels

Deux mécanismes complémentaires :

- **Push** (app fermée) : notification à J-14, J-7, la veille et le jour même
  de chaque versement non payé. Cron quotidien à 8h, voir `vercel.json`.
- **Local** (à l'ouverture) : un résumé des versements proches ou en retard,
  au plus une fois par jour.

À activer par appareil dans Paramètres. Sur iPhone, il faut d'abord installer
l'app sur l'écran d'accueil, sinon iOS refuse les notifications web.

## Installation d'une copie

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. SQL Editor → exécuter [`supabase/schema.sql`](supabase/schema.sql).
3. Authentication → Sign In / Providers → activer **Anonymous Sign-Ins**.
4. Project Settings → API → copier `Project URL` et la clé `anon public`.
5. Dans `app_secrets`, remplacer la valeur de `cron_secret` par une chaîne
   aléatoire, et la reporter dans `CRON_SECRET`.

Sur une base existante, appliquer plutôt les migrations dans l'ordre :
[`migration-02-echeancier.sql`](supabase/migration-02-echeancier.sql) puis
[`migration-03-rappels.sql`](supabase/migration-03-rappels.sql).

### 2. Variables d'environnement

```bash
cp .env.example .env.local
```

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique (protégée par RLS) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | abonnement push côté navigateur |
| `VAPID_PRIVATE_KEY` | signature des envois push |
| `VAPID_SUBJECT` | `mailto:` de contact exigé par la spec Web Push |
| `CRON_SECRET` | protège la route de rappel et les fonctions SQL |

Générer une paire VAPID :

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Aucune clé `service_role` n'est nécessaire : le cron lit les échéances via des
fonctions `SECURITY DEFINER` protégées par `CRON_SECRET`.

### 3. Lancer

```bash
npm install && npm run dev
```

Aucun compte à créer : une session anonyme et un espace sont créés au premier
chargement.

### 4. Déployer

```bash
npx vercel deploy --prod --archive=tgz
```

Renseigner les variables ci-dessus dans les paramètres du projet Vercel, et
désactiver **Deployment Protection** si l'app doit être ouverte par quelqu'un
qui n'a pas de compte Vercel.

## Sécurité

Les policies Row Level Security cloisonnent tout par espace : un utilisateur
ne lit et n'écrit que les données des espaces dont il est membre. La table
`app_secrets` a RLS activée sans aucune policy — elle est donc totalement
inaccessible depuis l'API REST.

**Un jeton expiré ne renvoie pas d'erreur** : les policies ne correspondent
plus, les lectures rendent une liste vide et les écritures ne touchent aucune
ligne, le tout en HTTP 200. C'est pourquoi `lib/supabase/session.ts` rafraîchit
le jeton avant chaque requête et `lib/supabase/write.ts` vérifie qu'une ligne a
bien été affectée. Sans ça, l'app affichait un espace vide ou annonçait des
sauvegardes fantômes.

## Structure

```
src/
  app/
    (app)/                  tableau de bord, prestataires, invités, plan, paramètres
    join/[code]/            rejoindre un espace partagé
    api/cron/               envoi des rappels push
    manifest.ts             manifest PWA
  components/               vendors/, guests/, floorplan/, layout/, ui/
  hooks/                    use-household, use-vendors, use-guests, use-tables…
  lib/supabase/             clients, fraîcheur de session, écritures vérifiées
  lib/vendor-status.ts      calculs de statut, d'échéance et d'urgence
supabase/                   schéma complet et migrations
public/sw.js                cache hors-ligne et réception des notifications
```
