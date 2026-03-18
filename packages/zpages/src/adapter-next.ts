import type { ZPages } from "./zpages.js";

type RouteHandler = (
  req: Request,
  context: { params: Promise<{ check: string }> }
) => Promise<Response>;

type RootRouteHandler = () => Promise<Response>;

const toResponse = (result: { body: unknown; status: number }): Response =>
  Response.json(result.body, { status: result.status });

export const createLivezHandler =
  (zpages: ZPages): RootRouteHandler =>
  async () =>
    toResponse(await zpages.getLiveness());

export const createLivezCheckHandler =
  (zpages: ZPages): RouteHandler =>
  async (_req, { params }) => {
    const { check } = await params;
    return toResponse(await zpages.getLiveness(check));
  };

export const createReadyzHandler =
  (zpages: ZPages): RootRouteHandler =>
  async () =>
    toResponse(await zpages.getReadiness());

export const createReadyzCheckHandler =
  (zpages: ZPages): RouteHandler =>
  async (_req, { params }) => {
    const { check } = await params;
    return toResponse(await zpages.getReadiness(check));
  };
