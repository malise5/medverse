/** Fetch wrapper for the MEDVERSE API. Requests go to the same origin (/api/v1, rewritten). */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export const API_BASE = "/api/v1";

type Query = Record<string, string | number | boolean | undefined | null>;

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

export async function api<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { query?: Query; json?: unknown } = {},
): Promise<T> {
  const { query, json, headers, ...rest } = init;
  const res = await fetch(buildUrl(path, query), {
    credentials: "same-origin",
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const body: ApiErrorBody = data?.error ?? {
      code: "http_error",
      message: `Request failed with status ${res.status}`,
    };
    throw new ApiError(res.status, body);
  }
  return data as T;
}

/** Encode a CURIE structure ID for use as a URL path segment. */
export const structurePath = (id: string) => `/anatomy/structures/${encodeURIComponent(id)}`;

/** Field-level messages from a structured validation error, if any. */
export function errorDetails(error: unknown): string[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return error.details
    .map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : null))
    .filter((m): m is string => m !== null);
}
