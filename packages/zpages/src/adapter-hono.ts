import type { ZPages } from "./zpages";

interface HonoContext {
  json: (data: unknown, status?: number) => Response;
  req: { param: (name: string) => string };
}

interface HonoApp {
  get: (path: string, handler: (c: HonoContext) => Promise<Response>) => void;
}

export const registerZPages = (app: HonoApp, zpages: ZPages): void => {
  app.get("/livez", async (c) => {
    const result = await zpages.getLiveness();
    return c.json(result.body, result.status);
  });

  app.get("/livez/:check", async (c) => {
    const result = await zpages.getLiveness(c.req.param("check"));
    return c.json(result.body, result.status);
  });

  app.get("/readyz", async (c) => {
    const result = await zpages.getReadiness();
    return c.json(result.body, result.status);
  });

  app.get("/readyz/:check", async (c) => {
    const result = await zpages.getReadiness(c.req.param("check"));
    return c.json(result.body, result.status);
  });
};
