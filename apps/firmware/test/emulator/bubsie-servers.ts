// Runs Bubsie instances (API + web) for the emulator tests, each on its own fresh database in the
// dev Postgres. Needs the API and web built (`pnpm --filter @bubsie/api build`, `pnpm --filter
// @bubsie/web build`) and `pnpm docker:dev:up` (Postgres and Mailpit).
//   BUBSIE_REPO        the Bubsie checkout (set by scripts/emulator-test.sh)
//   BUBSIE_HOST        an address of this machine the emulator's relay and the browser both reach
//   BUBSIE_PG          the Postgres container (default bubsie-postgres-1)
//   BUBSIE_API_PORT, BUBSIE_WEB_PORT
//                      where the first instance listens (default 4417 and 3417); the firmware's web
//                      URL is http://$BUBSIE_HOST:$BUBSIE_WEB_PORT. Others take the ports after.
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = process.env.BUBSIE_REPO ?? "";
export const HOST = process.env.BUBSIE_HOST ?? "";
const PG = process.env.BUBSIE_PG ?? "bubsie-postgres-1";
const API_PORT = Number(process.env.BUBSIE_API_PORT ?? 4417);
const WEB_PORT = Number(process.env.BUBSIE_WEB_PORT ?? 3417);

/** The ports of the `n`th instance (0: the one the firmware is built for). */
export const ports = (n: number) => ({
  apiPort: API_PORT + n,
  webPort: WEB_PORT + n,
});

export interface InstanceOptions {
  /** Database name, starting bubsie_fw_; dropped and created afresh. */
  name: string;
  apiPort: number;
  webPort: number;
  /** A checkout whose apps/api/dist is the API to run (default: this one). */
  apiCheckout?: string;
}

export class Instance {
  readonly webUrl: string;
  readonly apiUrl: string;
  #api: ChildProcess | undefined;
  #web: ChildProcess | undefined;
  #secret: string;
  readonly options: InstanceOptions;

  private constructor(options: InstanceOptions) {
    this.options = options;
    this.webUrl = `http://${HOST}:${options.webPort}`;
    this.apiUrl = `http://${HOST}:${options.apiPort}/graphql`;
    this.#secret = `${options.name}-secret-0-0123456789`;
  }

  get host(): string {
    return new URL(this.webUrl).host;
  }

  static async start(options: InstanceOptions): Promise<Instance> {
    if (!REPO || !HOST) throw new Error("set BUBSIE_REPO and BUBSIE_HOST");
    // Only ever drop a database these tests made.
    if (!/^bubsie_fw_\w+$/.test(options.name))
      throw new Error(`${options.name} is not a test database`);
    const instance = new Instance(options);
    psql("bubsie", `DROP DATABASE IF EXISTS ${options.name} WITH (FORCE)`);
    psql("bubsie", `CREATE DATABASE ${options.name}`);
    await instance.startApi();
    instance.#web = run(
      [
        path.join(REPO, "apps/web/node_modules/next/dist/bin/next"),
        "start",
        "-H",
        "0.0.0.0",
        "-p",
        String(options.webPort),
      ],
      path.join(REPO, "apps/web"),
      { BUBSIE_WEB_API_URL: instance.apiUrl },
      `${options.name}-web`
    );
    await until(`${instance.webUrl}/.well-known/config`);
    return instance;
  }

  /** Start the API (again, after `stopApi`). */
  async startApi(): Promise<void> {
    const { name, apiPort, webPort, apiCheckout = REPO } = this.options;
    this.#api = run(
      ["apps/api/dist/index.js"],
      apiCheckout,
      {
        BUBSIE_API_DATABASE_URL: `postgresql://bubsie:bubsie@localhost:5432/${name}`,
        BUBSIE_API_JWT_SECRET: this.#secret,
        BUBSIE_API_PORT: String(apiPort),
        BUBSIE_API_SMTP_FROM: `noreply@${name}.test`,
        BUBSIE_API_SMTP_HOST: "localhost",
        BUBSIE_API_SMTP_PORT: "1025",
        BUBSIE_API_WEB_URL: `http://${HOST}:${webPort}`,
      },
      `${name}-api`
    );
    await until(`http://${HOST}:${apiPort}/livez`);
  }

  /** Stop the API, as in an outage: the device's requests to it fail. */
  async stopApi(): Promise<void> {
    await stop(this.#api);
  }

  /** Restart the API with a new JWT secret: every access token it issued stops working. */
  async rotateJwtSecret(): Promise<void> {
    await stop(this.#api);
    this.#secret = this.#secret.replace(
      /-(\d+)-/,
      (_, n) => `-${Number(n) + 1}-`
    );
    await this.startApi();
  }

  /** Run SQL against this instance's database; rows as tab-separated lines. */
  sql(query: string): string[] {
    return psql(this.options.name, query);
  }

  async stop(): Promise<void> {
    await Promise.all([stop(this.#api), stop(this.#web)]);
  }
}

function psql(database: string, query: string): string[] {
  const out = execFileSync(
    "docker",
    [
      "exec",
      PG,
      "psql",
      "-U",
      "bubsie",
      "-d",
      database,
      "-qAtF",
      "\t",
      "-c",
      query,
    ],
    { encoding: "utf8" }
  );
  return out.split("\n").filter((line) => line.length > 0);
}

function run(
  args: string[],
  cwd: string,
  env: Record<string, string>,
  name: string
): ChildProcess {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = createWriteStream(path.join(tmpdir(), `bubsie-${name}.log`));
  child.stdout!.pipe(log);
  child.stderr!.pipe(log);
  return child;
}

async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await exited;
}

async function until(url: string, seconds = 60): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`${url} did not come up`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
