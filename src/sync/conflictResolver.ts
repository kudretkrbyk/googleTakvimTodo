import { Entry } from "../types/models";
export function conflictDecision(
  local: Entry,
  remote: Entry,
): "remote" | "local" | "conflict" {
  if (local.syncState === "synced") return "remote";
  if (local.etag && remote.etag)
    return local.etag === remote.etag ? "local" : "conflict";
  if (
    (remote.etag && remote.etag === local.etag) ||
    (remote.remoteUpdatedAt && remote.remoteUpdatedAt === local.remoteUpdatedAt)
  )
    return "local";
  // Device clocks cannot be trusted to silently pick a winner. Keep both versions
  // when the server baseline changed; timestamps are available for user review.
  return "conflict";
}
