"use client";

import Button from "@/components/button";
import cn from "@/lib/cn";
import BTC from "@/lib/twilight/denoms";
import { TradeOrder } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import Big from "big.js";

interface MyTradeOrder extends TradeOrder {
  onSettle: (trade: TradeOrder) => void;
  onCancel: (trade: TradeOrder) => void;
  currentPrice?: number;
  calculatedUnrealizedPnl?: number;
}

function capitaliseFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const calculateUpnl = (entryPrice: number, currentPrice: number, positionType: string, positionSize: number) => {
  if (currentPrice === 0 || entryPrice === 0) {
    return 0;
  }

  switch (positionType.toUpperCase()) {
    case 'LONG':
      return (positionSize * (currentPrice - entryPrice)) / (entryPrice * currentPrice);

    case 'SHORT':
      return (positionSize * (entryPrice - currentPrice)) / (entryPrice * currentPrice);

    default:
      return 0;
  }
};

export const myTradesColumns: ColumnDef<MyTradeOrder, any>[] = [
  {
    accessorKey: "pair",
    header: "Pair",
    cell: () => (
      <span className="font-medium">BTCUSD</span>
    ),
  },
  {
    accessorKey: "value",
    header: "Quantity",
    cell: (row) => {
      const trade = row.row.original;
      const quantity = new BTC("sats", Big(trade.value))
        .convert("BTC")
        .toString();

      return (
        <span
          className={cn(
            "font-medium",
            trade.positionType === "LONG"
              ? "text-green-medium"
              : "text-red"
          )}
        >
          {quantity} BTC
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
    accessorKey: "orderType",
    header: "Type",
    cell: (row) => (
      <span className="text-xs font-medium">
        {row.getValue() as string}
      </span>
    ),
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
            status === "FILLED"
              ? "bg-green-medium/10 text-green-medium"
              : status === "PENDING"
                ? "bg-yellow-500/10 text-yellow-500"
                : "bg-gray-500/10 text-gray-500"
          )}
        >
          {capitaliseFirstLetter(status)}
        </span>
      );
    },
  },
  {
    accessorKey: "calculatedUnrealizedPnl",
    header: "Unrealized PnL (BTC)",
    cell: (row) => {
      const trade = row.row.original;

      const upnl = trade.calculatedUnrealizedPnl ?? trade.unrealizedPnl;

      if (upnl === undefined || upnl === null) {
        return <span className="text-xs text-gray-500">—</span>;
      }

      const isPositive = upnl > 0;
      const isNegative = upnl < 0;

      const displayupnl = new BTC("sats", Big(upnl)).convert("BTC").toFixed(8);

      return (
        <span
          className={cn(
            "text-xs font-medium",
            isPositive && "text-green-medium",
            isNegative && "text-red",
            !isPositive && !isNegative && "text-gray-500"
          )}
        >
          {isPositive ? "+" : ""}{displayupnl} BTC
        </span>
      );
    },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    cell: (row) => {
      const trade = row.row.original;

      return (
        <div className="flex space-x-2 justify-end">
          {trade.orderType === "LIMIT" && (
            <Button
              onClick={async (e) => {
                e.preventDefault();
                trade.onCancel(trade);
              }}
              variant="ui"
              size="small"
              disabled
            >
              Cancel
            </Button>
          )}
          {((trade.orderType === "LIMIT" && trade.orderStatus === "FILLED") ||
            trade.orderType === "MARKET") && (
              <Button
                onClick={async (e) => {
                  e.preventDefault();
                  trade.onSettle(trade);
                }}
                variant="ui"
                size="small"
              >
                Close
              </Button>
            )}
        </div>
      );
    },
  },
];
