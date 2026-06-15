import { HoldingRecord, Snapshot, ChangeResult } from "@/types";

function normName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

export function computeChanges(oldSnap: Snapshot, newSnap: Snapshot): ChangeResult {
  const oldMap = new Map<string, HoldingRecord>(
    oldSnap.holdings.map((h) => [h.holding_key, h])
  );
  const newMap = new Map<string, HoldingRecord>(
    newSnap.holdings.map((h) => [h.holding_key, h])
  );

  // Secondary lookup by normalized name, for cases where holding_key changed
  // (e.g. a ticker was resolved in the new snapshot but not the old one)
  const oldByName = new Map<string, HoldingRecord>(
    oldSnap.holdings.map((h) => [normName(h.security_name), h])
  );

  const rawAdditions = [...newMap.values()].filter((h) => !oldMap.has(h.holding_key));
  const rawDeletions = [...oldMap.values()].filter((h) => !newMap.has(h.holding_key));

  // Pair up additions/deletions that refer to the same company by name
  const pairedNewKeys = new Set<string>();
  const pairedOldKeys = new Set<string>();
  const nameMatches: Array<{ before: HoldingRecord; after: HoldingRecord }> = [];

  for (const newH of rawAdditions) {
    const oldH = oldByName.get(normName(newH.security_name));
    if (oldH && !newMap.has(oldH.holding_key) && !pairedOldKeys.has(oldH.holding_key)) {
      pairedNewKeys.add(newH.holding_key);
      pairedOldKeys.add(oldH.holding_key);
      // Only count as a modification if something actually changed
      if (
        oldH.shares !== newH.shares ||
        oldH.portfolio_weight !== newH.portfolio_weight ||
        oldH.market_value !== newH.market_value
      ) {
        nameMatches.push({ before: oldH, after: newH });
      }
    }
  }

  const additions = rawAdditions.filter((h) => !pairedNewKeys.has(h.holding_key));
  const deletions = rawDeletions.filter((h) => !pairedOldKeys.has(h.holding_key));

  const modifications = [
    ...nameMatches,
    ...[...newMap.values()]
      .filter((h) => oldMap.has(h.holding_key))
      .filter((h) => {
        const old = oldMap.get(h.holding_key)!;
        return (
          old.shares !== h.shares ||
          old.portfolio_weight !== h.portfolio_weight ||
          old.market_value !== h.market_value
        );
      })
      .map((h) => ({ before: oldMap.get(h.holding_key)!, after: h })),
  ];

  return { additions, deletions, modifications };
}
