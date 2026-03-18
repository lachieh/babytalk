export type CheckStatus = "ok" | "error" | "starting";

export interface CheckResult {
  status: CheckStatus;
  responseTime: number | null;
  message?: string;
}

export type CheckFn = () => Promise<CheckResult>;

export interface ZPageResponse {
  status: CheckStatus;
  uptime: number;
  timestamp: string;
  checks?: Record<string, CheckResult>;
}
