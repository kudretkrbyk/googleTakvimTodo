import { RRule, rrulestr } from "rrule";
import { Entry, Occurrence } from "../types/models";
import { addDays, dateKey, startDay } from "./dates";
export const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export function recurrenceRule(
  mode: string,
  date: string,
  selected: string[],
): string[] {
  if (mode === "none") return [];
  if (mode === "daily") return ["RRULE:FREQ=DAILY"];
  const days =
    mode === "weekdays"
      ? ["MO", "TU", "WE", "TH", "FR"]
      : mode === "weekends"
        ? ["SA", "SU"]
        : mode === "weekly"
          ? [weekdays[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]!]
          : selected;
  if (!days.length) throw new Error("En az bir tekrar günü seç.");
  return [`RRULE:FREQ=WEEKLY;BYDAY=${days.join(",")}`];
}
// Expand floating civil times and convert them explicitly. This avoids rrule
// depending on the runtime host timezone and preserves the series timezone at DST.
export function expandEntries(
  entries: Entry[],
  days: number,
  now = new Date(),
): Occurrence[] {
  const from = dateKey(now),
    until = addDays(from, days);
  const result: Occurrence[] = [];
  const exceptions = new Set(
    entries
      .filter((e) => e.recurringEventId && e.originalStart)
      .map((e) => `${e.calendarId}:${e.recurringEventId}:${e.originalStart}`),
  );
  for (const e of entries) {
    if (e.deleted || e.completed || e.undated) continue;
    const push = (start: string, end: string) => {
      const day = startDay(start);
      if (
        day >= from &&
        day < until &&
        !exceptions.has(`${e.calendarId}:${e.googleId}:${start}`)
      )
        result.push({
          ...e,
          start,
          end,
          sourceId: e.id,
          occurrenceKey: `${e.id}:${start}`,
        });
    };
    if (!e.recurrence.length) {
      push(e.start, e.end);
      continue;
    }
    const dt = e.allDay ? new Date(`${e.start}T00:00:00Z`) : new Date(e.start);
    const civil = e.allDay
      ? dt
      : new Date(Date.UTC(...civilParts(dt, e.timezone)));
    const stamp = civil.toISOString().replace(/[-:]/g, "").slice(0, 15);
    try {
      if (e.recurrence.some((r) => /FREQ=(SECONDLY|MINUTELY|HOURLY)/.test(r))) {
        push(e.start, e.end);
        continue;
      }
      const rule = rrulestr(
        `DTSTART:${stamp}\n${normalizeRecurrence(e).join("\n")}`,
        {
          forceset: true,
        },
      );
      for (const d of rule.between(
        new Date(`${addDays(from, -1)}T00:00:00Z`),
        new Date(`${addDays(until, 1)}T00:00:00Z`),
        true,
        (_date, index) => index < 512,
      )) {
        const instant = e.allDay ? d : civilToInstant(d, e.timezone);
        const start = e.allDay
          ? d.toISOString().slice(0, 10)
          : instant.toISOString();
        const duration = e.allDay
          ? Math.round(
              (new Date(e.end).getTime() - new Date(e.start).getTime()) /
                86400000,
            )
          : new Date(e.end).getTime() - dt.getTime();
        push(
          start,
          e.allDay
            ? addDays(start, duration)
            : new Date(instant.getTime() + duration).toISOString(),
        );
      }
    } catch {
      push(e.start, e.end);
    } // Keep unsupported imported rules visible instead of discarding data.
  }
  return result.sort(
    (a, b) =>
      startDay(a.start).localeCompare(startDay(b.start)) ||
      Number(b.allDay) - Number(a.allDay) ||
      a.start.localeCompare(b.start),
  );
}
function civilParts(
  d: Date,
  timezone: string,
): [number, number, number, number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return [
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second"),
  ];
}
export { RRule };

function civilToInstant(civil: Date, timezone: string): Date {
  const target = civil.getTime();
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    const shown = Date.UTC(...civilParts(new Date(candidate), timezone));
    const difference = target - shown;
    if (!difference) break;
    candidate += difference;
  }
  return new Date(candidate);
}

function normalizeRecurrence(entry: Entry): string[] {
  const stamp = (d: Date) =>
    new Date(Date.UTC(...civilParts(d, entry.timezone)))
      .toISOString()
      .replace(/[-:]/g, "")
      .slice(0, 15);
  const parse = (value: string) =>
    new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`,
    );
  return entry.recurrence.map((line) => {
    if (line.startsWith("RRULE:"))
      return line.replace(
        /UNTIL=(\d{8}T\d{6}Z)/,
        (_match, value: string) =>
          `UNTIL=${entry.allDay ? value.slice(0, 8) : stamp(parse(value))}`,
      );
    const match = /^(RDATE|EXDATE)([^:]*):(.*)$/.exec(line);
    if (!match) return line;
    const zone = /TZID=([^;]+)/.exec(match[2] ?? "")?.[1];
    const values = (match[3] ?? "").split(",").map((value) => {
      if (entry.allDay) return value.slice(0, 8);
      if (value.endsWith("Z")) return stamp(parse(value));
      if (zone) return stamp(civilToInstant(parse(value), zone));
      return value;
    });
    return `${match[1]}${entry.allDay ? ";VALUE=DATE" : ""}:${values.join(",")}`;
  });
}
