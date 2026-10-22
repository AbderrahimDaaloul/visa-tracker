import Link from "next/link";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="mx-auto max-w-3xl py-8 text-center">
        <Badge color="primary">Étudiants tunisiens · visa Italie</Badge>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{t.home.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">{t.home.subtitle}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/contribute"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-6 font-bold text-[var(--primary-fg)] transition-colors hover:bg-[var(--primary-hover)] sm:w-auto"
          >
            {t.home.contribute} →
          </Link>
          <Link
            href="/visualize"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 font-bold transition-colors hover:bg-[var(--background)] sm:w-auto"
          >
            {t.home.visualize} →
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Link href="/contribute" className="card block p-6 transition hover:shadow-lg">
          <h2 className="text-lg font-bold">{t.home.contribute}</h2>
          <p className="mt-1 text-sm text-muted">{t.home.contributeDesc}</p>
          <p className="mt-4 text-sm font-semibold text-[var(--primary)]">3 cartes simples, aucun document à téléverser</p>
        </Link>
        <Link href="/visualize" className="card block p-6 transition hover:shadow-lg">
          <h2 className="text-lg font-bold">{t.home.visualize}</h2>
          <p className="mt-1 text-sm text-muted">{t.home.visualizeDesc}</p>
          <p className="mt-4 text-sm font-semibold text-[var(--primary)]">17 graphiques : délais, taux, calendrier des créneaux…</p>
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Link href="/journey" className="card block p-6 transition hover:shadow-lg">
          <h2 className="text-lg font-bold">{t.home.journey}</h2>
          <p className="mt-1 text-sm text-muted">« Suis-je en retard ? » comparez votre attente à la médiane de votre centre.</p>
        </Link>
        <Link href="/cohorts" className="card block p-6 transition hover:shadow-lg">
          <h2 className="text-lg font-bold">{t.home.cohorts}</h2>
          <p className="mt-1 text-sm text-muted">Que s′est-il passé pour les étudiants avec votre même date de rendez-vous ou d′envoi ?</p>
        </Link>
      </section>

      <section className="card mx-auto max-w-3xl p-5 text-sm">
        <h2 className="font-bold">Comment ça marche</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Créez un compte (email vérifié, pseudo — jamais de nom réel).</li>
          <li>Ajoutez vos dates : rendez-vous, dossier envoyé, réponse.</li>
          <li>Tout le monde voit les tendances ; votre participation les rend précises.</li>
        </ol>
        <p className="mt-4 rounded-lg border-l-4 border-[var(--primary)] bg-[var(--background)] p-3 text-xs">{t.home.disclaimer}</p>
      </section>
    </div>
  );
}
