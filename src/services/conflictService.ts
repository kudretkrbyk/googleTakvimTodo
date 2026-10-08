import { database } from "../storage/database";
import { Entry } from "../types/models";
export interface Conflict {
  id: number;
  entry_id: string;
  local_data: string;
  remote_data: string;
  created_at: string;
}
export async function listConflicts() {
  return (await database()).getAllAsync<Conflict>(
    "SELECT * FROM conflicts ORDER BY id",
  );
}
export async function resolveConflict(id: number, keepLocal: boolean) {
  // All replacement, outbox and conflict changes commit together. A deleted
  // remote task restored by the user gets a fresh Google ID rather than reusing
  // a tombstone, which Calendar does not allow.
  const newGoogleId = keepLocal
    ? (await import("expo-crypto")).randomUUID().replace(/-/g, "")
    : null;
  await (
    await database()
  ).withExclusiveTransactionAsync(async (tx) => {
    const item = await tx.getFirstAsync<Conflict>(
      "SELECT * FROM conflicts WHERE id=?",
      id,
    );
    if (!item) return;
    const row = await tx.getFirstAsync<{ data: string }>(
      "SELECT data FROM entries WHERE id=?",
      item.entry_id,
    );
    const local = row
      ? (JSON.parse(row.data) as Entry)
      : (JSON.parse(item.local_data) as Entry);
    const remote = JSON.parse(item.remote_data) as Entry;
    let chosen: Entry | null;
    let operation: "create" | "update" | "delete" | null = null;
    if (keepLocal) {
      chosen = {
        ...local,
        etag: remote.etag,
        remoteUpdatedAt: remote.remoteUpdatedAt,
        revision: local.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      if (remote.deleted) {
        if (local.deleted) chosen = null;
        else {
          if (chosen.provider === "google_tasks")
            throw new Error(
              "Bu görev Google Tasks’te silinmiş. Cihazdaki sürüm korunuyor; yeniden oluşturmak için Google Tasks’te yeni bir görev ekle.",
            );
          chosen.googleId = newGoogleId!;
          chosen.id = `${chosen.calendarId}:${newGoogleId}`;
          chosen.etag = null;
          chosen.remoteUpdatedAt = null;
          chosen.previousCalendarId = undefined;
          operation = "create";
        }
      } else operation = local.deleted ? "delete" : "update";
      if (chosen && operation) chosen.syncState = `pending_${operation}`;
    } else
      chosen = remote.deleted
        ? null
        : {
            ...remote,
            id: local.id,
            syncState: "synced",
            revision: local.revision + 1,
          };
    await tx.runAsync("DELETE FROM queue WHERE entry_id=?", item.entry_id);
    await tx.runAsync("DELETE FROM entries WHERE id=?", item.entry_id);
    if (chosen) {
      await tx.runAsync(
        "INSERT INTO entries VALUES(?,?,?,?,?,?)",
        chosen.id,
        chosen.calendarId,
        chosen.googleId,
        JSON.stringify(chosen),
        chosen.syncState,
        chosen.revision,
      );
      if (operation)
        await tx.runAsync(
          "INSERT INTO queue(entry_id,operation) VALUES(?,?)",
          chosen.id,
          operation,
        );
    }
    await tx.runAsync("DELETE FROM conflicts WHERE entry_id=?", item.entry_id);
  });
}
