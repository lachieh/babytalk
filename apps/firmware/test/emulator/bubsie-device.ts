import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EMU = process.env.AMOLED_EMU;
if (!EMU) throw new Error("set AMOLED_EMU to an amoled-175c-emulator checkout");
const headless = await import(
  path.join(path.resolve(EMU), "web/headless/index.ts")
);
const { HeadlessBoard, WaitTimeout, loadFirmware, startRelay } = headless;
type Board = InstanceType<typeof HeadlessBoard>;
type Relay = { port: number; close(): Promise<void> };

const IMAGES = path.resolve(process.env.BUBSIE_IMAGES ?? "dist");

export interface BootOptions {
  network?: boolean;
  wifi?: unknown;
}

export class Device {
  readonly board: Board;
  readonly #relay: Relay | undefined;
  readonly relayLog: string[];

  private constructor(
    board: Board,
    relay: Relay | undefined,
    relayLog: string[]
  ) {
    this.board = board;
    this.#relay = relay;
    this.relayLog = relayLog;
  }

  static async boot({
    network = false,
    wifi,
  }: BootOptions = {}): Promise<Device> {
    const relayLog: string[] = [];
    const relay: Relay | undefined = network
      ? await startRelay({
          port: 0,
          allowedOrigins: [],
          allowPrivate: true,
          log: (line: string) => relayLog.push(line),
        })
      : undefined;
    const board = await HeadlessBoard.boot(loadFirmware(IMAGES), {
      relayUrl: relay ? `ws://127.0.0.1:${relay.port}` : undefined,
      wifi,
    });
    return new Device(board, relay, relayLog);
  }

  async close(): Promise<void> {
    this.saveLogs();
    this.board.close();
    await this.#relay?.close();
  }

  get seconds(): number {
    return this.board.seconds;
  }

  run(seconds: number): Promise<void> {
    return this.board.run(seconds);
  }

  async waitFor(pattern: RegExp, maxSeconds = 30): Promise<RegExpExecArray> {
    try {
      return await this.board.waitFor(pattern, maxSeconds);
    } catch (error) {
      if (!(error instanceof WaitTimeout)) throw error;
      assert.fail(
        `no ${pattern} within ${maxSeconds} s (log: ${this.saveLogs()}). Serial tail:\n${this.board.serial.slice(-3000)}\nrelay: ${this.relayLog.slice(-10).join(" | ")}`
      );
    }
  }

  async seen(pattern: RegExp, maxSeconds = 30): Promise<RegExpMatchArray> {
    const deadline = this.seconds + maxSeconds;
    for (;;) {
      const match = this.board.serial.match(pattern);
      if (match) return match;
      if (this.seconds > deadline) assert.fail(`never logged ${pattern}`);
      await this.run(0.1);
    }
  }

  async find(
    label: string | RegExp,
    maxSeconds = 3
  ): Promise<[number, number]> {
    const deadline = this.seconds + maxSeconds;
    for (;;) {
      const serial = this.board.serial;
      const start = serial.lastIndexOf("ui: targets");
      if (start >= 0) {
        const lines = [
          ...serial.slice(start).matchAll(/ui: at (\d+),(\d+) (.*)$/gm),
        ];
        for (let i = lines.length - 1; i >= 0; i--) {
          const text = lines[i]![3]!.trim();
          if (typeof label === "string" ? text === label : label.test(text))
            return [Number(lines[i]![1]), Number(lines[i]![2])];
        }
      }
      if (this.seconds > deadline) {
        const known =
          start >= 0
            ? [...serial.slice(start).matchAll(/ui: at \S+ (.*)$/gm)].map(
                (m) => m[1]
              )
            : [];
        assert.fail(
          `no touch target ${label} (log: ${this.saveLogs()}); on screen: ${known.join(" | ")}`
        );
      }
      await this.run(0.1);
    }
  }

  async reach(label: string | RegExp): Promise<[number, number]> {
    const up: [number, number][] = Array.from({ length: 7 }, () => [340, 150]);
    const down: [number, number][] = Array.from({ length: 8 }, () => [
      140, 330,
    ]);
    for (const [from, to] of [[0, 0] as [number, number], ...up, ...down]) {
      if (from) await this.swipe([233, from], [233, to], 0.4);
      try {
        const [x, y] = await this.find(label, 0.6);
        if (y > 40 && y < 430) return [x, y];
      } catch {}
    }
    return this.find(label, 0.5);
  }

  async tapLabel(label: string | RegExp): Promise<void> {
    const [x, y] = await this.reach(label);
    await this.tap(x, y);
  }

  async tap(x: number, y: number): Promise<void> {
    await this.board.press(x, y, 120);
    await this.run(0.4);
  }

  async longPress(x: number, y: number, seconds = 0.9): Promise<void> {
    await this.board.press(x, y, seconds * 1000);
    await this.run(0.4);
  }

  async swipe(
    from: [number, number],
    to: [number, number],
    seconds = 0.3
  ): Promise<void> {
    await this.board.swipe(from, to, seconds * 1000);
    await this.run(0.8);
  }

  async button(which: "boot" | "pwr", seconds = 0.15): Promise<void> {
    await this.board.button(which, seconds * 1000);
    await this.run(0.4);
  }

  async typeKeys(text: string): Promise<void> {
    for (const key of text) await this.tap(...(await this.find(`key ${key}`)));
  }

  screenshot(dir: string, name: string): string {
    assert.ok(this.board.frame, "the display was never drawn");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.png`);
    writeFileSync(file, this.board.screenshot());
    return file;
  }

  rgb(x: number, y: number): [number, number, number] {
    const value = this.board.pixel(x, y);
    return [
      ((value >> 11) & 31) / 31,
      ((value >> 5) & 63) / 63,
      (value & 31) / 31,
    ].map((c) => Math.round(c * 255)) as [number, number, number];
  }

  saveLogs(): string {
    const file =
      process.env.BUBSIE_LOG ?? path.join(tmpdir(), "bubsie-serial.log");
    writeFileSync(
      file,
      `${this.board.serial}\n--- emulator ---\n${this.board.log.join("\n")}\n`
    );
    return file;
  }
}
