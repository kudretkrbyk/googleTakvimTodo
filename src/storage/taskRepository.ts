import { Entry } from "../types/models";
import { database } from "./database";
export const repository = {
  async all(): Promise<Entry[]> {
    return (
      await (
        await database()
      ).getAllAsync<{ data: string }>("SELECT data FROM entries")
    ).map((r) => JSON.parse(r.data) as Entry);
  },
  async get(id: string): Promise<Entry | null> {
    const r = await (
      await database()
    ).getFirstAsync<{ data: string }>(
      "SELECT data FROM entries WHERE id=?",
      id,
    );
    return r ? (JSON.parse(r.data) as Entry) : null;
  },
  async remote(e: Entry) {
    await (
      await database()
    ).runAsync(
      "INSERT INTO entries VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET calendar_id=excluded.calendar_id,google_id=excluded.google_id,data=excluded.data,state=excluded.state,revision=excluded.revision",
      e.id,
      e.calendarId,
      e.googleId,
      JSON.stringify(e),
      e.syncState,
      e.revision,
    );
  },
  async save(e: Entry, operation: "create" | "update" | "delete") {
    const db = await database();
    await db.withExclusiveTransactionAsync(async (tx) => {
      const old = await tx.getFirstAsync<{ data: string }>(
        "SELECT data FROM entries WHERE id=?",
        e.id,
      );
      const prev = old ? (JSON.parse(old.data) as Entry) : null;
      e.revision = (prev?.revision ?? 0) + 1;
      const q = await tx.getFirstAsync<{
        operation: string;
        in_flight: number;
        attempted: number;
      }>(
        "SELECT operation,in_flight,attempted FROM queue WHERE entry_id=?",
        e.id,
      );
      if (
        q?.operation === "create" &&
        !q.attempted &&
        !q.in_flight &&
        operation === "delete"
      ) {
        await tx.runAsync("DELETE FROM entries WHERE id=?", e.id);
        await tx.runAsync("DELETE FROM queue WHERE entry_id=?", e.id);
        return;
      }
      const op =
        q?.operation === "create" && operation !== "delete"
          ? "create"
          : operation;
      e.syncState = `pending_${op}`;
      e.updatedAt = new Date().toISOString();
      await tx.runAsync(
        "INSERT INTO entries VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET calendar_id=excluded.calendar_id,google_id=excluded.google_id,data=excluded.data,state=excluded.state,revision=excluded.revision",
        e.id,
        e.calendarId,
        e.googleId,
        JSON.stringify(e),
        e.syncState,
        e.revision,
      );
      await tx.runAsync(
        "INSERT INTO queue(entry_id,operation) VALUES(?,?) ON CONFLICT(entry_id) DO UPDATE SET operation=excluded.operation,attempts=0,next_attempt=0",
        e.id,
        op,
      );
    });
  },
  async markMoved(id: string, remote: Entry) {
    await (
      await database()
    ).withExclusiveTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<{ data: string }>(
        "SELECT data FROM entries WHERE id=?",
        id,
      );
      if (!row) return;
      const current = JSON.parse(row.data) as Entry;
      current.previousCalendarId = undefined;
      current.etag = remote.etag;
      current.remoteUpdatedAt = remote.remoteUpdatedAt;
      await tx.runAsync(
        "UPDATE entries SET data=? WHERE id=?",
        JSON.stringify(current),
        id,
      );
    });
  },
  async acknowledge(id: string, revision: number, remote: Entry | null) {
    await (
      await database()
    ).withExclusiveTransactionAsync(async (tx) => {
      const r = await tx.getFirstAsync<{ data: string }>(
        "SELECT data FROM entries WHERE id=?",
        id,
      );
      if (!r) return;
      const current = JSON.parse(r.data) as Entry;
      if (current.revision !== revision) {
        if (remote) {
          current.syncState = current.deleted
            ? "pending_delete"
            : "pending_update";
          if (current.calendarId !== remote.calendarId)
            current.previousCalendarId = remote.calendarId;
          current.etag = remote.etag;
          current.remoteUpdatedAt = remote.remoteUpdatedAt;
          await tx.runAsync(
            "UPDATE entries SET data=?,state=? WHERE id=?",
            JSON.stringify(current),
            current.syncState,
            id,
          );
          await tx.runAsync(
            "UPDATE queue SET in_flight=0,operation=CASE WHEN operation='create' THEN 'update' ELSE operation END WHERE entry_id=?",
            id,
          );
        }
        return;
      }
      if (remote) {
        remote.id = id;
        remote.revision = revision;
        await tx.runAsync(
          "UPDATE entries SET data=?,state=? WHERE id=?",
          JSON.stringify(remote),
          "synced",
          id,
        );
      } else await tx.runAsync("DELETE FROM entries WHERE id=?", id);
      await tx.runAsync("DELETE FROM queue WHERE entry_id=?", id);
    });
  },
  async meta(key: string): Promise<string | null> {
    return (
      (
        await (
          await database()
        ).getFirstAsync<{ value: string }>(
          "SELECT value FROM meta WHERE key=?",
          key,
        )
      )?.value ?? null
    );
  },
  async setMeta(key: string, value: string) {
    await (
      await database()
    ).runAsync(
      "INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  },
  async clear() {
    await (
      await database()
    ).withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(
        "DELETE FROM entries; DELETE FROM queue; DELETE FROM meta; DELETE FROM conflicts;",
      );
    });
  },
};
