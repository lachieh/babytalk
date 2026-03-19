const DEFAULT_API_URL = "http://localhost:4000/graphql";

export const getApiUrl = (): string =>
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
