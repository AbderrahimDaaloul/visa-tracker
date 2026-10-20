# VisaTrack TN

Plateforme communautaire et **agnostique d'ambassade** (non affiliée à VFS Global ou à l'Ambassade d'Italie) qui permet aux étudiant·e·s tunisien·ne·s applicant à des études en **Italie** de partager, de façon anonyme, leurs délais réels de visa : rendez-vous VFS, dépôt de dossier, réponse du consulat.

- Contribuer en 2 minutes (3 cartes : RDV / dossier / réponse) — **aucun document à téléverser**
- Tableau communautaire : **17 graphiques** (délais, taux d'accord, calendrier des créneaux, survie Kaplan-Meier, funnel, cohortes…)
- Mon parcours (P1–P8) : étape actuelle, « Suis-je en retard ? », compte à rebours, position dans l'attente, fenêtre P25–P90
- Mes cohortes : étudiants avec le même RDV / la même date d'envoi (exact, ±3 j, semaine, mois)
- Modération : signalements, masquage automatique à ≥ 3 flags ouverts, bannissement, audit console
- Auth sans mot de passe : code OTP à 6 chiffres (15 min), pseudonyme, emails chiffrés (AES-GCM) + hachés (SHA-256)

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

Au **premier appel API**, le schéma est créé automatiquement puis **560 candidatures de démonstration (640 comptes)** sont insérées (source aléatoire déterministe). Pour désactiver le seed : `SEED_DEMO=0`.

`.env.local` recommandé sous Windows :

```ini
PGLITE_DATA_DIR=C:\Users\<vous>\AppData\Local\visatrack-tn\pglite
SEED_DEMO=1
```

Commandes :

```bash
npm run dev          # développement
npm run build        # build production (typecheck inclus)
npm start            # serveur production
npm test             # vitest (helpers statistiques)
npm run lint         # eslint
```

---

## Connexion (démo / dev)

1. `/login` → saisir un email → **code OTP affiché** dans l'alerte (mode dev, `devCode` ; en prod : Resend via `RESEND_API_KEY`).
2. Premier login : choisir un **pseudo** (3–20 alphanumériques + `_`).
3. Comptes de test en dev uniquement :
   - `admin@visatrack.local` → rôle **admin**
   - `moderator@visatrack.local` → rôle **moderator**
4. Limites locales : 5 OTP/email/heure, 30 OTP/IP/heure.

---

## Basculer vers Supabase (production)

```ini
DATABASE_URL=postgresql://postgres:<mot-de-passe>@<projet>.supabase.co:5432/postgres
SEED_DEMO=0
RESEND_API_KEY=re_...
```

- Le même schéma s'applique (`ensureSchema`, `CREATE TABLE IF NOT EXISTS`) — compatible PGLite *et* Postgres.
- `serverExternalPackages: ["@electric-sql/pglite", "postgres"]` déjà configuré dans `next.config.ts`.
- Les emails sont stockés **hachés** (`email_hash`, unicité) + **chiffrés** (`email_enc`) : définissez `ENCRYPTION_KEY` (32 octets hex) pour déchiffrer en production.

---

## Structure

```
src/
├── app/
│   ├── page.tsx                    # accueil
│   ├── login/ contribute/ visualize/ journey/ cohorts/ settings/ admin/
│   └── api/
│       ├── auth/                   # request-otp, verify-otp, logout
│       ├── me/ applications/       # profil, candidatures, benchmark, events, flags
│       ├── stats/                  # 16 endpoints (pulse, wait-trend, …, lead-time)
│       ├── cohorts/ centers/ flags/
│       └── admin/                  # overview + actions (ban/hide/unhide/resolve)
├── components/                     # ui.tsx (kit), nav, filters, chartCard, echartBox
├── lib/
│   ├── db/                         # client (driver-agnostic), schema, ddl, init, seed
│   ├── stats/                      # base (filtres SQL, k=5), compute (17 graphiques purs), run
│   ├── auth.ts crypto.ts email.ts api.ts validation.ts contribution.ts constants.ts i18n.ts
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

```bash
npm test   # 34 tests
```

---

## Journal de session

Voir `SESSION-LOG.md` (historique des corrections : bugs SQL, seed, Tailwind, encodages, smoke tests).
