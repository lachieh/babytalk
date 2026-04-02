import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 safe-bottom safe-top">
      <div className="animate-fade-up w-full max-w-md text-center">
        <p className="text-sm font-medium tracking-widest text-neutral-400 uppercase">
          For tired parents
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
          BabyTalk
        </h1>
        <p className="mx-auto mt-4 max-w-6xl text-base leading-relaxed text-neutral-500">
          Track feeds, sleep, and diapers with your voice. No tapping, no
          typing&nbsp;&mdash; just talk.
        </p>
        <Link
          href="/auth/login"
          className="mt-12 inline-flex min-h-12 items-center justify-center rounded-lg bg-primary-500 px-12 py-3 text-base font-semibold text-white shadow-sm transition-[background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 hover:shadow-md active:scale-[0.98]"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
