"use client";

import Button from "@/components/button";
import BTC from "@/lib/twilight/denoms";
import { ZkAccount } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import Big from "big.js";
import dayjs from "dayjs";
import { truncateHash } from '@/lib/helpers';
import { AccountSummaryTableMeta } from './data-table';

export const accountSummaryColumns: ColumnDef<ZkAccount, any>[] = [
  {
    accessorKey: "createdAt",
    header: "Created",
    accessorFn: (row) => row.createdAt ? dayjs.unix(row.createdAt).format("DD/MM/YYYY HH:mm:ss") : "",
  },
  {
    accessorKey: "tag",
    header: "Account Tag",
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: (row) => (
      <Button onClick={(e) => {
        const meta = row.table.options.meta as AccountSummaryTableMeta;
        e.preventDefault();
        meta.toast({
          title: "Copied to clipboard",
          description: `${row.row.original.tag} address copied to clipboard`,
        })
        navigator.clipboard.writeText(row.getValue());
      }} variant="link">
        {truncateHash(row.getValue() as string)}
      </Button>
    )
  },
  {
    accessorKey: "value",
    header: "Balance (BTC)",
    accessorFn: (row) =>
      new BTC("sats", Big(row.value || 0)).convert("BTC").toFixed(8)
  },
  {
    accessorKey: "type",
    header: "Type",
  },
];
