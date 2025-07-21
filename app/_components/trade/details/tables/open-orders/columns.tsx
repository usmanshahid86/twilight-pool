
import Button from '@/components/button';
import cn from '@/lib/cn';
import { capitaliseFirstLetter } from '@/lib/helpers';
import BTC from '@/lib/twilight/denoms';
import { TradeOrder } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import Big from 'big.js';
import dayjs from 'dayjs';

interface OpenOrdersTableMeta {
  cancelOrder: (order: TradeOrder) => Promise<void>;
}

export const openOrdersColumns: ColumnDef<TradeOrder, any>[] = [
  {
    accessorKey: "date",
    header: "Time",
    accessorFn: (row) => dayjs(row.date).format("DD/MM/YYYY HH:mm:ss"),
  },
  {
    accessorKey: "uuid",
    header: "Order ID",
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
    accessorKey: "orderType",
    header: "Type",
    cell: (row) => {
      const orderType = row.getValue() as string;
      return (
        <span className="px-2 py-1 rounded text-xs font-medium">
          {capitaliseFirstLetter(orderType)}
        </span>
      );
    },
  },
  {
    accessorKey: "entryPrice",
    header: "Entry Price (USD)",
    accessorFn: (row) => `$${row.entryPrice.toFixed(2)}`,
  },
  {
    accessorKey: "leverage",
    header: "Leverage",
    accessorFn: (row) => `${row.leverage.toFixed(2)}x`
  },
  {
    accessorKey: "availableMargin",
    header: "Avail. Margin (BTC)",
    accessorFn: (row) => BTC.format(new BTC("sats", Big(row.availableMargin)).convert("BTC"), "BTC")
  },
  {
    accessorKey: "actions",
    header: "Action",
    cell: (row) => {
      const trade = row.row.original;
      const meta = row.table.options.meta as OpenOrdersTableMeta;

      return (
        <div className="flex flex-row gap-1 justify-start">
          <Button
            onClick={async (e) => {
              e.preventDefault();
              await meta.cancelOrder(trade)

            }}
            variant="ui"
            size="small"
          >
            Cancel
          </Button>
        </div>
      );
    },
  },
]

// Export the TableMeta type for use in the data table component
export type { OpenOrdersTableMeta };