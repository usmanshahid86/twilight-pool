"use client";

import React from "react";
import { LendOrdersDataTable } from "./data-table";
import { lendOrdersColumns } from "./columns";
import { LendOrder } from "@/lib/types";

interface Props {
  data: LendOrder[];
  getCurrentPrice: () => number;
  getPoolSharePrice: () => number;
  settleLendOrder: (order: LendOrder) => Promise<void>;
}

const LendOrdersTable = ({
  data,
  getCurrentPrice,
  getPoolSharePrice,
  settleLendOrder
}: Props) => {
  return (
    <LendOrdersDataTable
      columns={lendOrdersColumns}
      data={data}
      getCurrentPrice={getCurrentPrice}
      getPoolSharePrice={getPoolSharePrice}
      settleLendOrder={settleLendOrder}
    />
  );
};

export default LendOrdersTable; 