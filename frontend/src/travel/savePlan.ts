import type { Change, Trip, Item } from "./client";
import type { Draft } from "./drafts";
export type SaveStep = { change: Change; localId?: string };
export function prepareChanges(
  existing: Trip | null,
  draft: Draft,
): SaveStep[] {
  const steps: SaveStep[] = [],
    desired = [...draft.items].sort(
      (a, b) => a.day_index - b.day_index || a.position - b.position,
    );
  const expanded =
    !!existing &&
    new Date(draft.metadata.end_date).getTime() -
      new Date(draft.metadata.start_date).getTime() >
      new Date(existing.end_date).getTime() -
        new Date(existing.start_date).getTime();
  if (expanded)
    steps.push({
      change: { kind: "update_metadata", metadata: draft.metadata },
    });
  const current: Item[] = (existing?.items || [])
    .filter((i) => desired.some((d) => d.id === i.id))
    .map((i) => ({ ...i }));
  for (const old of existing?.items || [])
    if (!desired.some((i) => i.id === old.id))
      steps.push({ change: { kind: "remove_item", item_id: old.id } });
  for (const day of new Set(current.map((i) => i.day_index)))
    current
      .filter((i) => i.day_index === day)
      .sort((a, b) => a.position - b.position)
      .forEach((i, index) => (i.position = index));
  for (const item of desired) {
    const old = current.find((i) => i.id === item.id);
    if (!old) {
      steps.push({
        change: {
          kind: "add_item",
          place_id: item.place.id,
          day_index: item.day_index,
          notes: item.notes,
        },
        localId: item.id,
      });
      current.push({
        ...item,
        position: current.filter((i) => i.day_index === item.day_index).length,
      });
    } else if (old.notes !== item.notes)
      steps.push({
        change: { kind: "update_item", item_id: item.id, notes: item.notes },
      });
  }
  for (const item of desired) {
    const ordered = current
      .filter((i) => i.day_index === item.day_index)
      .sort((a, b) => a.position - b.position);
    const old = current.find((i) => i.id === item.id)!;
    if (
      old.day_index !== item.day_index ||
      ordered[item.position]?.id !== item.id
    ) {
      steps.push({
        change: {
          kind: "move_item",
          item_id: item.id,
          day_index: item.day_index,
          position: item.position,
        },
      });
      const previous = old.day_index;
      old.day_index = item.day_index;
      for (const day of new Set([previous, item.day_index])) {
        const group = current
          .filter((i) => i.day_index === day && i.id !== old.id)
          .sort((a, b) => a.position - b.position);
        if (day === item.day_index)
          group.splice(Math.min(item.position, group.length), 0, old);
        group.forEach((i, index) => (i.position = index));
      }
    }
  }
  if (existing && !expanded)
    steps.push({
      change: { kind: "update_metadata", metadata: draft.metadata },
    });
  return steps;
}
