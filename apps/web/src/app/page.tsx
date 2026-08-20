"use client";

import Image from "next/image";
import Link from "next/link";

import { useAutoDarkMode } from "@/lib/use-auto-dark-mode";
import { useRedirectIfLoggedIn } from "@/lib/use-redirect-if-logged-in";

const HOW_IT_WORKS = [
  {
    body: "Say it naturally: “120 mil bottle at 2:10” or “she just went down for a nap.”",
    number: "01",
    title: "Talk like a parent",
  },
  {
    body: "BabyTalk puts the amount, time, and activity in the right place. No forms to finish.",
    number: "02",
    title: "The details get sorted",
  },
  {
    body: "Feeds, sleep, diapers, and pumping stay in one timeline your household can check.",
    number: "03",
    title: "Everyone stays caught up",
  },
];

const SUMMARY_ITEMS = [
  {
    color: "bg-feed-500",
    detail: "120 ml · Bottle",
    label: "Feed",
    time: "2:10 am",
  },
  {
    color: "bg-diaper-500",
    detail: "Wet",
    label: "Diaper",
    time: "1:42 am",
  },
  {
    color: "bg-sleep-500",
    detail: "1h 18m · Bassinet",
    label: "Sleep",
    time: "12:16 am",
  },
];

const SummaryIcon = ({ type }: { type: "feed" | "sleep" | "diaper" }) => {
  if (type === "feed") {
    return (
      <svg
        aria-hidden="true"
        className="mx-auto h-5 w-5 text-neutral-500"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M8 4h8M9 2h6v4H9zM8 6h8l1 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l1-3Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (type === "sleep") {
    return (
      <svg
        aria-hidden="true"
        className="mx-auto h-5 w-5 text-neutral-500"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="mx-auto h-5 w-5 text-neutral-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 7.5c1.7 1 3.7 1.5 6 1.5s4.3-.5 6-1.5M7 5v8.5a5 5 0 0 0 10 0V5M8 18.5l-2 2M16 18.5l2 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
};

export default function Home() {
  useRedirectIfLoggedIn();
  useAutoDarkMode();

  return (
    <main className="h-svh overflow-y-auto overflow-x-hidden bg-surface text-neutral-800 scroll-smooth">
      <header className="relative z-20 border-neutral-200/80 border-b">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link
            aria-label="BabyTalk home"
            className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            href="/"
          >
            <Image
              alt=""
              className="h-9 w-9 rounded-[10px]"
              height={36}
              priority
              src="/icons/icon.svg"
              width={36}
            />
            <span className="font-serif text-2xl tracking-tight text-neutral-900">
              BabyTalk
            </span>
          </Link>

          <nav
            aria-label="Homepage navigation"
            className="hidden items-center gap-8 md:flex"
          >
            <a
              className="flex min-h-11 items-center text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className="flex min-h-11 items-center text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
              href="#why-babytalk"
            >
              Why BabyTalk
            </a>
          </nav>

          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-5 text-sm font-semibold text-neutral-700 transition-[background-color,border-color,transform] duration-[var(--duration-normal)] hover:border-neutral-400 hover:bg-surface-raised active:scale-[0.98]"
            href="/auth/login"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-16 px-5 pt-16 pb-24 sm:px-8 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-12 lg:pt-20 lg:pb-28">
        <div className="relative z-10 animate-fade-up">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-primary-600 uppercase">
            <span className="h-px w-8 bg-primary-400" />
            Voice-first baby tracking
          </p>
          <h1 className="mt-6 max-w-[10ch] font-serif text-[clamp(3.6rem,6vw,5.5rem)] leading-[0.88] tracking-[-0.045em] text-neutral-900">
            Track every feed without stopping to type.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-neutral-600 sm:text-xl sm:leading-9">
            BabyTalk turns a quick sentence into a clear, shared record of
            feeds, sleep, diapers, and pumping. So no one has to remember what
            happened at 3am.
          </p>
          <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-primary-500 px-8 text-base font-semibold text-[oklch(97%_0.012_75)] shadow-[0_12px_30px_oklch(48%_0.06_100/0.2)] transition-[background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 hover:shadow-[0_16px_36px_oklch(48%_0.06_100/0.28)] active:scale-[0.98]"
              href="/auth/login"
            >
              Start tracking
            </Link>
            <a
              className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-neutral-700"
              href="#how-it-works"
            >
              See how it works
              <span
                aria-hidden="true"
                className="transition-transform duration-[var(--duration-normal)] group-hover:translate-x-1"
              >
                ↓
              </span>
            </a>
          </div>
          <p className="mt-6 text-xs leading-5 text-neutral-400">
            No password required. Sign in by email or passkey.
          </p>
        </div>

        <div
          aria-label="Example of BabyTalk turning a spoken update into a daily log"
          className="relative mx-auto w-full max-w-[34rem] lg:mx-0"
        >
          <div className="absolute -top-12 -right-24 h-64 w-64 rounded-[47%_53%_61%_39%/44%_42%_58%_56%] bg-sleep-100" />
          <div className="absolute -bottom-16 -left-20 h-56 w-56 rounded-[61%_39%_35%_65%/45%_56%_44%_55%] bg-feed-100" />

          <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-surface-raised p-5 shadow-[0_28px_80px_oklch(18%_0.008_50/0.12)] sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-serif text-2xl text-neutral-900">
                  Milo today
                </p>
                <p className="mt-1 text-[11px] font-medium tracking-[0.16em] text-neutral-400 uppercase">
                  Tuesday, August 18
                </p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-success-500 ring-4 ring-success-100" />
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2.5">
              <div className="rounded-[45%_55%_51%_49%/54%_43%_57%_46%] bg-feed-100 px-2 py-5 text-center">
                <SummaryIcon type="feed" />
                <p className="mt-2 font-serif text-xl text-neutral-800">
                  560 ml
                </p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-[0.13em] text-neutral-500 uppercase">
                  Fed
                </p>
              </div>
              <div className="rounded-[57%_43%_45%_55%/47%_57%_43%_53%] bg-sleep-100 px-2 py-5 text-center">
                <SummaryIcon type="sleep" />
                <p className="mt-2 font-serif text-xl text-neutral-800">
                  4h 20m
                </p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-[0.13em] text-neutral-500 uppercase">
                  Sleep
                </p>
              </div>
              <div className="rounded-[50%_50%_60%_40%/56%_43%_57%_44%] bg-diaper-100 px-2 py-5 text-center">
                <SummaryIcon type="diaper" />
                <p className="mt-2 font-serif text-xl text-neutral-800">5</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-[0.13em] text-neutral-500 uppercase">
                  Diapers
                </p>
              </div>
            </div>

            <div className="mt-7 border-neutral-200 border-t pt-6">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400 uppercase">
                Latest
              </p>
              <div className="mt-4 space-y-4">
                {SUMMARY_ITEMS.map((item) => (
                  <div className="flex items-center gap-3" key={item.label}>
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${item.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-700">
                        {item.label}
                      </p>
                      <p className="text-xs text-neutral-400">{item.detail}</p>
                    </div>
                    <p className="text-xs text-neutral-400">{item.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative -mt-7 ml-5 rounded-[1.5rem] border border-primary-200 bg-primary-50 p-4 shadow-[0_16px_40px_oklch(18%_0.008_50/0.12)] sm:-mt-10 sm:ml-12 sm:p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[oklch(97%_0.012_75)]">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M6 11.5v.5a6 6 0 0 0 12 0v-.5M12 18v3M9 21h6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </span>
              <div>
                <p className="font-serif text-lg leading-snug text-neutral-800 italic">
                  “Wet diaper. And a 120 mil bottle at 2:10.”
                </p>
                <p className="mt-2 text-xs font-medium text-primary-600">
                  Logged. That’s four feeds today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-neutral-200 border-y bg-surface-raised">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-8 gap-y-3 px-5 py-5 text-xs font-semibold tracking-[0.12em] text-neutral-500 uppercase sm:px-8 lg:px-12">
          <span>Log a feed</span>
          <span aria-hidden="true" className="text-primary-300">
            ·
          </span>
          <span>Start a nap</span>
          <span aria-hidden="true" className="text-primary-300">
            ·
          </span>
          <span>Record a diaper</span>
          <span aria-hidden="true" className="text-primary-300">
            ·
          </span>
          <span>Check the last feed</span>
        </div>
      </div>

      <section
        className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24 lg:px-12"
        id="how-it-works"
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary-600 uppercase">
            How it works
          </p>
          <h2 className="mt-5 max-w-[10ch] font-serif text-5xl leading-[0.98] tracking-[-0.03em] text-neutral-900 sm:text-6xl">
            Speak once. It stays remembered.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-neutral-500">
            Baby tracking should take less attention than the baby. One sentence
            gives your whole household the useful version of what happened.
          </p>
        </div>

        <ol className="border-neutral-200 border-t">
          {HOW_IT_WORKS.map((item) => (
            <li
              className="grid gap-4 border-neutral-200 border-b py-8 sm:grid-cols-[4rem_1fr] sm:gap-6"
              key={item.number}
            >
              <span className="font-serif text-2xl text-primary-400 italic">
                {item.number}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-neutral-800">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="bg-surface-sunken px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
        id="why-babytalk"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary-600 uppercase">
              Why BabyTalk
            </p>
            <h2 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.03em] text-neutral-900 sm:text-6xl">
              Less admin. More knowing.
            </h2>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-200 lg:grid-cols-2">
            <article className="bg-surface-raised p-7 sm:p-10 lg:p-12">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                When your hands are full
              </p>
              <h3 className="mt-5 max-w-md font-serif text-4xl leading-tight text-neutral-900">
                Use the words already in your head.
              </h3>
              <p className="mt-5 max-w-md text-sm leading-7 text-neutral-500">
                Say “left side for 15 minutes,” “wet and dirty,” or “start a
                nap.” BabyTalk understands the ordinary language of your day.
              </p>
              <div className="mt-10 rounded-[1.5rem] bg-feed-100 p-6">
                <p className="font-serif text-2xl leading-snug text-neutral-800 italic">
                  “She ate for 15 minutes on the left.”
                </p>
                <div className="mt-5 flex items-center gap-3 border-feed-200 border-t pt-4">
                  <span className="h-2 w-2 rounded-full bg-feed-500" />
                  <p className="text-xs font-semibold text-feed-600">
                    Left feed · 15 min · Logged now
                  </p>
                </div>
              </div>
            </article>

            <article className="bg-surface-raised p-7 sm:p-10 lg:p-12">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                When your brain is tired
              </p>
              <h3 className="mt-5 max-w-md font-serif text-4xl leading-tight text-neutral-900">
                See the answer, not a spreadsheet.
              </h3>
              <p className="mt-5 max-w-md text-sm leading-7 text-neutral-500">
                Today’s totals, the most recent event, and a clear timeline
                answer the questions that come up most. The history is there
                when you need it.
              </p>
              <div className="mt-10 space-y-3">
                <div className="flex items-center justify-between rounded-full bg-sleep-100 px-5 py-3.5">
                  <span className="text-sm font-medium text-neutral-600">
                    Last sleep
                  </span>
                  <span className="font-serif text-lg text-neutral-800">
                    1h 18m ago
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-full bg-feed-100 px-5 py-3.5">
                  <span className="text-sm font-medium text-neutral-600">
                    Fed today
                  </span>
                  <span className="font-serif text-lg text-neutral-800">
                    560 ml
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-full bg-diaper-100 px-5 py-3.5">
                  <span className="text-sm font-medium text-neutral-600">
                    Diapers today
                  </span>
                  <span className="font-serif text-lg text-neutral-800">5</span>
                </div>
              </div>
            </article>

            <article className="bg-primary-600 p-7 text-[oklch(97%_0.012_75)] sm:p-10 lg:col-span-2 lg:p-12">
              <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end lg:gap-20">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-[oklch(90%_0.03_100)] uppercase">
                    When someone else takes over
                  </p>
                  <h3 className="mt-5 max-w-lg font-serif text-4xl leading-tight sm:text-5xl">
                    Your partner shouldn’t need a handover meeting.
                  </h3>
                  <p className="mt-5 max-w-lg text-sm leading-7 text-[oklch(90%_0.025_100)]">
                    Everyone in the family sees the same record, so the next
                    person knows what happened and what may be coming next.
                  </p>
                </div>
                <div className="rounded-[1.75rem] bg-[oklch(97%_0.012_75)] p-6 text-neutral-800 shadow-[0_24px_50px_oklch(25%_0.04_100/0.18)] sm:p-8">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-primary-500 uppercase">
                    While you were asleep
                  </p>
                  <p className="mt-4 font-serif text-2xl leading-snug text-neutral-800 sm:text-3xl">
                    3 feeds, 2 diapers, and a 1h 20m nap. Last feed was 45
                    minutes ago.
                  </p>
                  <p className="mt-5 text-xs font-medium text-neutral-400">
                    Everything since your last check-in, in one glance.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-28 text-center sm:px-8 sm:py-36 lg:px-12">
        <div className="absolute top-1/2 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-[43%_57%_64%_36%/52%_39%_61%_48%] bg-primary-50" />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary-600 uppercase">
            Ready when the next feed is
          </p>
          <h2 className="mt-6 font-serif text-5xl leading-[0.96] tracking-[-0.03em] text-neutral-900 sm:text-7xl">
            Keep the memory. Lose the mental load.
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-neutral-500">
            Start a shared baby log you can update with one sentence, even at
            3am.
          </p>
          <Link
            className="mt-9 inline-flex min-h-14 items-center justify-center rounded-full bg-primary-500 px-8 text-base font-semibold text-[oklch(97%_0.012_75)] shadow-[0_12px_30px_oklch(48%_0.06_100/0.2)] transition-[background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-primary-600 hover:shadow-[0_16px_36px_oklch(48%_0.06_100/0.28)] active:scale-[0.98]"
            href="/auth/login"
          >
            Start tracking
          </Link>
        </div>
      </section>

      <footer className="border-neutral-200 border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>BabyTalk. Built for tired parents.</p>
          <Link
            className="flex min-h-11 items-center font-semibold text-neutral-500 transition-colors hover:text-neutral-800"
            href="/auth/login"
          >
            Sign in to BabyTalk
          </Link>
        </div>
      </footer>
    </main>
  );
}
