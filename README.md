# BabyTalk

**Track every feed without stopping to type.**

BabyTalk turns a quick sentence into a clear, shared record of feeds, sleep,
diapers, and pumping. So no one has to remember what happened at 3am.

![BabyTalk homepage: a spoken update becomes a daily log](docs/screenshots/home-hero.png)

## How it works

Speak once. It stays remembered.

1. **Talk like a parent.** Say it naturally: "120 mil bottle at 2:10" or "she
   just went down for a nap."
2. **The details get sorted.** BabyTalk puts the amount, time, and activity in
   the right place. No forms to finish.
3. **Everyone stays caught up.** Feeds, sleep, diapers, and pumping stay in one
   timeline your household can check.

## Why BabyTalk

Less admin. More knowing.

### When your hands are full: use the words already in your head

Say "left side for 15 minutes," "wet and dirty," or "start a nap." BabyTalk
understands the ordinary language of your day.

![“She ate for 15 minutes on the left” logged as a left feed](docs/screenshots/home-hands-full.png)

### When your brain is tired: see the answer, not a spreadsheet

Today's totals, the most recent event, and a clear timeline answer the
questions that come up most. The history is there when you need it.

![Last sleep, fed today, and diapers today at a glance](docs/screenshots/home-tired-brain.png)

### When someone else takes over: no handover meeting

Everyone in the family sees the same record, so the next person knows what
happened and what may be coming next.

![“While you were asleep” summary of feeds, diapers, and naps](docs/screenshots/home-handover.png)

## The app

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-dashboard.png" alt="Home dashboard with today's feed, sleep, and diaper totals" />
      <p><strong>Today at a glance.</strong> Totals, time since the last feed,
      sleep, and change, plus one-tap logging and the last 24 hours.</p>
    </td>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-week.png" alt="Week view charting sleep, feeds, and diapers by hour" />
      <p><strong>See the rhythm.</strong> The week view lays out every sleep,
      feed, and diaper by hour so patterns show up on their own.</p>
    </td>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-averages.png" alt="Monthly averages for feeds, volume, sleep, naps, and changes" />
      <p><strong>Monthly averages.</strong> Feeds and volume per day, daytime
      and nighttime sleep, naps, and changes.</p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-growth.png" alt="Growth chart plotting weight, height, and head circumference against WHO percentiles" />
      <p><strong>Growth.</strong> Weight, length, and head circumference plotted
      against WHO percentiles, in metric or imperial.</p>
    </td>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-pump.png" alt="Pump view with left, right, and both timers and today's sessions" />
      <p><strong>Pumping.</strong> Start a left, right, or both-sides session
      with one tap and keep a running daily total.</p>
    </td>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-dashboard-dark.png" alt="Home dashboard in low-light dark mode" />
      <p><strong>Gentle at night.</strong> The app dims itself automatically in
      the evening so a 3am check doesn't wake anyone up.</p>
    </td>
  </tr>
</table>

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/screenshots/app-station.png" alt="Station mode with large Feed, Diaper, and Sleep buttons" />
    </td>
    <td valign="top">
      <p><strong>Station mode.</strong> A big-button view for a tablet or a
      dedicated device by the cot or change table. Pick a default under each button
      (bottle, wet, bassinet) and logging is a single tap.</p>
    </td>
  </tr>
</table>

No password required. Sign in by email magic link or passkey.

## Development

BabyTalk is a pnpm monorepo: a GraphQL API (`apps/api`), a Next.js web app
(`apps/web`), and a Drizzle/PostgreSQL schema (`packages/db`). See
[AGENTS.md](AGENTS.md) for architecture and conventions.

```sh
pnpm install
docker compose up -d postgres mailpit
DATABASE_URL=postgresql://babytalk:babytalk@localhost:5432/babytalk pnpm db:migrate
pnpm turbo build --filter=@babytalk/api^... --filter=@babytalk/web^...

# in separate terminals
(cd apps/api && SKIP_MIGRATIONS=1 BABYTALK_API_DATABASE_URL=postgresql://babytalk:babytalk@localhost:5432/babytalk pnpm dev)
(cd apps/web && pnpm dev)
```

- Web app: http://localhost:3000
- GraphQL API: http://localhost:4000/graphql
- Mailpit (magic-link emails): http://localhost:8025

## License

[MIT](LICENSE)
