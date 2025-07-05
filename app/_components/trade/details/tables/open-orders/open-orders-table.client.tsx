"use client";

import React from 'react';
import { TradeOrder } from '@/lib/types';
import { openOrdersColumns } from './columns';
import { OpenOrdersDataTable } from './data-table';

interface OpenOrdersTableProps {
  data: TradeOrder[];
  cancelOrder: (order: TradeOrder) => Promise<void>;
}

const OpenOrdersTable = React.memo(function OpenOrdersTable({ data, cancelOrder }: OpenOrdersTableProps) {
  return (
    <OpenOrdersDataTable
      columns={openOrdersColumns}
      data={data}
      cancelOrder={cancelOrder}
    />

  );
});

export default OpenOrdersTable;
