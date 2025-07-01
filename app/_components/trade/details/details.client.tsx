import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import React, { useState, useMemo } from "react";
import { TradeHistoryDataTable } from "./trade-history/data-table";
import { tradeHistoryColumns } from "./trade-history/columns";
import OrderMyTrades from "../orderbook/my-trades.client";
import { useTwilightStore } from '@/lib/providers/store';
import { usePriceFeed } from "@/lib/providers/feed";
import { calculateUpnl } from "../orderbook/my-trades/columns";
import dayjs from 'dayjs';

const DetailsPanel = () => {
  const [currentTab, setCurrentTab] = useState<"history" | "trades">("trades");

  const { getCurrentPrice } = usePriceFeed();
  const tradeOrders = useTwilightStore((state) => state.trade.trades);

  // Get the current price from the feed
  const currentPrice = getCurrentPrice();

  const tradeHistoryData = useMemo(() => {
    return tradeOrders.length > 1
      ? [...tradeOrders].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
      : tradeOrders
        .map((trade) => {
          let calculatedUnrealizedPnl: number | undefined;

          if (trade.orderStatus === "SETTLED") {
            calculatedUnrealizedPnl = trade.realizedPnl || trade.unrealizedPnl;
          }
          else {
            const positionSize = trade.positionSize;
            calculatedUnrealizedPnl = calculateUpnl(trade.entryPrice, currentPrice || trade.entryPrice, trade.positionType, positionSize);
          }

          return {
            ...trade,
            currentPrice: trade.settlementPrice || currentPrice,
            unrealizedPnl: calculatedUnrealizedPnl || trade.realizedPnl || trade.unrealizedPnl,
          };
        });
  }, [tradeOrders, currentPrice]);

  function RenderTabs() {
    switch (currentTab) {
      case "history": {
        return (
          <TradeHistoryDataTable columns={tradeHistoryColumns} data={tradeHistoryData} />
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
              Order History
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
