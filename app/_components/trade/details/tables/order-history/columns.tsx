"use client";

import Button from "@/components/button";
import cn from "@/lib/cn";
import { capitaliseFirstLetter } from '@/lib/helpers';
import BTC from "@/lib/twilight/denoms";
import { TradeOrder } from '@/lib/types';
import { ColumnDef } from "@tanstack/react-table";
import Big from "big.js";
import dayjs from 'dayjs';
import Link from "next/link";
interface MyTradeOrder extends TradeOrder {
  currentPrice?: number;
  calculatedUnrealizedPnl?: number;
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
          {BTC.format(positionValue, "BTC")}
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
    header: "PnL (BTC)",
    cell: (row) => {
      const trade = row.row.original;

      const upnl = trade.unrealizedPnl;

      if (upnl === undefined || upnl === null || trade.orderStatus !== "SETTLED") {
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
          {isPositive ? "+" : ""}{displayupnl}
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
    accessorKey: "funding",
    header: "Funding (BTC)",
    cell: (row) => {
      const trade = row.row.original;

      if (trade.orderStatus !== "SETTLED") {
        return <span className="text-xs text-gray-500">—</span>;
      }

      const fee = trade.feeFilled + trade.feeSettled;

      const pnl = trade.unrealizedPnl || 0;
      const funding = trade.initialMargin - trade.availableMargin - fee + pnl;
      const fundingBTC = new BTC("sats", Big(funding))
        .convert("BTC")

      return (
        <span className={cn("font-medium",
          funding > 0 ? "text-green-medium" :
            funding < 0 ? "text-red" :
              ""
        )}>
          {BTC.format(fundingBTC, "BTC")} BTC
        </span>
      );
    },
  },
  {
    accessorKey: "availableMargin",
    header: "Avl. Margin (BTC)",
    cell: (row) => {
      const trade = row.row.original;

      const isPendingLimit = trade.orderType === "LIMIT" && trade.orderStatus === "PENDING";

      if (isPendingLimit) {
        return <span className="text-xs text-gray-500">—</span>;
      }

      const availableMargin = new BTC("sats", Big(trade.availableMargin))
        .convert("BTC")

      return (
        <span className="font-medium">
          {BTC.format(availableMargin, "BTC")}
        </span>
      );
    },
  },
  {
    accessorKey: "feeSettled",
    header: "Fee (BTC)",
    cell: (row) => {
      const trade = row.row.original;
      const fee = trade.feeSettled + trade.feeFilled;

      if (trade.orderStatus === "PENDING" || trade.orderStatus === "CANCELLED") {
        return <span className="text-xs text-gray-500">—</span>;
      }

      return (
        <span className="font-medium">
          {BTC.format(new BTC("sats", Big(fee)).convert("BTC"), "BTC")}
        </span>
      );
    },
  },
  {
    accessorKey: "tx_hash",
    header: "Transaction Hash",
    cell: (row) => {
      const txHash = row.getValue() as string;

      if (!txHash) return <span className="text-xs text-gray-500">—</span>;

      return (
        <Button className="justify-end" asChild variant="link">
          <Link
            href={`https://explorer.twilight.rest/nyks/tx/${row.getValue()}`}
            target="_blank"
          >
            {(row.getValue() as string).slice(0, 8)}...{(row.getValue() as string).slice(-8)}
          </Link>
        </Button>
      )
    },
  },
  {
    accessorKey: "date",
    header: "Date & Time",
    accessorFn: (row) => dayjs(row.date).format("DD/MM/YYYY HH:mm:ss"),
  },
];
