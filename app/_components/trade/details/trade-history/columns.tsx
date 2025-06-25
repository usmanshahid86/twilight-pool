"use client";

import { convertDate } from "@/app/(main)/wallet/transaction-history/columns";
import Button from "@/components/button";
import cn from "@/lib/cn";
import BTC from "@/lib/twilight/denoms";
import { TradeOrder } from '@/lib/types';
import { ColumnDef } from "@tanstack/react-table";
import Big from "big.js";
import Link from "next/link";
interface MyTradeOrder extends TradeOrder {
  currentPrice?: number;
  calculatedUnrealizedPnl?: number;
}

function capitaliseFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const tradeHistoryColumns: ColumnDef<MyTradeOrder, any>[] = [
  {
    accessorKey: "value",
    header: "Position Size (USD)",
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
    header: "Position Value (BTC)",
    cell: (row) => {
      const trade = row.row.original;
      const markPrice = trade.currentPrice || trade.entryPrice;
      const positionValue = new BTC("sats", Big(Math.abs(trade.positionSize / markPrice)))
        .convert("BTC")

      return (
        <span className="font-medium">
          {BTC.format(positionValue, "BTC")} BTC
        </span>
      );
    },
  },
  {
    accessorKey: "leverage",
    header: "Leverage",
    cell: (row) => {
      const trade = row.row.original;

      return (
        <span className="font-medium">
          {trade.leverage.toFixed(2)}x
        </span>
      );
    },
  },
  {
    accessorKey: "entryPrice",
    header: "Entry Price (USD)",
    cell: (row) => {
      const trade = row.row.original;
      return (
        <span className="font-medium">
          ${trade.entryPrice.toFixed(2)}
        </span>
      );
    },
  },
  {
    accessorKey: "unrealizedPnl",
    header: "PnL",
    cell: (row) => {
      const trade = row.row.original;

      const upnl = trade.unrealizedPnl;

      if (upnl === undefined || upnl === null || trade.orderStatus === "PENDING") {
        return <span className="text-xs text-gray-500">—</span>;
      }

      const isPositive = upnl > 0;
      const isNegative = upnl < 0;

      const displayupnl = BTC.format(new BTC("sats", Big(upnl)).convert("BTC"), "BTC");

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
    accessorKey: "positionType",
    header: "Type",
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
    header: "Order Type",
    cell: (row) => {
      const orderType = row.getValue() as string;
      return (
        <span className="font-medium">
          {capitaliseFirstLetter(orderType)}
        </span>
      );
    },
  },
  {
    accessorKey: "orderStatus",
    header: "Status",
    cell: (row) => {
      const status = row.getValue() as string;
      return (
        <span className="font-medium">
          {capitaliseFirstLetter(status)}
        </span>
      );
    },
  },
  {
    accessorKey: "tx_hash",
    header: "Transaction Hash",
    cell: (row) => (
      <Button className="justify-end" asChild variant="link">
        <Link
          href={`https://explorer.twilight.rest/nyks/tx/${row.getValue()}`}
          target="_blank"
        >
          {(row.getValue() as string).slice(0, 8)}...{(row.getValue() as string).slice(-8)}
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: "date",
    header: "Date & Time",
    accessorFn: (row) => convertDate(row.date).toLocaleString(),
  },
];
