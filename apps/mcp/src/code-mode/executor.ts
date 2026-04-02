import vm from "node:vm";

export interface ExecuteResult {
  error?: string;
  logs: string[];
  result: unknown;
}

export interface Executor {
  execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>
  ): Promise<ExecuteResult>;
}

/**
 * Node.js VM-based executor. Runs LLM-generated code in an isolated V8 context.
 * Tool functions are injected as `babytalk.toolName()` globals.
 */
export class NodeVmExecutor implements Executor {
  private readonly timeout: number;

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout ?? 10_000;
  }

  async execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>
  ): Promise<ExecuteResult> {
    const logs: string[] = [];
    const console = {
      error: (...args: unknown[]) =>
        logs.push(`[error] ${args.map(String).join(" ")}`),
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) =>
        logs.push(`[warn] ${args.map(String).join(" ")}`),
    };

    // Create the babytalk namespace with all tool functions
    const babytalk: Record<string, (...args: unknown[]) => Promise<unknown>> =
      {};
    for (const [name, fn] of Object.entries(fns)) {
      babytalk[name] = fn;
    }

    const context = vm.createContext({
      babytalk,
      console,
    });

    try {
      // Wrap in an async IIFE so the LLM can use await
      const wrapped = `(async () => { ${code} })()`;
      const script = new vm.Script(wrapped, { filename: "codemode.js" });
      const result = await script.runInContext(context, {
        timeout: this.timeout,
      });
      return { logs, result };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        logs,
        result: undefined,
      };
    }
  }
}
