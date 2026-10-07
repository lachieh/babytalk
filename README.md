# Bubsie

**Log every feed in a single tap.**

Bubsie keeps a clear, shared record of feeds, sleep, diapers, and pumping. So no one has to remember what happened at 3am.

Open source and [easy to run on your own server](#self-hosting).

![Bubsie homepage with a sample daily log](docs/screenshots/home-hero.png)

## How it works

Tap once. It stays remembered.

1. **Tap what happened.** Feed, sleep, or diaper. Your usual bottle, side, or
   nap spot is already picked, so one tap is enough.
2. **Fix the details later.** Adjust a time or amount afterwards, or add the
   feed you forgot to log. No forms to finish.
3. **Everyone stays caught up.** Feeds, sleep, diapers, and pumping stay in one
   timeline your household can check.

## Why Bubsie

Less admin. More knowing.

### When your hands are full: one thumb is enough

Big buttons, sensible defaults, and nothing to type. Log a feed, start a nap,
or record a change without putting the baby down.

![A one-tap left breast feed, logged now](docs/screenshots/home-hands-full.png)

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

## Self-hosting

![Self-hosting section of the Bubsie homepage](docs/screenshots/home-self-host.png)

Bubsie is built to run on your own server. Your family's records stay in a
Postgres database you own, and every setting is an environment variable, so the
same images run anywhere.

You need Docker, two public URLs behind a reverse proxy (one for the web app,
one for the API), and an SMTP account for sign-in emails.

1. Download [`docker-compose.selfhost.yml`](docker-compose.selfhost.yml).
2. Create a `.env` file next to it:

   ```sh
   POSTGRES_PASSWORD=change-me
   BUBSIE_API_JWT_SECRET=a-long-random-string    # openssl rand -hex 32

   # Public URLs
   BUBSIE_API_WEB_URL=https://bubsie.example.com
   BUBSIE_WEB_API_URL=https://api.bubsie.example.com/graphql

   # Sign-in emails
   BUBSIE_API_SMTP_HOST=smtp.example.com
   BUBSIE_API_SMTP_PORT=587
   BUBSIE_API_SMTP_USER=...
   BUBSIE_API_SMTP_PASS=...
   BUBSIE_API_SMTP_FROM=hello@example.com
   ```

3. Start it:

   ```sh
   docker compose -f docker-compose.selfhost.yml up -d
   ```

4. Point your proxy at the web app on port `3000` and the API on port `4000`.

The API runs database migrations when it starts. Both servers refuse to start
if a required URL or setting is missing, and print which one.

| Variable                   | Required | Purpose                                            |
| -------------------------- | -------- | -------------------------------------------------- |
| `BUBSIE_API_WEB_URL`       | yes      | Public web URL, used for CORS, passkeys, and email |
| `BUBSIE_API_JWT_SECRET`    | yes      | Signs sessions (16+ characters)                    |
| `BUBSIE_API_SMTP_HOST`     | yes      | Mail server                                        |
| `BUBSIE_API_SMTP_FROM`     | yes      | Sender address for sign-in emails                  |
| `BUBSIE_API_SMTP_PORT`     | no       | Mail server port                                   |
| `BUBSIE_API_SMTP_USER`     | no       | SMTP username                                      |
| `BUBSIE_API_SMTP_PASS`     | no       | SMTP password                                      |
| `BUBSIE_API_RP_NAME`       | no       | Name shown in passkey prompts                      |
| `BUBSIE_WEB_API_URL`       | yes      | Public GraphQL URL, ending in `/graphql`           |
| `BUBSIE_WEB_TAMBO_URL`     | yes      | Tambo API URL (defaults in the compose file)       |
| `BUBSIE_WEB_TAMBO_API_KEY` | no       | Enables the AI insights                            |
| `BUBSIE_WEB_SOURCE_URL`    | no       | Shows a source link on the homepage                |

Images are published to GHCR: `latest` follows releases and `nightly` follows
`main`. Set `BUBSIE_IMAGE_TAG` to pin a version.

## Development

Bubsie is a pnpm monorepo: a GraphQL API (`apps/api`), a Next.js web app
(`apps/web`), and a Drizzle/PostgreSQL schema (`packages/db`). See
[AGENTS.md](AGENTS.md) for architecture and conventions.

```sh
pnpm install
docker compose up -d postgres mailpit
cp .config/bubsie_api.example.yaml .config/bubsie_api.local.yaml
cp .config/bubsie_web.example.yaml .config/bubsie_web.local.yaml
DATABASE_URL=postgresql://bubsie:bubsie@localhost:5432/bubsie pnpm db:migrate
pnpm turbo build --filter=@bubsie/api^... --filter=@bubsie/web^...

# in separate terminals
(cd apps/api && SKIP_MIGRATIONS=1 pnpm dev)
(cd apps/web && pnpm dev)
```

- Web app: http://localhost:3000
- GraphQL API: http://localhost:4000/graphql
- Mailpit (magic-link emails): http://localhost:8025

## License

[MIT](LICENSE)
