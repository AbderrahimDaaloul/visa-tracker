# Journal de session — VisaTrack TN (20 octobre 2026)

Application : **visatrack-tn/** (Next.js 16.4.2 + Drizzle + PGLite local, tout en français)
Statut à la fin de la session : **application fonctionnelle** — build OK, dev serveur OK, seed de démo OK, auth OTP OK, 17 graphiques alimentés, toutes les pages rendues.

---

## 1. Corrections TypeScript (tsc + passage au vert)

- `RouteContext` n'existe pas dans `next/types` → remplacé par `{ params: Promise<{ id: string }> }` dans les routes dynamiques (`api/applications/[id]/route.ts`, `api/applications/[id]/events/route.ts`).
- `BaseRow` non exporté depuis `stats/compute.ts` → ajout de `export type { BaseRow }`.
- `schema` non exporté depuis `db/schema.ts` → ajout de `export const schema = { centers, users, otpCodes, sessions, applications, events, flags, notificationPrefs, meta }`.
- `MIN_SAMPLE_SIZE` non importé dans `stats/compute.ts`.
- `charts.ts` : ligne de tooltip heatmap réécrite (index typés `Number(arr[i])`), duplication `axisLabel` corrigée (ordre `...axisCommon` puis `axisLabel`).
- `journey/page.tsx` : `histogramBinOption` typé avec `as const` (xAxis `"category"`, yAxis `"value"`, série `"bar"`).
- `visualize/page.tsx` : `CohortTableStat` accepte `Envelope<unknown>` + cast local des semaines.
- `cohorts/page.tsx` : interpolation conditionnelle corrigée ("médiane X j" — accolade dans template literal).
- `contribute/page.tsx` : `AppRecord.status?: string` ajouté.
- `ui.tsx` : `Card` simplifié (suppression de `DetailHTMLAttributes` hérité).
- `layout.tsx` : `LayoutProps<"/">` → inline `{ children: React.ReactNode }`.
- `api/admin/route.ts` : GET async double-wrappé → `export function GET(): Promise<NextResponse>` + import `NextResponse`.
- ✅ `npx tsc --noEmit` : 0 erreur. ✅ `npm run build` : OK.

## 2. Bugs SQL critiques corrigés (500 sur /api/stats/*)

- **Cause :** `db.execute(`...WHERE ${baseSql(f)}`)` interpolait un objet Drizzle `SQL` dans une chaîne JS → SQL reçu : `WHERE [object Object]`.
- **Fix :** requêtes passées à `db.execute(sql`...`)` (template Drizzle) dans `stats/base.ts` (fetchBaseRows) et `api/stats/pulse`.
- **Rows helper :** ajout de `rowsOf()` dans `db/client.ts` (normalise `{rows}` de PGLite et l'array de postgres-js). Appliqué à : `stats/base.ts`, `api/stats/pulse`, `api/admin`, `api/flags`, cohortes `same-appointment` / `same-submission`.
- Bonus : `flags` route passe maintenant les IDs par paramètres `sql` (pas d'interpolation de chaînes).

## 3. Seed de démo (640 users / 560 applications) réparé

- **Bug 1 :** date de réponse clamps `today - 2j` pouvait précéder `docs_sent_date` → viole `CHECK response_date >= docs_sent_date`. Fix : une réponse prévue dans le futur reste `en_attente` (pas de clamp).
- **Bug 2 :** les IDs de centres étaient codés en dur (2/5/11) mais une base fraîche les génère 1/2/3 → distribution cassée. Fix : `[vfsId, embassyId, otherId] = centerIds` pondérés (80/15/5).
- **Bug 3 :** incohérence des vocabulaires — seed utilisait `studyLevel "ms"` et refus `docs_manquants/preuves_fina` ; validation zod exige `licence|master|doctorat` et `documents_manquants/preuve_financiere/admission/non_precise`. Fix : le seed est aligné sur les codes canoniques.
- Vérifié : `SCHEMA_OK` + `SEED_OK` via script tsx (`.data/test-init.ts`).

## 4. PGLite + OneDrive (environnement Windows)

- Le projet est sous OneDrive → verrous fichiers aléatoires `could not open file "base/5/...": Resource busy` + corruption de la base locale.
- **Fix :** PGLite déplacé hors de OneDrive via `.env.local` :
  ```
  PGLITE_DATA_DIR=<LOCALAPPDATA>\visatrack-tn\pglite
  SEED_DEMO=1
  ```
- `db/client.ts` accepte toujours `DATABASE_URL` (Supabase) en priorité, sinon PGLite avec ce dossier.

## 5. Tailwind v4 était silencieusement cassé → corrigé

- Diagnostic : création du scaffolding sans le template Tailwind → **pas de `@tailwindcss/postcss`**, pas de `postcss.config`. Toutes les classes utilitaires ne produisaient aucun CSS (seulement `.card`, `.btn` du CSS maison).
- `npm install -D @tailwindcss/postcss`
- `postcss.config.mjs` :
  ```js
  export default { plugins: ["@tailwindcss/postcss"] };
  ```
  (⚠️ pièges vécus : `Set-Content -Encoding utf8` ajoute un BOM `?{` qui casse le parse ; un bare JSON `{...}` n'est pas du JS valide.)
- Vérifié : chunk CSS dev = 34 Ko avec toutes les utilitaires (`bg-[var(--primary)]`, `flex`, etc.).
- `npm run build` re-passé : OK.

## 6. Smoke tests exécutés (tous verts)

| Test | Résultat |
|---|---|
| `GET /api/centers` | ✅ 3 centres IT |
| `GET /api/stats/pulse` | ✅ n=560, médiane 24 j, taux accordé 71 % |
| 15 endpoints `GET /api/stats/*` | ✅ tous n=560, insufficientData=false |
| Auth OTP (request → verify w/ pseudo → cookie vtt_session) | ✅ 200, cookie HttpOnly posé |
| `GET /api/me` avec cookie | ✅ user (pseudo, rôle, trustScore) |
| `POST /api/applications` | ✅ création |
| Events : `envoi_dossiers` / `rendez_vous` / `reponse` | ✅ validations correctes (dates futures refusées, RDV passé enregistré, cohortSize retourné) |
| `PATCH /api/applications/[id]` | ✅ (dates futures refusées comme voulu) |
| `GET /api/me/applications` | ✅ stage="inscrit", countdown RDV = 10 j |
| `GET /api/me/benchmark?applicationId=...` | ✅ centre→global, médiane 32 j, p25/p75/p90 |
| `GET /api/cohorts/same-appointment` | ✅ fenêtre ±3 j, funnel + médiane |
| Pages `/`, `/visualize`, `/cohorts`, `/contribute`, `/journey`, `/login`, `/settings`, `/admin` | ✅ toutes 200 |

Notes de test (quik) : sous PowerShell, `Invoke-RestMethod` n'envoie pas l'entête `Cookie` manuellement et casse les JSON avec `-d` de curl — utiliser `--data-binary "@fichier.json"` avec curl.exe.

## 7. Ce qu'il reste à faire (prochaines étapes)

- Tests vitest des helpers stats (`percentile`, `tukeyTrim`, `c9Survival`, `isoWeekOf`) — prévu, non encore écrit.
- README français (lancement, .env, switch Supabase via `DATABASE_URL`, seed demo).
- Flows admin/moderator (flag un entry, ban, hide) testés de bout en bout dans l'UI.
- Sauvegarde/propreité du dossier temporaire PGLite; option d'effacer `.data/pglite-test`.
- Déploiement : git init, push, puis variable `DATABASE_URL` Supabase + désactiver le seed en prod (`SEED_DEMO=0`).
- Correction cosmétique : caracteres `Ǹ` moiratés dans quelques messages français (`apiError`) — vérifier l'encodage des fichiers écrits en PowerShell.

## 8. Comment lancer

```bash
cd visatrack-tn
npm install         # déjà installé
npm run dev         # http://localhost:3000
```

- Base locale auto-créée + seed au premier appel API (dossier hors OneDrive, voir `.env.local`).
- Connexion démo admin : email `admin@visatrack.local` → le code OTP s'affiche dans la réponse `devCode` (mode dev uniquement) → pseudo au choix → rôle admin (dev only).
- Production/Supabase : définir `DATABASE_URL=postgres://...` et `SEED_DEMO=0`, puis `npm run build && npm start`.

## 9. Fichiers modifiés dans cette session

- `src/app/api/[applications|admin|flags|cohorts|stats]/...` — SQL Drizzle paramétré, `rowsOf`, imports.
- `src/lib/stats/base.ts` — fetchBaseRows via `sql` template.
- `src/lib/db/client.ts` — `rowsOf()`.
- `src/lib/db/seed.ts` — ordre dates corrigé, IDs centres dynamiques, vocabulaire aligné.
- `src/lib/auth.ts` — temp debug retiré (plus de logs).
- `.env.local` (nouveau), `postcss.config.mjs` (nouveau), `package.json` (+`@tailwindcss/postcss`).
- `src/lib/contribution.ts` — slotBookedOn appliqué aux updates.

---

## 10. Session 2 — finition (20 octobre 2026)

- Correction du funnel de la page « Mon parcours » (`responses_recues`) et du libellé de zone (« en avance »).
- Seed aligné sur le vocabulaire canonique (`etudiant_d`), centres pondérés par type (VFS/ambassade/autre) et intakes 01/05/09 ; migration de réparation `seed_version = 2`.
- Emails de démonstration désormais chiffrés (AES-256-GCM, IV aléatoire) ; déchiffrement rétro-compatible des anciennes valeurs en clair.
- Paramètres : les préférences de notifications sont chargées puis enregistrées (`/api/me` renvoie `prefs`).
- Suppression de candidature depuis la page Contribuer (confirmation en deux temps).
- Sécurité : requêtes admin/cohortes/suppression de compte paramétrées, garde-fous anti-auto-bannissement et anti-bannissement de l'équipe, validation renforcée des contributions.
- Journal d'audit persisté (`audit_log`) et affiché dans la console admin ; retours d'erreur visibles.
- Navigation mobile : lien Admin ajouté.
- Tests : 44 tests (stats, contribution, crypto), `tsc`, `eslint` et `npm run build` verts.

## 11. Session 2 � durcissement production / Supabase (20 octobre 2026)

- OTP production : plus aucun devCode hors d�veloppement ; sans RESEND_API_KEY, l'API r�pond 503 avec un message clair et n'enregistre pas de code.
- ADMIN_EMAILS : bootstrap des administrateurs � la premi�re connexion (promotion d'un compte existant incluse).
- Donn�es de d�monstration strictement opt-in (SEED_DEMO=1) ; les 3 centres de r�f�rence sont cr��s s�par�ment et syst�matiquement (index unique centers_name_unique, ON CONFLICT (name) DO NOTHING).
- GET /api/health : �tat base, compteurs, email et admins configur�s.
- 
pm run db:init : initialisation idempotente du sch�ma + centres (utilisable avant le premier d�marrage Supabase).
- Connexion Postgres : timeout de connexion/veille, r�initialisation du pool en cas d'�chec (cold start).
- Purge des codes OTP expir�s depuis plus de 24 h ; wipeAll inclut udit_log.
- .env.example / .env.local / README : configuration Supabase + Resend document�e (cha�ne Postgres uniquement, cl�s anon/service_role inutiles).
- Tests : 47 tests (dont dminEmails), 	sc, eslint et 
pm run build verts. Base neuve v�rifi�e : 3 centres, 0 candidature, 0 utilisateur ; seed opt-in v�rifi� : 560 candidatures / 640 comptes.
- Reste � faire : renseigner DATABASE_URL Supabase + RESEND_API_KEY + ADMIN_EMAILS, puis 
pm run db:init et 
pm start.

---

## 12. Session 3 — Auth email/mot de passe + onboarding fixe (21 octobre 2026)

- Auth refondue : suppression totale des codes OTP, remplacés par email + mot de passe (scrypt) et Google OAuth optionnel (bouton masqué sans `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
- Réinitialisation de mot de passe par lien email signé (HMAC, empreinte du mot de passe, 30 min, usage unique) ; les anciens comptes OTP récupèrent un accès via « Mot de passe oublié ».
- Schéma `users` : ajout de `password_hash` et `auth_provider` ; routes `/api/auth/request-otp` et `/verify-otp` supprimées.
- Limites : 10 tentatives de connexion/email/15 min, 5 demandes de réinitialisation/email/heure ; sessions révoquées après changement de mot de passe.
- Onboarding : centre fixé à **Almaviva Tunisie**, visa fixé à **Visa étudiant (long séjour D)**, session et domaine supprimés ; seul le niveau **Licence/Master** est demandé.
- API candidatures : centre/visa/session forçés côté serveur, `intake` auto (prochain septembre), une seule candidature active par utilisateur.
- Tableau communautaire : le filtre mois s'appuie désormais sur les dates réelles (dossier/RDV), plus sur la session.
- Docs : README (auth, Google, onboarding, Supabase) mis à jour ; `.env.example` complété.
- Vérifications : `npx tsc --noEmit`, `npm run lint`, `npm test` (52 tests), `npm run build`, et test runtime création de candidature (valeurs client malveillantes ignorées, doublon 409).
