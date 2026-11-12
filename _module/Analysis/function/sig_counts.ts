import schema from "./schema";


type Position = number | { position: number; index: number };

/**
 * Names of the sigs that are not removed, by id. The charts leave out
 * removed sigs.
 */
export async function readSigNames() {
  const sigs = await schema.sig
    .find({ removed: false }, { name: 1 })
    .lean<{ _id: unknown; name?: unknown }[]>();

  const names = new Map<string, string>();
  for (const sig of sigs) {
    const id = String(sig._id);
    if (!names.has(id) && sig.name != null) names.set(id, String(sig.name));
  }
  return names;
}

/**
 * Turns per-sig-id counts into the chart rows: rows of sigs that share a name
 * are merged, sigs without a name (or removed) are dropped, and rows are
 * sorted by count, highest first. Equal counts keep the order in which the
 * sig was first seen, which is what the previous implementation's stable
 * sort produced.
 */
export function countByNameInFirstSeenOrder(
  groups: { _id: unknown; count: number; first: Position }[],
  sigNames: Map<string, string>
): Array<{ name: string; count: number }> {
  const rows = new Map<string, { count: number; first: [number, number] }>();

  for (const group of groups) {
    const name = sigNames.get(String(group._id));
    if (!name) continue;

    const first: [number, number] =
      typeof group.first === "number"
        ? [group.first, 0]
        : [Number(group.first.position), Number(group.first.index)];

    const row = rows.get(name);
    if (!row) {
      rows.set(name, { count: group.count, first });
      continue;
    }
    row.count += group.count;
    if (comparePosition(first, row.first) < 0) row.first = first;
  }

  return Array.from(rows.entries())
    .sort(
      ([, a], [, b]) => b.count - a.count || comparePosition(a.first, b.first)
    )
    .map(([name, { count }]) => ({ name, count }));
}

function comparePosition(a: [number, number], b: [number, number]) {
  return a[0] - b[0] || a[1] - b[1];
}
