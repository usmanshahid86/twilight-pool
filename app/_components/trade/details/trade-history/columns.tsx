"use client";

import { convertDate } from "@/app/(main)/wallet/transaction-history/columns";
import Button from "@/components/button";
import cn from "@/lib/cn";
import BTC from "@/lib/twilight/denoms";
import { ColumnDef } from "@tanstack/react-table";
import Big from "big.js";
import Link from "next/link";

type Trade = {
  value: number;
  orderStatus: string;
  orderType: string;
  positionType: string;
  tx_hash: string;
  date: Date;
  entryPrice: number;
  unrealizedPnl?: number;
};

function capitaliseFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const tradeHistoryColumns: ColumnDef<Trade, any>[] = [
  {
    accessorKey: "value",
    header: "Amount (BTC)",
    accessorFn: (row) =>
      new BTC("sats", Big(row.value)).convert("BTC").toString(),
  },
  {
    accessorKey: "positionType",
    header: "Trade Type",
    cell: (row) => (
      <span
        className={cn(
          row.getValue() === "LONG" ? "text-green-medium" : "text-red"
        )}
      >
        Open {capitaliseFirstLetter(row.getValue() || ("" as string))}
      </span>
    ),
  },
  {
    accessorKey: "orderType",
    header: "Order Type",
  },
  {
    accessorKey: "orderStatus",
    header: "Status",
  },
  {
    accessorKey: "upnl",
    header: "PNL",
    cell: (row) => {
      const trade = row.row.original;
      if (!trade.unrealizedPnl || trade.orderStatus === "PENDING") return <span className="text-gray-medium">0</span>;
      const isPositive = trade.unrealizedPnl >= 0;

      return (
        <span
          className={cn(
            isPositive ? "text-green-medium" : "text-red"
          )}
        >
          {isPositive ? '+' : ''}{`${trade.unrealizedPnl.toFixed(8)}`}
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
          {row.getValue()}
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
