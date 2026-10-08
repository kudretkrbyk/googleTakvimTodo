// Returning from Calendar must fetch changes even if the previous sync was only
// seconds ago. Only transitions back to active trigger this; no timer polling.
export function createForegroundSyncHandler(
  refresh: () => Promise<void>,
  initialState: string | null,
) {
  let previous = initialState;
  return (next: string) => {
    const returned = next === "active" && previous !== "active";
    previous = next;
    if (returned) void refresh();
  };
}
