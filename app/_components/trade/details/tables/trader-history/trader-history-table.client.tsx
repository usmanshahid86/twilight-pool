"use client";

import React from 'react';
import { TraderHistoryDataTable } from './data-table';
import { traderHistoryColumns } from './columns';
import { TradeOrder } from '@/lib/types';
import { usePriceFeed } from '@/lib/providers/feed';

interface TraderHistoryTableProps {
  data: TradeOrder[];
}

const TraderHistoryTable = React.memo(function TraderHistoryTable({ data }: TraderHistoryTableProps) {
  const { getCurrentPrice } = usePriceFeed()

  return (
    <TraderHistoryDataTable
      columns={traderHistoryColumns}
      data={data}
      getCurrentPrice={getCurrentPrice}
    />
  );
});

export default TraderHistoryTable;
