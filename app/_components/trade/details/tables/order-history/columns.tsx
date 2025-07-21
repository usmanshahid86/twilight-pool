import { Text } from '@/components/typography';
import cn from '@/lib/cn';
import { capitaliseFirstLetter, truncateHash } from '@/lib/helpers';
import BTC from '@/lib/twilight/denoms';
import { TradeOrder } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import Big from 'big.js';
import dayjs from 'dayjs';
import Link from 'next/link';

// Define the TableMeta interface for global table data
interface OrderHistoryTableMeta {
  getCurrentPrice: () => number;
}

// Update the interface to remove currentPrice and privateKey from row data
interface MyTradeOrder extends TradeOrder {
  // Remove currentPrice and privateKey from here since they'll be in TableMeta
}

export const orderHistoryColumns: ColumnDef<MyTradeOrder, any>[] = [
  {
    accessorKey: "date",
    header: "Time",
    accessorFn: (row) => dayjs(row.date).format("DD/MM/YYYY HH:mm:ss"),
  },
  {
    accessorKey: "uuid",
    header: "Order ID",
    cell: (row) => {
      const trade = row.row.original;
      return (
        <span onClick={() => {
          navigator.clipboard.writeText(trade.uuid);
        }} className="font-medium cursor-pointer hover:underline">
          {trade.uuid.slice(0, 8)}...
        </span>
      );
    }
  },
  {
    accessorKey: "tx_hash",
    header: "TxHash",
    cell: (row) => {
      const order = row.row.original;
      if (!order.tx_hash) {
        return <Text className="text-primary-accent">-</Text>;
      }

      return (
        <Link
          href={`https://explorer.twilight.rest/tx/${order.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
        >
          {truncateHash(order.tx_hash)}
        </Link>
      );
    },
  },
  {
    accessorKey: "orderType",
    header: "Type",
    accessorFn: (row) => capitaliseFirstLetter(row.orderType)
  },
  {
    accessorKey: "orderStatus",
    header: "Status",
    cell: (row) => {
      const status = row.getValue() as string;
      return (
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            status === "SETTLED"
              ? "bg-green-medium/10 text-green-medium"
              : status === "LIQUIDATED"
                ? "bg-red/10 text-red"
                : "bg-gray-500/10 text-gray-500"
          )}
        >
          {capitaliseFirstLetter(status)}
        </span>
      );
    },
  },
  {
    accessorKey: "positionType",
    header: "Side",
    cell: (row) => {
      const positionType = row.getValue() as string;
      return (
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            positionType === "LONG"
              ? "bg-green-medium/10 text-green-medium"
              : "bg-red/10 text-red"
          )}
        >
          {capitaliseFirstLetter(positionType)}
        </span>
      );
    },
  },
  {
    accessorKey: "positionSize",
    header: "Pos. Size (USD)",
    cell: (row) => {
      const trade = row.row.original;
      const positionSize = new BTC("sats", Big(trade.positionSize))
        .convert("BTC")
        .toFixed(2)

      return (
        <span className="font-medium">
          ${positionSize}
        </span>
      );
    },
  },
  {
    accessorKey: "positionValue",
    header: "Pos. Value (BTC)",
    cell: (row) => {
      const trade = row.row.original;
      const markPrice = trade.settlementPrice || trade.entryPrice;

      if (!markPrice) {
        return <span className="text-xs text-gray-500">—</span>;
      }

      const positionValue = new BTC("sats", Big(Math.abs(trade.positionSize / markPrice)))
        .convert("BTC")

      return (
        <span className="font-medium">
          {BTC.format(positionValue, "BTC")}
        </span>
      );
    },
  },
  {
    accessorKey: "entryPrice",
    header: "Entry Price (USD)",
    accessorFn: (row) => `$${row.entryPrice.toFixed(2)}`
  },
  {
    accessorKey: "leverage",
    header: "Leverage",
    accessorFn: (row) => `${row.leverage.toFixed(2)}x`
  },
  {
    accessorKey: "realizedPnl",
    header: "PnL (BTC)",
    cell: (row) => {
      const trade = row.row.original;

      const pnl = trade.realizedPnl || trade.unrealizedPnl || 0;

      if (pnl === undefined || pnl === null) {
        return <span className="text-xs text-gray-500">0</span>;
      }

      const isPositive = pnl > 0;
      const isNegative = pnl < 0;

      const displayPnl = BTC.format(new BTC("sats", Big(pnl)).convert("BTC"), "BTC");

      return (
        <span
          className={cn(
            "text-xs font-medium",
            isPositive && "text-green-medium",
            isNegative && "text-red",
            !isPositive && !isNegative && "text-gray-500"
          )}
        >
          {isPositive ? "+" : ""}{displayPnl}
        </span>
      );
    },
  },
  // {
  //   accessorKey: "liquidationPrice",
  //   header: "Liq Price (USD)",
  //   cell: (row) => {
  //     const trade = row.row.original;
  //     const liquidationPrice = trade.liquidationPrice;

  //     if (trade.orderStatus !== "LIQUIDATED") {
  //       return <span className="text-xs text-gray-500">—</span>;
  //     }

  //     return (
  //       <span className="font-medium">
  //         ${liquidationPrice.toFixed(2)}
  //       </span>
  //     );
  //   }
  // },
  {
    accessorKey: "availableMargin",
    header: "Avail. Margin (BTC)",
    accessorFn: (row) => BTC.format(new BTC("sats", Big(row.availableMargin)).convert("BTC"), "BTC")
  },
  {
    accessorKey: "funding",
    header: "Funding (BTC)",
    cell: (row) => {
      const trade = row.row.original;

      const pnl = trade.realizedPnl || trade.unrealizedPnl || 0;
      const funding = trade.initialMargin - trade.availableMargin - trade.feeFilled - trade.feeSettled + pnl;

      const fundingBTC = new BTC("sats", Big(funding))
        .convert("BTC")

      return (
        <span className={cn("font-medium",
          funding > 0 ? "text-green-medium" :
            funding < 0 ? "text-red" :
              ""
        )}>
          {BTC.format(fundingBTC, "BTC")}
        </span>
      );
    },
  },
  {
    accessorKey: "feeFilled",
    header: "Fee (BTC)",
    cell: (row) => {
      const trade = row.row.original;
      const fee = trade.feeFilled + trade.feeSettled;

      if (trade.orderStatus === "CANCELLED" || trade.orderStatus === "LIQUIDATED" || trade.orderStatus === "PENDING") {
        return <span className="text-xs text-gray-500">-</span>;
      }

      return (
        <span className="font-medium">
          {BTC.format(new BTC("sats", Big(fee)).convert("BTC"), "BTC")}
        </span>
      );
    }
  },
]

// Export the TableMeta type for use in the data table component
export type { OrderHistoryTableMeta };
