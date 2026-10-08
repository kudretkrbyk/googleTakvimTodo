import { describe, expect, it } from "vitest";
import {
  fromGoogleTask,
  toGoogleTaskPatch,
  tasksListId,
} from "../src/services/googleTasksMapping";
import { expandEntries } from "../src/utils/recurrence";
describe("Google Tasks mapping", () => {
  const task = {
    id: "id",
    title: "Görev",
    due: "2030-10-07T00:00:00.000Z",
    status: "needsAction" as const,
  };
  it("keeps due as a civil date and namespaces list IDs", () => {
    const entry = fromGoogleTask(task, "list");
    expect(entry.start).toBe("2030-10-07");
    expect(entry.end).toBe("2030-10-08");
    expect(entry.provider).toBe("google_tasks");
    expect(tasksListId(entry)).toBe("list");
    expect(entry.id).not.toBe(fromGoogleTask(task, "other").id);
  });
  it("only patches completion without overwriting native schedules or notes", () => {
    expect(
      toGoogleTaskPatch(
        { ...fromGoogleTask(task, "list"), completed: true },
        task,
      ),
    ).toEqual({ status: "completed" });
  });
  it("only patches changed title/date", () => {
    expect(
      toGoogleTaskPatch(
        { ...fromGoogleTask(task, "list"), title: "Yeni" },
        task,
      ),
    ).toEqual({ title: "Yeni" });
    expect(
      toGoogleTaskPatch(
        { ...fromGoogleTask(task, "list"), start: "2030-10-08" },
        task,
      ),
    ).toEqual({ due: "2030-10-08T00:00:00.000Z" });
  });
  it("does not assign today to an undated task", () => {
    const entry = fromGoogleTask({ ...task, due: undefined }, "list");
    expect(entry.undated).toBe(true);
    expect(expandEntries([entry], 30, new Date("2030-10-07"))).toEqual([]);
  });
});
