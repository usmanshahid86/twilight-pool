"use client";

import { Text } from "@/components/typography";
import { LendOrder } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import Big from "big.js";
import BTC from "@/lib/twilight/denoms";
import cn from "@/lib/cn";
import Link from "next/link";

export interface LendHistoryTableMeta {
  getCurrentPrice: () => number;
}

export const lendHistoryColumns: ColumnDef<LendOrder, any>[] = [
  {
    accessorKey: "timestamp",
    header: "Date",
    accessorFn: (row) => dayjs(row.timestamp).format("DD/MM/YYYY HH:mm:ss"),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: (row) => {
      const order = row.row.original;
      // Determine if this is a deposit or withdraw based on order data
      const type = order.nwithdraw ? "Withdraw" : "Deposit";
      return (
        <Text className="font-medium">
          {type}
        </Text>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: (row) => {
      const order = row.row.original;
      // Use withdrawal amount if it's a withdraw, otherwise use balance
      const amount = order.nwithdraw || order.value;
      const amountBTC = new BTC("sats", Big(amount)).convert("BTC");
      return (
        <Text className="font-medium">
          {BTC.format(amountBTC, "BTC")}
        </Text>
      );
    },
  },
  {
    accessorKey: "payment",
    header: "Rewards",
    cell: (row) => {
      const order = row.row.original;
      // Only show rewards for withdraw transactions
      if (!order.nwithdraw || !order.payment) {
        return <Text className="text-primary-accent">-</Text>;
      }

      const rewardsBTC = new BTC("sats", Big(order.payment)).convert("BTC");
      return (
        <Text className="font-medium text-green-medium">
          {BTC.format(rewardsBTC, "BTC")}
        </Text>
      );
    },
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
          href={`https://explorer.twilight.org/tx/${order.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline text-theme"
        >
          {order.tx_hash.slice(0, 8)}...
        </Link>
      );
    },
  },
  {
    accessorKey: "orderStatus",
    header: "Status",
    cell: (row) => {
      const order = row.row.original;
      const getStatusColor = (status: string) => {
        switch (status) {
          case "SETTLED":
            return "bg-green-medium/10 text-green-medium";
          case "CANCELLED":
            return "bg-red/10 text-red";
          case "ERROR":
            return "bg-red/10 text-red";
          default:
            return "bg-primary/10 text-primary";
        }
      };

      return (
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            getStatusColor(order.orderStatus)
          )}
        >
          {order.orderStatus}
        </span>
      );
    },
  },
]; 