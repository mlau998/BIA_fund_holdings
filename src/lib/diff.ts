import { HoldingRecord, Snapshot, ChangeResult } from "@/types";

export function computeChanges(oldSnap: Snapshot, newSnap: Snapshot): ChangeResult {
  const oldMap = new Map<string, HoldingRecord>(
    oldSnap.holdings.map((h) => [h.holding_key, h])
  );
  const newMap = new Map<string, HoldingRecord>(
    newSnap.holdings.map((h) => [h.holding_key, h])
  );

  const additions = [...newMap.values()].filter((h) => !oldMap.has(h.holding_key));
  const deletions = [...oldMap.values()].filter((h) => !newMap.has(h.holding_key));
  const modifications = [...newMap.values()]
    .filter((h) => oldMap.has(h.holding_key))
    .filter((h) => {
      const old = oldMap.get(h.holding_key)!;
      return (
        old.shares !== h.shares ||
        old.portfolio_weight !== h.portfolio_weight ||
        old.market_value !== h.market_value
      );
    })
    .map((h) => ({ before: oldMap.get(h.holding_key)!, after: h }));

  return { additions, deletions, modifications };
}
