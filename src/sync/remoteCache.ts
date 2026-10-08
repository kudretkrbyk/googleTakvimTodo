import type { SQLiteDatabase } from "expo-sqlite";
import { database } from "../storage/database";
import { Entry } from "../types/models";
import { conflictDecision } from "./conflictResolver";
type RemoteTransaction = Pick<SQLiteDatabase, "getFirstAsync" | "runAsync">;
export async function recordConflict(local: Entry, remote: Entry) {
  const db = await database();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const stored = await tx.getFirstAsync<{ data: string }>(
      "SELECT data FROM entries WHERE id=?",
      local.id,
    );
    if (!stored) return;
    local = JSON.parse(stored.data) as Entry;
    await tx.runAsync(
      "INSERT INTO conflicts(entry_id,local_data,remote_data,created_at) VALUES(?,?,?,?) ON CONFLICT(entry_id) DO UPDATE SET local_data=excluded.local_data,remote_data=excluded.remote_data,created_at=excluded.created_at",
      local.id,
      JSON.stringify(local),
      JSON.stringify(remote),
      new Date().toISOString(),
    );
    await tx.runAsync(
      "UPDATE queue SET next_attempt=? WHERE entry_id=?",
      Number.MAX_SAFE_INTEGER,
      local.id,
    );
    local.syncState = "sync_error";
    await tx.runAsync(
      "UPDATE entries SET data=?,state=? WHERE id=?",
      JSON.stringify(local),
      "sync_error",
      local.id,
    );
  });
}
export async function applyRemoteEntry(
  tx: RemoteTransaction,
  remote: Entry,
  local: Entry | null,
) {
  if (local) {
    remote.id = local.id;
    const decision = conflictDecision(local, remote);
    if (decision === "local") return;
    if (decision === "conflict") {
      if (local.syncState === "sync_error") return;
      await tx.runAsync(
        "INSERT INTO conflicts(entry_id,local_data,remote_data,created_at) VALUES(?,?,?,?) ON CONFLICT(entry_id) DO UPDATE SET local_data=excluded.local_data,remote_data=excluded.remote_data,created_at=excluded.created_at",
        local.id,
        JSON.stringify(local),
        JSON.stringify(remote),
        new Date().toISOString(),
      );
      local.syncState = "sync_error";
      await tx.runAsync(
        "UPDATE entries SET data=?,state=? WHERE id=?",
        JSON.stringify(local),
        "sync_error",
        local.id,
      );
      await tx.runAsync(
        "UPDATE queue SET next_attempt=?,in_flight=0 WHERE entry_id=?",
        Number.MAX_SAFE_INTEGER,
        local.id,
      );
      return;
    }
  }
  if (remote.undated && !local) return;
  // Keep recurrence masters/exceptions, but do not cache unrelated past events.
  if (
    !remote.recurrence.length &&
    !remote.recurringEventId &&
    new Date(remote.end).getTime() < Date.now()
  ) {
    if (local)
      await tx.runAsync(
        "DELETE FROM entries WHERE id=? AND state='synced'",
        local.id,
      );
    return;
  }
  await tx.runAsync(
    "INSERT INTO entries VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,state=excluded.state,revision=excluded.revision",
    remote.id,
    remote.calendarId,
    remote.googleId,
    JSON.stringify(remote),
    remote.syncState,
    remote.revision,
  );
}
