"use client";

import React from 'react';
import { OrderHistoryDataTable } from './data-table';
import { orderHistoryColumns } from './columns';
import { TradeOrder } from '@/lib/types';
import { usePriceFeed } from '@/lib/providers/feed';

interface OrderHistoryTableProps {
  data: TradeOrder[];
}

const OrderHistoryTable = function OrderHistoryTable({ data }: OrderHistoryTableProps) {
  const { getCurrentPrice } = usePriceFeed()

  return (
    <OrderHistoryDataTable
      columns={orderHistoryColumns}
      data={data}
      getCurrentPrice={getCurrentPrice}
    />
  );
}

export default OrderHistoryTable;
