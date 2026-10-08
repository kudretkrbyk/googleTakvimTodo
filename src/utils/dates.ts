export const deviceTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}
export function dayLabel(key: string, now = new Date()): string {
  if (key === dateKey(now)) return "Bugün";
  if (key === addDays(dateKey(now), 1)) return "Yarın";
  return new Date(`${key}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}
export function startDay(start: string): string {
  return start.length === 10 ? start : dateKey(new Date(start));
}
// Local civil time is constructed first; ISO conversion preserves its UTC offset.
export function toStart(date: string, time: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    dateKey(new Date(`${date}T12:00:00`)) !== date
  )
    throw new Error("Geçerli bir tarih seç.");
  if (!time) return date;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Saat HH:MM biçiminde olmalı.");
  const d = new Date(`${date}T${time}:00`);
  if (d.getHours() !== Number(time.slice(0, 2)))
    throw new Error("Bu saat yaz saati geçişinde mevcut değil.");
  return d.toISOString();
}
export const timeLabel = (start: string) =>
  start.length === 10
    ? "Tüm gün"
    : new Date(start).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
