"use client";

import cn from "@/lib/cn";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function MyTradesDataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    autoResetPageIndex: false,
    autoResetExpanded: false,
  });

  return (
    <div className="w-full">
      <table cellSpacing={0} className="relative w-full overflow-auto">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              className="border-b border-primary-accent/10 text-xs font-normal text-primary-accent"
              key={headerGroup.id}
            >
              {headerGroup.headers.map((header, index) => {
                return (
                  <th
                    className={cn(
                      "font-medium",
                      index === 0 ? "text-start" : "text-end"
                    )}
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
                className="border-b border-primary-accent/5 text-xs transition-colors hover:bg-theme/20"
                key={row.id}
              >
                {row.getVisibleCells().map((cell, index) => (
                  <td
                    className={cn(
                      index === 0 ? "text-start" : "text-end"
                    )}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="h-24 text-center text-primary-accent/50"
              >
                No active trades
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
