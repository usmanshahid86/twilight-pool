"use client";

import React from 'react';
import { PositionsDataTable } from './data-table';
import { positionsColumns } from './columns';
import { TradeOrder } from '@/lib/types';
import { useLimitDialog } from '@/lib/providers/limit-dialogs';
import { usePriceFeed } from '@/lib/providers/feed';

interface PositionsTableProps {
  data: TradeOrder[];
  settleMarketOrder: (trade: TradeOrder, currentPrice: number) => Promise<void>;
}

const PositionsTable = React.memo(function PositionsTable({ data, settleMarketOrder }: PositionsTableProps) {
  const { openLimitDialog } = useLimitDialog();

  const { getCurrentPrice } = usePriceFeed()
  return (
    <PositionsDataTable
      columns={positionsColumns}
      data={data}
      getCurrentPrice={getCurrentPrice}
      settleMarketOrder={settleMarketOrder}
      openLimitDialog={openLimitDialog}
    />

  );
});

export default PositionsTable;
