import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import React, { useState } from "react";
import { TradeHistoryDataTable } from "./trade-history/data-table";
import { tradeHistoryColumns } from "./trade-history/columns";
import { useSessionStore } from "@/lib/providers/session";
import OrderMyTrades from "../orderbook/my-trades.client";
import { useTwilightStore } from '@/lib/providers/store';

const DetailsPanel = () => {
  const [currentTab, setCurrentTab] = useState<"history" | "trades">("trades");

  const trade = useTwilightStore((state) => state.trade.trades);

  function RenderTabs() {
    switch (currentTab) {
      case "history": {
        return (
          <TradeHistoryDataTable columns={tradeHistoryColumns} data={trade} />
        );
      }
      case "trades": {
        return <OrderMyTrades />;
      }
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 flex w-full items-center border-b bg-background pl-3 py-2">
        <Tabs defaultValue={currentTab}>
          <TabsList className="flex w-full border-b-0" variant="underline">
            <TabsTrigger
              onClick={() => setCurrentTab("trades")}
              value={"trades"}
              variant="underline"
            >
              My Trades
            </TabsTrigger>
            <TabsTrigger
              onClick={() => setCurrentTab("history")}
              value={"history"}
              variant="underline"
            >
              Trade History
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 px-2 pb-2">
        <RenderTabs />
      </div>
    </div>
  );
};

export default DetailsPanel;
