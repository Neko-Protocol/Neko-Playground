export interface FifoLot {
  qty: number;
  costBasis: number;
}

export interface Transaction {
  side: "buy" | "sell";
  qty: number;
  price: number;
}

/** Compute realised P&L using FIFO accounting. Returns the running lots as a side effect. */
export function fifoRealizedPnl(transactions: Transaction[]): {
  realizedPnl: number;
  remainingLots: FifoLot[];
} {
  const lots: FifoLot[] = [];
  let realizedPnl = 0;

  for (const tx of transactions) {
    if (tx.side === "buy") {
      lots.push({ qty: tx.qty, costBasis: tx.price });
    } else {
      let remaining = tx.qty;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const sold = Math.min(lot.qty, remaining);
        realizedPnl += sold * (tx.price - lot.costBasis);
        lot.qty -= sold;
        remaining -= sold;
        if (lot.qty <= 0) lots.shift();
      }
    }
  }

  return { realizedPnl, remainingLots: lots };
}

/** Unrealised P&L for open lots at the current market price. */
export function unrealizedPnl(lots: FifoLot[], currentPrice: number): number {
  return lots.reduce(
    (s, lot) => s + lot.qty * (currentPrice - lot.costBasis),
    0
  );
}
