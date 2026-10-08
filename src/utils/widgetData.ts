import { Entry } from "../types/models";
import { expandEntries } from "./recurrence";
import { dayLabel, timeLabel, startDay } from "./dates";
export function widgetSnapshot(entries: Entry[], now = new Date()) {
  // Store only a bounded projection, not tokens or Google metadata. Include 30
  // days so per-widget settings can be changed without waking React Native.
  return expandEntries(entries, 30, now)
    .slice(0, 100)
    .map((e) => ({
      title: e.title,
      date: startDay(e.start),
      group: dayLabel(startDay(e.start), now),
      time:
        e.provider === "google_tasks" ? "Google görevi" : timeLabel(e.start),
    }));
}
