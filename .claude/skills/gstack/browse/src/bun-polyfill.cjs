/**
 * Bun API polyfill for Node.js — Windows compatibility layer.
 *
 * On Windows, Bun can't launch or connect to Playwright's Chromium
 * (oven-sh/bun#4253, #9911). The browse server falls back to running
 * under Node.js with this polyfill providing Bun API equivalents.
 *
 * Loaded via --require before the transpiled server bundle.
 */

"use strict";

const http = require("node:http");
const { spawnSync, spawn } = require("node:child_process");

globalThis.Bun = {
  serve(options) {
    const { port, hostname = "127.0.0.1", fetch } = options;

    const server = http.createServer(async (nodeReq, nodeRes) => {
      try {
        const url = `http://${hostname}:${port}${nodeReq.url}`;
        const headers = new Headers();
        for (const [key, val] of Object.entries(nodeReq.headers)) {
          if (val) headers.set(key, Array.isArray(val) ? val[0] : val);
        }

        let body = null;
        if (nodeReq.method !== "GET" && nodeReq.method !== "HEAD") {
          body = await new Promise((resolve) => {
            const chunks = [];
            nodeReq.on("data", (chunk) => chunks.push(chunk));
            nodeReq.on("end", () => resolve(Buffer.concat(chunks)));
          });
        }

        const webReq = new Request(url, {
          body,
          headers,
          method: nodeReq.method,
        });

        const webRes = await fetch(webReq);

        nodeRes.statusCode = webRes.status;
        webRes.headers.forEach((val, key) => {
          nodeRes.setHeader(key, val);
        });

        const resBody = await webRes.arrayBuffer();
        nodeRes.end(Buffer.from(resBody));
      } catch (error) {
        nodeRes.statusCode = 500;
        nodeRes.end(JSON.stringify({ error: error.message }));
      }
    });

    server.listen(port, hostname);

    return {
      hostname,
      port,
      stop() {
        server.close();
      },
    };
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  spawn(cmd, options = {}) {
    const [command, ...args] = cmd;
    const stdio = options.stdio || ["pipe", "pipe", "pipe"];
    const proc = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio,
    });

    return {
      kill(signal) {
        proc.kill(signal);
      },
      pid: proc.pid,
      stderr: proc.stderr,
      stdin: proc.stdin,
      stdout: proc.stdout,
      unref() {
        proc.unref();
      },
    };
  },

  spawnSync(cmd, options = {}) {
    const [command, ...args] = cmd;
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: [
        options.stdin || "pipe",
        options.stdout === "pipe" ? "pipe" : "ignore",
        options.stderr === "pipe" ? "pipe" : "ignore",
      ],
      timeout: options.timeout,
    });

    return {
      exitCode: result.status,
      stderr: result.stderr || Buffer.from(""),
      stdout: result.stdout || Buffer.from(""),
    };
  },
};
