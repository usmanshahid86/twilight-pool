"use client";

import React from "react";
import { LendHistoryDataTable } from "./data-table";
import { lendHistoryColumns } from "./columns";
import { LendOrder } from "@/lib/types";

type LendOrderWithAccountTag = LendOrder & { accountTag: string };

interface Props {
  data: LendOrderWithAccountTag[];
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