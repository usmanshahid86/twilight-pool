"use client";

import cn from "@/lib/cn";
import { useUserTrades } from '@/lib/hooks/useUserTrades';
import { usePriceFeed } from '@/lib/providers/feed';
import { useSessionStore } from '@/lib/providers/session';
import { TradeOrder } from '@/lib/types';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const calculateUpnl = (entryPrice: number, currentPrice: number, positionType: string, positionSize: number) => {
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

export function TradeHistoryDataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  // Use both the live price feed and the session store btcPrice as fallback
  const { feed } = usePriceFeed();
  const btcPrice = useSessionStore((state) => state.price.btcPrice);

  // Prioritize live feed price over stored price, following the same pattern as other components
  const liveFeedPrice = feed.length > 1 ? feed[feed.length - 1] : 0;
  const currentPrice = liveFeedPrice || btcPrice;

  const zkTrades = data as TradeOrder[];

  const {
    data: userTrades,
  } = useUserTrades(zkTrades.map((item) => item.accountAddress))

  const userData = useMemo(() => {
    return zkTrades.map((item) => {
      const address = item.accountAddress
      const userCurrentTrades = userTrades?.[address];

      let orderStatus = item.orderStatus;
      if (userCurrentTrades) {
        const userTrade = userCurrentTrades.find((trade) => trade.account_id === item.accountAddress);

        orderStatus = userTrade?.order_status || item.orderStatus;
      }

      const unrealizedPnl = calculateUpnl(item.entryPrice, currentPrice, item.positionType, item.value);
      console.log("unrealizedPnl", unrealizedPnl)
      return {
        ...item,
        orderStatus,
        unrealizedPnl,
      }
    })
  }, [zkTrades, userTrades, currentPrice]);

  const table = useReactTable({
    data: userData as TData[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      sorting: sorting,
    },
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full px-3">
      <table cellSpacing={0} className="relative w-full overflow-auto">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              className="text-xs font-normal text-primary-accent"
              key={headerGroup.id}
            >
              {headerGroup.headers.map((header, index) => {
                return (
                  <th
                    className={cn(index === 0 ? "text-start" : "text-end")}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <tr
                className="cursor-pointer text-xs hover:bg-theme/20 data-[state=selected]:bg-theme"
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell, index) => (
                  <td
                    className={cn(index === 0 ? `text-start` : "text-end")}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="h-24 text-center">
                No results.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
