import { describe, it, expect } from "vitest";
import { recurrenceRule, expandEntries } from "../src/utils/recurrence";
import { dateKey, dayLabel, toStart, addDays } from "../src/utils/dates";
import { fromGoogle, toGoogle } from "../src/services/mapping";
import { conflictDecision } from "../src/sync/conflictResolver";
import { Entry } from "../src/types/models";
const entry: Entry = {
  id: "local",
  googleId: "abcdef",
  calendarId: "primary",
  title: "Rapor",
  start: "2026-10-07",
  end: "2026-10-08",
  allDay: true,
  timezone: "Europe/Istanbul",
  recurrence: [],
  kind: "TASK",
  completed: false,
  updatedAt: "2026-10-07T10:00:00Z",
  remoteUpdatedAt: "2026-10-07T09:00:00Z",
  etag: "v1",
  syncState: "synced",
  deleted: false,
  revision: 1,
};
describe("civil dates and grouping", () => {
  it("uses local calendar date, not UTC date", () => {
    const d = new Date(2026, 9, 7, 0, 5);
    expect(dateKey(d)).toBe("2026-10-07");
  });
  it("labels today and tomorrow and crosses months", () => {
    const now = new Date(2026, 9, 31, 12);
    expect(dayLabel("2026-10-31", now)).toBe("Bugün");
    expect(dayLabel("2026-11-01", now)).toBe("Yarın");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("rejects impossible dates and time", () => {
    expect(() => toStart("2026-02-30", "")).toThrow();
    expect(() => toStart("2026-10-07", "25:30")).toThrow();
    expect(toStart("2026-10-07", "")).toBe("2026-10-07");
  });
});
describe("recurrence", () => {
  it("builds weekdays, weekends, dynamic weekly and custom rules", () => {
    expect(recurrenceRule("weekdays", "2026-10-07", [])).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    ]);
    expect(recurrenceRule("weekly", "2026-10-07", [])).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=WE",
    ]);
    expect(recurrenceRule("custom", "2026-10-07", ["MO", "FR"])).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=MO,FR",
    ]);
    expect(() => recurrenceRule("custom", "2026-10-07", [])).toThrow();
  });
  it("expands only the requested horizon and hides completed rows", () => {
    const rows = expandEntries(
      [{ ...entry, recurrence: ["RRULE:FREQ=DAILY"] }],
      7,
      new Date(2026, 9, 7, 12),
    );
    expect(rows).toHaveLength(7);
    expect(rows[6]?.start).toBe("2026-10-13");
    expect(
      expandEntries([{ ...entry, completed: true }], 7, new Date(2026, 9, 7)),
    ).toHaveLength(0);
  });
  it("orders all-day before timed events", () => {
    const rows = expandEntries(
      [
        {
          ...entry,
          id: "timed",
          allDay: false,
          start: new Date(2026, 9, 7, 9).toISOString(),
          end: new Date(2026, 9, 7, 10).toISOString(),
        },
        entry,
      ],
      7,
      new Date(2026, 9, 7),
    );
    expect(rows[0]?.allDay).toBe(true);
  });
  it("preserves wall time across DST", () => {
    const e = {
      ...entry,
      allDay: false,
      start: "2026-10-24T07:00:00Z",
      end: "2026-10-24T08:00:00Z",
      timezone: "Europe/Berlin",
      recurrence: ["RRULE:FREQ=DAILY;COUNT=3"],
    };
    const rows = expandEntries([e], 7, new Date(2026, 9, 24, 12));
    expect(rows.map((v) => v.start)).toEqual([
      "2026-10-24T07:00:00.000Z",
      "2026-10-25T08:00:00.000Z",
      "2026-10-26T08:00:00.000Z",
    ]);
  });
  it("suppresses a deleted recurring exception without deleting the series", () => {
    const master = { ...entry, recurrence: ["RRULE:FREQ=DAILY"] };
    const exception = {
      ...entry,
      id: "exception",
      googleId: "instance",
      recurrence: [],
      recurringEventId: entry.googleId,
      originalStart: "2026-10-08",
      deleted: true,
    };
    expect(
      expandEntries([master, exception], 7, new Date(2026, 9, 7)),
    ).toHaveLength(6);
  });
});
describe("Google mapping", () => {
  it("roundtrips private task/completion metadata with exclusive all-day end", () => {
    const body = toGoogle({ ...entry, completed: true }, { unrelated: "keep" });
    expect(body.extendedProperties?.private?.unrelated).toBe("keep");
    const mapped = fromGoogle({ id: "abcdef", ...body }, "primary");
    expect(mapped?.kind).toBe("TASK");
    expect(mapped?.completed).toBe(true);
    expect(mapped?.end).toBe("2026-10-08");
  });
  it("treats ordinary Google events as events and normalizes offsets", () => {
    const e = fromGoogle(
      {
        id: "x",
        summary: "Toplantı",
        start: { dateTime: "2026-10-07T10:00:00+03:00" },
        end: { dateTime: "2026-10-07T11:00:00+03:00" },
      },
      "work",
    );
    expect(e?.kind).toBe("EVENT");
    expect(e?.start).toBe("2026-10-07T07:00:00.000Z");
  });
});
describe("conflict and pending states", () => {
  it("accepts remote changes for clean records", () =>
    expect(conflictDecision(entry, { ...entry, etag: "v2" })).toBe("remote"));
  it("preserves pending edit when remote baseline is unchanged", () =>
    expect(
      conflictDecision({ ...entry, syncState: "pending_update" }, entry),
    ).toBe("local"));
  it("keeps both versions when baseline changed even if device clock is newer", () =>
    expect(
      conflictDecision(
        { ...entry, syncState: "pending_update" },
        { ...entry, etag: "v2", remoteUpdatedAt: "2026-10-07T09:30:00Z" },
      ),
    ).toBe("conflict"));
  it("does not mistake missing remote timestamps for matching baseline", () =>
    expect(
      conflictDecision(
        {
          ...entry,
          syncState: "pending_update",
          etag: null,
          remoteUpdatedAt: null,
        },
        { ...entry, deleted: true, etag: null, remoteUpdatedAt: null },
      ),
    ).toBe("conflict"));
});

