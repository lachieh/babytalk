const DEFAULT_API_URL = "http://localhost:4000/graphql";

export const getApiUrl = (): string => {
  if (typeof window !== "undefined") {
    return (
      (window as unknown as { __ENV__?: { API_URL?: string } }).__ENV__
        ?.API_URL || DEFAULT_API_URL
    );
  }
  return process.env.API_URL || DEFAULT_API_URL;
};
