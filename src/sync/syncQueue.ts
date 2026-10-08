import { database } from "../storage/database";
export interface QueueItem {
  entry_id: string;
  operation: "create" | "update" | "delete";
  attempts: number;
}
export async function pending() {
  return (await database()).getAllAsync<QueueItem>(
    "SELECT entry_id,operation,attempts FROM queue WHERE next_attempt<=? ORDER BY rowid",
    Date.now(),
  );
}
export async function backoff(item: QueueItem) {
  await (
    await database()
  ).runAsync(
    "UPDATE queue SET attempts=attempts+1,next_attempt=? WHERE entry_id=?",
    Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(item.attempts, 7)),
    item.entry_id,
  );
}

type ClaimedEntry = import("../types/models").Entry & {
  queueOperation: QueueItem["operation"];
};
export async function claim(id: string): Promise<ClaimedEntry | null> {
  let entry: ClaimedEntry | null = null;
  await (
    await database()
  ).withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{
      data: string;
      operation: QueueItem["operation"];
    }>(
      "SELECT e.data,q.operation FROM entries e JOIN queue q ON q.entry_id=e.id WHERE e.id=? AND q.next_attempt<=?",
      id,
      Date.now(),
    );
    if (!row) return;
    entry = {
      ...(JSON.parse(row.data) as import("../types/models").Entry),
      queueOperation: row.operation,
    };
    await tx.runAsync(
      "UPDATE queue SET in_flight=1,attempted=1 WHERE entry_id=?",
      id,
    );
  });
  return entry;
}