import { widgetSnapshot } from "../src/utils/widgetData";
describe("bounded widget projection", () => {
  it("contains only date/time/title/group and excludes completed tasks", () => {
    const rows = widgetSnapshot(
      [entry, { ...entry, id: "done", completed: true }],
      new Date(2026, 9, 7),
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "date",
      "group",
      "time",
      "title",
    ]);
    expect(rows[0]?.group).toBe("Bugün");
  });
  it("limits snapshot payload to the nearest hundred rows", () => {
    const entries = Array.from({ length: 150 }, (_, i) => ({
      ...entry,
      id: `${i}`,
      title: `Task ${i}`,
    }));
    expect(widgetSnapshot(entries, new Date(2026, 9, 7))).toHaveLength(100);
  });
});

describe("imported recurrence boundary semantics", () => {
  it("excludes UTC EXDATE at the same series wall time", () => {
    const e = {
      ...entry,
      allDay: false,
      start: "2026-10-07T07:00:00Z",
      end: "2026-10-07T08:00:00Z",
      recurrence: ["RRULE:FREQ=DAILY;COUNT=3", "EXDATE:20261008T070000Z"],
    };
    expect(
      expandEntries([e], 7, new Date(2026, 9, 7)).map((v) => v.start),
    ).toEqual(["2026-10-07T07:00:00.000Z", "2026-10-09T07:00:00.000Z"]);
  });
  it("includes the last UTC UNTIL occurrence without treating UTC as local", () => {
    const e = {
      ...entry,
      allDay: false,
      start: "2026-10-07T07:00:00Z",
      end: "2026-10-07T08:00:00Z",
      recurrence: ["RRULE:FREQ=DAILY;UNTIL=20261009T070000Z"],
    };
    expect(expandEntries([e], 7, new Date(2026, 9, 7))).toHaveLength(3);
  });
  it("prefers etag changes over an unchanged updated timestamp", () => {
    expect(
      conflictDecision(
        { ...entry, syncState: "pending_update" },
        { ...entry, etag: "v2" },
      ),
    ).toBe("conflict");
  });
});
