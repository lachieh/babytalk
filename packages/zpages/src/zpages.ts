import type {
  CheckFn,
  CheckResult,
  CheckStatus,
  ZPageResponse,
} from "./types.js";

interface CachedCheck {
  fn: CheckFn;
  lastResult: CheckResult;
}

const STARTING_RESULT: CheckResult = {
  message: "check has not yet run",
  responseTime: null,
  status: "starting",
};

export class ZPages {
  private livenessChecks = new Map<string, CachedCheck>();
  private readinessChecks = new Map<string, CachedCheck>();
  private startTime = Date.now();

  addLivenessCheck(name: string, check: CheckFn): this {
    this.livenessChecks.set(name, {
      fn: check,
      lastResult: { ...STARTING_RESULT },
    });
    return this;
  }

  addReadinessCheck(name: string, check: CheckFn): this {
    this.readinessChecks.set(name, {
      fn: check,
      lastResult: { ...STARTING_RESULT },
    });
    return this;
  }

  async getLiveness(
    checkName?: string
  ): Promise<{ body: ZPageResponse; status: number }> {
    return this.runChecks(this.livenessChecks, checkName);
  }

  async getReadiness(
    checkName?: string
  ): Promise<{ body: ZPageResponse; status: number }> {
    return this.runChecks(this.readinessChecks, checkName);
  }

  private uptime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  private async runChecks(
    checks: Map<string, CachedCheck>,
    checkName?: string
  ): Promise<{ body: ZPageResponse; status: number }> {
    const timestamp = new Date().toISOString();
    const uptime = this.uptime();

    if (checkName) {
      const cached = checks.get(checkName);
      if (!cached) {
        return {
          body: { status: "error", timestamp, uptime },
          status: 404,
        };
      }
      const result = await this.executeCheck(cached);
      return {
        body: {
          checks: { [checkName]: result },
          status: result.status,
          timestamp,
          uptime,
        },
        status: statusCode(result.status),
      };
    }

    const results: Record<string, CheckResult> = {};
    let overallStatus: CheckStatus = "ok";

    for (const [name, cached] of checks) {
      results[name] = await this.executeCheck(cached);
      overallStatus = worstStatus(overallStatus, results[name].status);
    }

    const hasChecks = checks.size > 0;

    return {
      body: {
        status: overallStatus,
        timestamp,
        uptime,
        ...(hasChecks ? { checks: results } : {}),
      },
      status: statusCode(overallStatus),
    };
  }

  private async executeCheck(cached: CachedCheck): Promise<CheckResult> {
    const result = await cached.fn();
    cached.lastResult = result;
    return result;
  }
}

function worstStatus(a: CheckStatus, b: CheckStatus): CheckStatus {
  if (a === "error" || b === "error") {
    return "error";
  }
  if (a === "starting" || b === "starting") {
    return "starting";
  }
  return "ok";
}

function statusCode(status: CheckStatus): number {
  if (status === "ok") {
    return 200;
  }
  return 503;
}
