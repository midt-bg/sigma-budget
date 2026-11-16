/** Shared release package and public reproduction types. */
export type ExitCode = 2 | 3 | 4 | 5 | 6;
export class ReleaseError extends Error {
  constructor(
    public readonly code: ExitCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ReleaseError';
  }
}
export interface ReleaseFile {
  path: string;
  sha256: string;
  bytes: number;
  mime: string;
  role?: string;
  [key: string]: unknown;
}
export interface ReleaseManifest {
  manifest_schema: 'budget-release/1';
  data_schema: Record<string, unknown>;
  processing: { code: { commit: string }; [key: string]: unknown };
  inputs: ReleaseFile[];
  outputs: ReleaseFile[];
  [key: string]: unknown;
}
export interface ReleaseEnvironment {
  /** Explicit logical name and one origin for every public and admin request. */
  name: string;
  url: string;
}
export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers: Readonly<Record<string, string>>;
  body?: Uint8Array;
  timeoutMs: number;
  maxResponseBytes: number;
}
export interface HttpResponse {
  status: number;
  body: Uint8Array;
}
/** Injected transports must not follow redirects or log headers/bodies. */
export type HttpTransport = (request: HttpRequest) => Promise<HttpResponse>;
export interface PackageOptions {
  release: string;
  originals: string;
  /** Match the intended environment. Does not change any Worker setting. */
  maxObjectBytes?: number;
}
export const SHA256 = /^[0-9a-f]{64}$/;
export const MANIFEST_LIMIT = 4 * 1024 * 1024;
export const DEFAULT_OBJECT_LIMIT = 256 * 1024 * 1024;
export const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ReleaseError(2, 'Expected valid UTF-8 JSON');
  }
}
