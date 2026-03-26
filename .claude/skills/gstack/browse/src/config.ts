/**
 * Shared config for browse CLI + server.
 *
 * Resolution:
 *   1. BROWSE_STATE_FILE env → derive stateDir from parent
 *   2. git rev-parse --show-toplevel → projectDir/.gstack/
 *   3. process.cwd() fallback (non-git environments)
 *
 * The CLI computes the config and passes BROWSE_STATE_FILE to the
 * spawned server. The server derives all paths from that env var.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface BrowseConfig {
  projectDir: string;
  stateDir: string;
  stateFile: string;
  consoleLog: string;
  networkLog: string;
  dialogLog: string;
}

/**
 * Detect the git repository root, or null if not in a repo / git unavailable.
 */
export function getGitRoot(): string | null {
  try {
    const proc = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
      stderr: "pipe",
      stdout: "pipe",
      timeout: 2000, // Don't hang if .git is broken
    });
    if (proc.exitCode !== 0) return null;
    return proc.stdout.toString().trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve all browse config paths.
 *
 * If BROWSE_STATE_FILE is set (e.g. by CLI when spawning server, or by
 * tests for isolation), all paths are derived from it. Otherwise, the
 * project root is detected via git or cwd.
 */
export function resolveConfig(
  env: Record<string, string | undefined> = process.env
): BrowseConfig {
  let stateFile: string;
  let stateDir: string;
  let projectDir: string;

  if (env.BROWSE_STATE_FILE) {
    stateFile = env.BROWSE_STATE_FILE;
    stateDir = path.dirname(stateFile);
    projectDir = path.dirname(stateDir); // parent of .gstack/
  } else {
    projectDir = getGitRoot() || process.cwd();
    stateDir = path.join(projectDir, ".gstack");
    stateFile = path.join(stateDir, "browse.json");
  }

  return {
    consoleLog: path.join(stateDir, "browse-console.log"),
    dialogLog: path.join(stateDir, "browse-dialog.log"),
    networkLog: path.join(stateDir, "browse-network.log"),
    projectDir,
    stateDir,
    stateFile,
  };
}

/**
 * Create the .gstack/ state directory if it doesn't exist.
 * Throws with a clear message on permission errors.
 */
export function ensureStateDir(config: BrowseConfig): void {
  try {
    fs.mkdirSync(config.stateDir, { recursive: true });
  } catch (error: any) {
    if (error.code === "EACCES") {
      throw new Error(
        `Cannot create state directory ${config.stateDir}: permission denied`,
        { cause: error }
      );
    }
    if (error.code === "ENOTDIR") {
      throw new Error(
        `Cannot create state directory ${config.stateDir}: a file exists at that path`,
        { cause: error }
      );
    }
    throw error;
  }

  // Ensure .gstack/ is in the project's .gitignore
  const gitignorePath = path.join(config.projectDir, ".gitignore");
  try {
    const content = fs.readFileSync(gitignorePath, "utf8");
    if (!/^\.gstack\/?$/m.test(content)) {
      const separator = content.endsWith("\n") ? "" : "\n";
      fs.appendFileSync(gitignorePath, `${separator}.gstack/\n`);
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      // Write warning to server log (visible even in daemon mode)
      const logPath = path.join(config.stateDir, "browse-server.log");
      try {
        fs.appendFileSync(
          logPath,
          `[${new Date().toISOString()}] Warning: could not update .gitignore at ${gitignorePath}: ${error.message}\n`
        );
      } catch {
        // stateDir write failed too — nothing more we can do
      }
    }
    // ENOENT (no .gitignore) — skip silently
  }
}

/**
 * Derive a slug from the git remote origin URL (owner-repo format).
 * Falls back to the directory basename if no remote is configured.
 */
export function getRemoteSlug(): string {
  try {
    const proc = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
      stderr: "pipe",
      stdout: "pipe",
      timeout: 2000,
    });
    if (proc.exitCode !== 0) throw new Error("no remote");
    const url = proc.stdout.toString().trim();
    // SSH:   git@github.com:owner/repo.git → owner-repo
    // HTTPS: https://github.com/owner/repo.git → owner-repo
    const match = url.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) return `${match[1]}-${match[2]}`;
    throw new Error("unparseable");
  } catch {
    const root = getGitRoot();
    return path.basename(root || process.cwd());
  }
}

/**
 * Read the binary version (git SHA) from browse/dist/.version.
 * Returns null if the file doesn't exist or can't be read.
 */
export function readVersionHash(
  execPath: string = process.execPath
): string | null {
  try {
    const versionFile = path.resolve(path.dirname(execPath), ".version");
    return fs.readFileSync(versionFile, "utf8").trim() || null;
  } catch {
    return null;
  }
}
