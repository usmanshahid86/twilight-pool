"use client";

import Button from "@/components/button";
import { Text } from "@/components/typography";
import { LendOrder } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import Big from "big.js";
import BTC from "@/lib/twilight/denoms";
import { Loader2 } from "lucide-react";
import cn from "@/lib/cn";

export interface LendOrdersTableMeta {
  getCurrentPrice: () => number;
  getPoolSharePrice: () => number;
  settleLendOrder: (order: LendOrder) => Promise<void>;
  settlingOrderId: string | null;
}

export const lendOrdersColumns: ColumnDef<LendOrder, any>[] = [
  {
    accessorKey: "timestamp",
    header: "Date",
    accessorFn: (row) => dayjs(row.timestamp).format("DD/MM/YYYY HH:mm:ss"),
  },
  {
    accessorKey: "accountAddress",
    header: "Account",
    cell: (row) => {
      const order = row.row.original;
      // Only show if user has multiple accounts
      return (
        <Text className="text-xs">
          {order.accountAddress.slice(0, 12)}...
        </Text>
      );
    },
  },
  {
    accessorKey: "value",
    header: "Amount (BTC)",
    cell: (row) => {
      const order = row.row.original;
      const amountBTC = new BTC("sats", Big(order.value)).convert("BTC");
      return (
        <Text className="font-medium">
          {BTC.format(amountBTC, "BTC")}
        </Text>
      );
    },
  },
  {
    accessorKey: "npoolshare",
    header: "Share Qty",
    cell: (row) => {
      const order = row.row.original;
      return (
        <Text className="font-medium">
          {order.npoolshare?.toLocaleString() || "0"} shares
        </Text>
      );
    },
  },
  {
    accessorKey: "pool_share_price",
    header: "Entry Pool Share Value",
    cell: (row) => {
      const deposit = row.row.original.value;
      const npoolshare = row.row.original.npoolshare;

      if (!deposit || !npoolshare) {
        return <Text className="font-medium">0.00000000 BTC</Text>;
      }

      const shareValue = Big(deposit).div(npoolshare)

      return (
        <Text className="font-medium">
          {shareValue.toFixed(8)}
        </Text>
      );
    },
  },
  {
    accessorKey: "apy",
    header: "APR %",
    cell: (row) => {
      const order = row.row.original;
      return (
        <Text className="font-medium">
          {order.apy?.toFixed(2) || "0.00"}%
        </Text>
      );
    },
  },
  {
    accessorKey: "accrued_rewards",
    header: "Accrued Rew.",
    cell: (row) => {
      const order = row.row.original;
      const meta = row.table.options.meta as LendOrdersTableMeta;

      if (!order.npoolshare || !order.pool_share_price_entry) {
        return <Text className="font-medium">0.00000000 BTC</Text>;
      }

      const currentSharePrice = meta.getPoolSharePrice();
      const entrySharePrice = order.pool_share_price_entry;
      const shareQty = order.npoolshare;

      const accruedRewards = shareQty * (currentSharePrice - entrySharePrice);
      const rewardsBTC = new BTC("sats", Big(Math.max(0, accruedRewards) * 100000000)).convert("BTC");

      return (
        <Text className="font-medium">
          {BTC.format(rewardsBTC, "BTC")}
        </Text>
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
          case "LENDED":
            return "bg-green-medium/10 text-green-medium";
          case "SETTLING":
            return "bg-orange/10 text-orange";
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
  {
    id: "action",
    header: "Action",
    cell: (row) => {
      const order = row.row.original;
      const meta = row.table.options.meta as LendOrdersTableMeta;
      const isSettling = meta.settlingOrderId === order.accountAddress;

      if (order.orderStatus !== "LENDED") {
        return null;
      }

      return (

        <div className="flex space-x-2 justify-start">
          <Button
            size="small"
            onClick={() => meta.settleLendOrder(order)}
            disabled={isSettling || meta.settlingOrderId !== null}
            className="px-3 py-1"
          >
            {isSettling ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Settling...
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
        </div>
      );
    },
  },
]; 