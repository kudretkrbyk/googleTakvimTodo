import * as SQLite from "expo-sqlite";
import { migrations } from "./migrations";
let promise: Promise<SQLite.SQLiteDatabase> | undefined;
export function database() {
  return (promise ??= (async () => {
    const db = await SQLite.openDatabaseAsync("sade.db");
    await db.execAsync("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    const version =
      (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
        ?.user_version ?? 0;
    for (let i = version; i < migrations.length; i++)
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.execAsync(migrations[i]!);
        await tx.execAsync(`PRAGMA user_version=${i + 1}`);
      });
    await db.runAsync("UPDATE queue SET in_flight=0");
    return db;
  })());
}
