# VisaTrack TN

Plateforme communautaire (non affiliée à VFS Global ou à l'Ambassade d'Italie) qui permet aux étudiant·e·s tunisien·ne·s applicant à des études en **Italie** de partager, de façon anonyme, leurs délais réels de visa. Le parcours est centré sur **Almaviva Tunisie** et le **visa étudiant D (long séjour)**.

- Contribuer en 2 minutes (3 cartes : RDV / dossier / réponse) — **aucun document à téléverser**
- Onboarding simplifié : centre et type de visa fixes, seul le **niveau d'études** est demandé (**Licence** ou **Master**)
- Tableau communautaire : **17 graphiques** (délais, taux d'accord, calendrier des créneaux, survie Kaplan-Meier, funnel, cohortes…)
- Mon parcours (P1–P8) : étape actuelle, « Suis-je en retard ? », compte à rebours, position dans l'attente, fenêtre P25–P90
- Mes cohortes : étudiants avec le même RDV / la même date d'envoi (exact, ±3 j, semaine, mois)
- Modération : signalements, masquage automatique à ≥ 3 flags ouverts, bannissement, audit console
- Auth email + mot de passe, Google OAuth optionnel, réinitialisation par lien email, pseudonyme, emails chiffrés (AES-GCM) + hachés (SHA-256)

---

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| ORM | Drizzle ORM |
| Bases | **PGLite** (local, zéro config) *ou* **PostgreSQL/Supabase** via `DATABASE_URL` |
| Validation | Zod |
| Graphiques | ECharts |
| UI | Tailwind CSS v4 + kit maison (light/dark), tout en français |
| Tests | Vitest (`npm test`) |

> ⚠️ **Windows + OneDrive** : stockez la base locale **hors de OneDrive** (voir `.env.local` ci-dessous) — OneDrive verrouille les fichiers de PGLite (`Resource busy`).

---

## Démarrage rapide (local)

```bash
cd visatrack-tn
npm install
npm run dev          # http://localhost:3000
```

Au **premier appel API**, le schéma et les **3 centres de référence** sont créés automatiquement. La base reste vide de toute candidature. Pour charger les données de démonstration (560 candidatures / 640 comptes) : `SEED_DEMO=1` — jamais en production.

`.env.local` recommandé sous Windows :

```ini
PGLITE_DATA_DIR=C:\Users\<vous>\AppData\Local\visatrack-tn\pglite
SEED_DEMO=0
```

Commandes :

```bash
npm run dev          # développement
npm run build        # build production (typecheck inclus)
npm start            # serveur production
npm run db:init      # crée le schéma + les centres de référence (idempotent)
npm test             # vitest (helpers statistiques)
npm run lint         # eslint
```

---

## Connexion (démo / dev)

1. `/login` → email + mot de passe.
2. `/register` → pseudo (3–20 alphanumériques + `_`), email, mot de passe, **ou** « Continuer avec Google » si `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` sont configurés.
3. Mot de passe oublié : `/forgot-password` envoie un lien valable 30 minutes. Sans fournisseur email en dev, le lien s'affiche directement dans l'alerte.
4. Comptes de test en dev uniquement (à créer via `/register` avec ces emails) :
   - `admin@visatrack.local` → rôle **admin**
   - `moderator@visatrack.local` → rôle **moderator**
5. Limites locales : 10 tentatives de connexion/email/15 min, 5 demandes de réinitialisation/email/heure.

---

## Basculer vers Supabase (production)

VisaTrack utilise **uniquement la chaîne de connexion Postgres** de Supabase : ni la clé `anon`, ni la clé `service_role`, ni Supabase Auth ne sont nécessaires.

1. Créer un projet Supabase (région Europe de préférence).
2. **Project Settings → Database → Connection string** : copier l'URI du **Session pooler** (port `5432`) ou du **Transaction pooler** (port `6543`), remplacer le mot de passe, garder `?sslmode=require`.
3. Générer une clé stable : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Renseigner `.env.local` :

```ini
DATABASE_URL=postgresql://postgres.<projet>:<mot-de-passe>@<host>:6543/postgres?sslmode=require
SEED_DEMO=0
RESEND_API_KEY=re_...
EMAIL_FROM="VisaTrack TN <no-reply@votre-domaine.tn>"
EMAIL_CRYPT_KEY=<chaîne aléatoire longue et stable>
ADMIN_EMAILS=vous@votre-domaine.tn
# Optionnel : connexion Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=https://votre-domaine.tn
```

5. Initialiser : `npm run db:init` (crée les tables + les 3 centres, sans aucune candidature).
6. Démarrer : `npm run build` puis `npm start`, vérifier `GET /api/health`, puis se connecter avec une adresse de `ADMIN_EMAILS` (utilisez « Mot de passe oublié » pour définir le premier mot de passe).

- Le même schéma s'applique (`ensureSchema`, `CREATE TABLE IF NOT EXISTS`) — compatible PGLite *et* Postgres. Les 3 centres de référence sont créés automatiquement ; aucune donnée de démonstration n'est insérée.
- `serverExternalPackages: ["@electric-sql/pglite", "postgres"]` déjà configuré dans `next.config.ts`.
- `ADMIN_EMAILS` : ces adresses deviennent **admin** à leur première connexion (séparées par des virgules). Indispensable en production, car le compte de test `admin@visatrack.local` est réservé au mode dev.
- `RESEND_API_KEY` (ou SMTP) est **nécessaire en production** pour les liens de réinitialisation de mot de passe. Sans fournisseur, aucun lien n'est envoyé.
- Les emails sont stockés **hachés** (`email_hash`, unicité) + **chiffrés** (`email_enc`, AES-256-GCM avec IV aléatoire) : définissez une `EMAIL_CRYPT_KEY` longue et stable en production (la changer rend les emails existants illisibles).
- Vérification après déploiement : `GET /api/health` (base, compteurs, email/admin configurés).

---

## Structure

```
src/
├── app/
│   ├── page.tsx                    # accueil
│   ├── login/ register/ forgot-password/ reset-password/ contribute/ visualize/ journey/ cohorts/ settings/ admin/
│   └── api/
│       ├── auth/                   # login, register, forgot/reset-password, google, logout
│       ├── me/ applications/       # profil, candidatures, benchmark, events, flags
│       ├── stats/                  # 16 endpoints (pulse, wait-trend, …, lead-time)
│       ├── cohorts/ centers/ flags/
│       └── admin/                  # overview + actions (ban/hide/unhide/resolve)
├── components/                     # ui.tsx (kit), nav, filters, chartCard, echartBox
├── lib/
│   ├── db/                         # client (driver-agnostic), schema, ddl, init, seed
│   ├── stats/                      # base (filtres SQL, k=5), compute (17 graphiques purs), run
│   ├── auth.ts accounts.ts crypto.ts email.ts googleOAuth.ts api.ts validation.ts contribution.ts constants.ts i18n.ts
│   └── charts.ts                   # options ECharts
└── …
```

### Règles d'intégrité des données

- Median/k(min) = **n ≥ 5** par découpage, sinon `insufficientData: true` (enveloppe standard) — anti-identification.
- Les entrées avec **≥ 3 flags ouverts** sont exclues des statistiques et masquées.
- Filtrage global : `status = 'actif'`, utilisateur non banni, `trust_score ≥ 20`.
- Tukey fences (Q1 − 3·IQR, Q3 + 3·IQR) sur les délais ; déciles bornés.
- Pseudonymat : aucun nom réel ; pseudo changeable tous les 30 jours ; option « masquer mon pseudo dans les cohortes ».

---

## Tests

`src/lib/stats/compute.test.ts` couvre les briques pures : `percentile`, `medianW`, `tukeyTrim`, `isoWeekOf`, `dayDiff`, `waitOf`/`currentWaitOf`, `computedStage`, `c9Survival` (Kaplan-Meier), `envelope` (k=5).  
`src/lib/contribution.test.ts` couvre les règles métier de saisie (dates cohérentes, résultat/refus, avertissements).  
`src/lib/crypto.test.ts` couvre le chiffrement des emails et les helpers de mot de passe (aller-retour, IV aléatoire, normalisation, scrypt).  
`src/lib/adminEmails.test.ts` couvre le bootstrap admin via `ADMIN_EMAILS`.

```bash
npm test   # suite complète
```

---

## Journal de session

Voir `SESSION-LOG.md` (historique des corrections : bugs SQL, seed, Tailwind, encodages, smoke tests).
"# visa-tracker" 
