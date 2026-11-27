// Drives the Bubsie firmware in the amoled-175c-emulator, headlessly. scripts/emulator-test.sh copies
// this file into the emulator's web/test/ (it imports the emulator's own harness from there).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { startRelay } from "../relay/relay.ts";
import { NetLink } from "../src/emulator/net-link.ts";
import { DISPLAY_SIZE, TestBoard } from "./board.ts";

const untilNextTurn = () => new Promise((resolve) => setTimeout(resolve, 1));

export class Device {
  readonly board: TestBoard;
  readonly #link: NetLink | undefined;
  readonly #relay: { close(): Promise<void> } | undefined;
  readonly relayLog: string[];
  /** Where the serial log has been read up to by `waitFor`. */
  #cursor = 0;

  private constructor(
    board: TestBoard,
    link: NetLink | undefined,
    relay: { close(): Promise<void> } | undefined,
    relayLog: string[]
  ) {
    this.board = board;
    this.#link = link;
    this.#relay = relay;
    this.relayLog = relayLog;
  }

  /** Boot the firmware. With `network`, a relay that may reach this machine carries its TCP. */
  static async boot(
    firmware: string,
    { network = false } = {}
  ): Promise<Device> {
    const relayLog: string[] = [];
    const board = await TestBoard.boot(firmware);
    if (!network) return new Device(board, undefined, undefined, relayLog);
    const relay = await startRelay({
      port: 0,
      allowedOrigins: [],
      allowPrivate: true,
      log: (line) => relayLog.push(line),
    });
    const link = new NetLink(
      board.emulator,
      `ws://127.0.0.1:${relay.port}`,
      () => {}
    );
    return new Device(board, link, relay, relayLog);
  }

  async close(): Promise<void> {
    this.#link?.close();
    await this.#relay?.close();
  }

  /** Run emulated time; sockets make progress between turns of the event loop. */
  async run(seconds: number): Promise<void> {
    const steps = Math.max(1, Math.round(seconds / 0.01));
    for (let step = 0; step < steps; step++) {
      this.board.runSeconds(0.01, () => this.#link?.pump());
      if (this.#link) await untilNextTurn();
    }
  }

  /** Run until the serial log (after what earlier waits consumed) matches. Returns the match. */
  async waitFor(pattern: RegExp, maxSeconds = 30): Promise<RegExpMatchArray> {
    const deadline = this.seconds + maxSeconds;
    for (;;) {
      const rest = this.board.serial.slice(this.#cursor);
      const match = rest.match(pattern);
      if (match) {
        this.#cursor += (match.index ?? 0) + match[0].length;
        return match;
      }
      if (this.seconds > deadline) {
        assert.fail(
          `no ${pattern} within ${maxSeconds} s. Serial tail:\n${this.board.serial.slice(-3000)}\nrelay: ${this.relayLog.slice(-10).join(" | ")}`
        );
      }
      await this.run(0.1);
    }
  }

  get seconds(): number {
    return this.board.emulator.cycles / this.board.emulator.cpuHz;
  }

  async tap(x: number, y: number): Promise<void> {
    this.board.emulator.touch(x, y, true);
    await this.run(0.12);
    this.board.emulator.touch(x, y, false);
    await this.run(0.4);
  }

  async longPress(x: number, y: number, seconds = 0.9): Promise<void> {
    this.board.emulator.touch(x, y, true);
    await this.run(seconds);
    this.board.emulator.touch(x, y, false);
    await this.run(0.4);
  }

  async swipe(
    from: [number, number],
    to: [number, number],
    seconds = 0.3
  ): Promise<void> {
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const x = from[0] + ((to[0] - from[0]) * i) / steps;
      const y = from[1] + ((to[1] - from[1]) * i) / steps;
      this.board.emulator.touch(x, y, true);
      await this.run(seconds / steps);
    }
    this.board.emulator.touch(to[0], to[1], false);
    await this.run(0.8);
  }

  async button(which: "boot" | "pwr", seconds = 0.15): Promise<void> {
    this.board.emulator.button(which, true);
    await this.run(seconds);
    this.board.emulator.button(which, false);
    await this.run(0.4);
  }

  /** Save the display as a PNG, masked to the round panel. */
  screenshot(dir: string, name: string): string {
    const { frame } = this.board;
    assert.ok(frame, "the display was never drawn");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.png`);
    writeFileSync(file, encodePng(frame.pixels, DISPLAY_SIZE));
    return file;
  }

  /** RGB888 of a display pixel. */
  rgb(x: number, y: number): [number, number, number] {
    const value = this.board.pixel(x, y);
    return [
      (((value >> 11) & 31) * 255) / 31,
      (((value >> 5) & 63) * 255) / 63,
      ((value & 31) * 255) / 31,
    ].map(Math.round) as [number, number, number];
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** RGBA PNG of an RGB565 square frame; outside the round panel is transparent. */
function encodePng(pixels: Uint16Array, size: number): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const v = pixels[y * size + x]!;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round((((v >> 11) & 31) * 255) / 31);
      raw[o + 1] = Math.round((((v >> 5) & 63) * 255) / 63);
      raw[o + 2] = Math.round(((v & 31) * 255) / 31);
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
      raw[o + 3] =
        d <= r - 0.5 ? 255 : d >= r + 0.5 ? 0 : Math.round((r + 0.5 - d) * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}
