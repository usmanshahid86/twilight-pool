"use client";

import React from "react";
import { LendHistoryDataTable } from "./data-table";
import { lendHistoryColumns } from "./columns";
import { LendOrder } from "@/lib/types";

interface Props {
  data: LendOrder[];
  getCurrentPrice: () => number;
}

const LendHistoryTable = ({
  data,
  getCurrentPrice
}: Props) => {
  return (
    <LendHistoryDataTable
      columns={lendHistoryColumns}
      data={data}
      getCurrentPrice={getCurrentPrice}
    />
  );
};

export default LendHistoryTable; 