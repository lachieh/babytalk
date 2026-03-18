import type { ZPages } from "./zpages.js";

type RouteHandler = (
  req: Request,
  context: { params: Promise<{ check: string }> }
) => Promise<Response>;

type RootRouteHandler = () => Promise<Response>;

function toResponse(result: { body: unknown; status: number }): Response {
  return Response.json(result.body, { status: result.status });
}

export function createLivezHandler(zpages: ZPages): RootRouteHandler {
  return async () => toResponse(await zpages.getLiveness());
}

export function createLivezCheckHandler(zpages: ZPages): RouteHandler {
  return async (_req, { params }) => {
    const { check } = await params;
    return toResponse(await zpages.getLiveness(check));
  };
}

export function createReadyzHandler(zpages: ZPages): RootRouteHandler {
  return async () => toResponse(await zpages.getReadiness());
}

export function createReadyzCheckHandler(zpages: ZPages): RouteHandler {
  return async (_req, { params }) => {
    const { check } = await params;
    return toResponse(await zpages.getReadiness(check));
  };
}
