import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-spacing-xl py-spacing-5xl">
      <div className="animate-fade-up max-w-sm text-center">
        <p className="text-[var(--font-size-sm)] font-medium tracking-wide text-neutral-400 uppercase">
          For tired parents
        </p>
        <h1 className="mt-spacing-sm text-[var(--font-size-3xl)] font-bold tracking-tight text-neutral-900">
          BabyTalk
        </h1>
        <p className="mt-spacing-lg text-[var(--font-size-base)] leading-relaxed text-neutral-500">
          Track feeds, sleep, and diapers with your voice.
          No tapping, no typing — just talk.
        </p>
        <Link
          href="/auth/login"
          className="mt-spacing-3xl inline-flex items-center justify-center rounded-radius-lg bg-primary-500 px-spacing-3xl py-spacing-md text-[var(--font-size-base)] font-semibold text-white shadow-sm transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 hover:shadow-md active:scale-[0.98]"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
