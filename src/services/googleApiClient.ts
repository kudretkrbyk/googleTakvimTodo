import { accessToken } from "./googleAuthService";
export class ApiError extends Error {
  constructor(
    public status: number,
    public reason?: string,
  ) {
    super(`Google isteği başarısız (${status})`);
  }
}
const roots = {
  calendar: "https://www.googleapis.com/calendar/v3",
  tasks: "https://tasks.googleapis.com/tasks/v1",
};
// Both providers share secure token refresh and bounded network timeouts. The
// caller selects an allowlisted Google API; credentials never reach arbitrary URLs.
export async function googleRequest<T>(
  service: keyof typeof roots,
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await accessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response: Response;
  try {
    response = await fetch(`${roots[service]}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 && retry) {
    await accessToken(true);
    return googleRequest(service, path, init, false);
  }
  if (!response.ok) {
    let reason: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: {
          errors?: { reason?: string }[];
          details?: { reason?: string }[];
        };
      };
      reason =
        body.error?.details?.find((d) => d.reason)?.reason ??
        body.error?.errors?.[0]?.reason;
    } catch {
      /* Do not log response bodies or access tokens. */
    }
    throw new ApiError(response.status, reason);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
