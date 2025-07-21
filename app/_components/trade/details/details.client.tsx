import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import React, { useState, useMemo, useCallback } from "react";
import OrderMyTrades from "../orderbook/my-trades.client";
import { useTwilightStore } from '@/lib/providers/store';
import PositionsTable from './tables/positions/positions-table.client';
import { useSessionStore } from '@/lib/providers/session';
import { useToast } from '@/lib/hooks/useToast';
import { TradeOrder } from '@/lib/types';
import { cancelZkOrder, settleOrder } from '@/lib/zk/trade';
import Link from 'next/link';
import Big from 'big.js';
import dayjs from 'dayjs';
import OpenOrdersTable from './tables/open-orders/open-orders-table.client';
import TraderHistoryTable from './tables/trader-history/trader-history-table.client';
import OrderHistoryTable from './tables/order-history/order-history-table.client';

type TabType = "history" | "trades" | "positions" | "open-orders" | "trader-history";

const DetailsPanel = () => {
  const [currentTab, setCurrentTab] = useState<TabType>("positions");

  const tradeOrders = useTwilightStore((state) => state.trade.trades);

  const orderHistoryData = useTwilightStore((state) => state.trade_history.trades);
  const privateKey = useSessionStore((state) => state.privateKey);

  const updateTrade = useTwilightStore((state) => state.trade.updateTrade)
  const removeTrade = useTwilightStore((state) => state.trade.removeTrade)
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount)
  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);

  const addTradeHistory = useTwilightStore((state) => state.trade_history.addTrade)

  const positionsData = useMemo(() => {
    return tradeOrders.filter((trade) => trade.orderStatus === "FILLED")
  }, [tradeOrders])

  const openOrdersData = useMemo(() => {
    return tradeOrders.filter((trade) => trade.orderStatus === "PENDING")
  }, [tradeOrders])

  const traderHistoryData = useMemo(() => {
    return orderHistoryData.filter((trade) => trade.orderStatus === "SETTLED" || trade.orderStatus === "LIQUIDATED" || trade.orderStatus === "FILLED")
  }, [orderHistoryData])

  const {
    toast,
  } = useToast()

  const settleMarketOrder = useCallback(async (trade: TradeOrder, currentPrice: number) => {
    toast({
      title: "Closing position",
      description: "Please do not close this page while your position is being closed...",
    })

    const settleOrderResult = await settleOrder(trade, "market", privateKey, currentPrice);

    if (!settleOrderResult.success) {
      toast({
        title: "Failed to settle position",
        description: settleOrderResult.message,
        variant: "error",
      })
      return;
    }

    const settledData = settleOrderResult.data;
    console.log(`settledData`, settledData)

    const updatedTrade = {
      ...trade,
      orderStatus: settledData.order_status,
      availableMargin: Big(settledData.available_margin).toNumber(),
      maintenanceMargin: Big(settledData.maintenance_margin).toNumber(),
      unrealizedPnl: Big(settledData.unrealized_pnl).toNumber(),
      settlementPrice: Big(settledData.settlement_price).toNumber(),
      positionSize: Big(settledData.positionsize).toNumber(),
      orderType: settledData.order_type,
      date: dayjs(settledData.timestamp).toDate(),
      exit_nonce: settledData.exit_nonce,
      executionPrice: Big(settledData.execution_price).toNumber(),
      isOpen: false,
      feeSettled: Big(settledData.fee_settled).toNumber(),
      feeFilled: Big(settledData.fee_filled).toNumber(),
      realizedPnl: Big(settledData.unrealized_pnl).toNumber(),
      tx_hash: settledData.tx_hash || trade.tx_hash,
    }

    updateTrade(updatedTrade)

    if (updatedTrade.orderStatus === "SETTLED") {
      addTradeHistory(updatedTrade)
    }

    const updatedAccount = zkAccounts.find(account => account.address === trade.accountAddress);

    const balance = Big(settledData.available_margin).toNumber();

    if (!updatedAccount) {
      toast({
        title: "Failed to settle position",
        description: "Failed to find account",
        variant: "error",
      })
      return;
    }

    updateZkAccount(trade.accountAddress, {
      ...updatedAccount,
      type: "CoinSettled",
      value: balance || trade.value,
    });

    toast({
      title: "Position closed",
      description: <div className="opacity-90">
        Successfully closed {trade.orderType.toLowerCase()} order.{" "}
        {
          settledData.tx_hash && (
            <Link
              href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/${settledData.tx_hash}`}
              target={"_blank"}
              className="text-sm underline hover:opacity-100"
            >
              Explorer link
            </Link>
          )
        }
      </div>
    })

  }, [privateKey])

  const cancelOrder = useCallback(async (order: TradeOrder) => {
    toast({
      title: "Cancelling order",
      description: "Please do not close this page while your order is being cancelled...",
    })

    const cancelOrderResult = await cancelZkOrder(order, privateKey);

    if (!cancelOrderResult.success) {
      toast({
        title: "Failed to cancel order",
        description: cancelOrderResult.message,
        variant: "error",
      })
      return;
    }

    const cancelOrderData = cancelOrderResult.data;

    toast({
      title: "Order cancelled",
      description: <div className="opacity-90">
        Successfully cancelled {order.orderType.toLowerCase()} order.{" "}
        {
          cancelOrderResult.data.tx_hash && (
            <Link
              href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/${cancelOrderResult.data.tx_hash}`}
              target={"_blank"}
              className="text-sm underline hover:opacity-100"
            >
              Explorer link
            </Link>
          )
        }
      </div>
    })


    removeTrade(order);

    const updatedAccount = zkAccounts.find(account => account.address === order.accountAddress);

    if (!updatedAccount) {
      toast({
        title: "Failed to cancel order",
        description: "Failed to find account",
        variant: "error",
      })
      return;
    }

    addTradeHistory({
      ...order,
      orderStatus: cancelOrderData.order_status,
      availableMargin: Big(cancelOrderData.available_margin).toNumber(),
      maintenanceMargin: Big(cancelOrderData.maintenance_margin).toNumber(),
      unrealizedPnl: Big(cancelOrderData.unrealized_pnl).toNumber(),
      settlementPrice: Big(cancelOrderData.settlement_price).toNumber(),
      positionSize: Big(cancelOrderData.positionsize).toNumber(),
      orderType: cancelOrderData.order_type,
      date: dayjs(cancelOrderData.timestamp).toDate(),
      exit_nonce: cancelOrderData.exit_nonce,
      executionPrice: Big(cancelOrderData.execution_price).toNumber(),
      isOpen: false,
      feeSettled: Big(cancelOrderData.fee_settled).toNumber(),
      feeFilled: Big(cancelOrderData.fee_filled).toNumber(),
      realizedPnl: Big(cancelOrderData.unrealized_pnl).toNumber(),
      tx_hash: cancelOrderData.tx_hash || order.tx_hash,
    })

    updateZkAccount(order.accountAddress, {
      ...updatedAccount,
      type: "Coin",
    });

  }, [privateKey])

  function RenderTabs() {
    switch (currentTab) {
      case "positions": {
        return <PositionsTable
          data={positionsData}
          settleMarketOrder={settleMarketOrder}
        />;
      }
      case "open-orders": {
        return <OpenOrdersTable
          data={openOrdersData}
          cancelOrder={cancelOrder}
        />
      }
      case "trader-history": {
        return <TraderHistoryTable
          data={traderHistoryData}
        />;
      }
      case "history": {
        return <OrderHistoryTable
          data={orderHistoryData}
        />;
      }
      case "trades": {
        // return <OrderMyTrades />;
        return <></>
      }
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="sticky top-0 z-10 flex w-full items-center border-b bg-background pl-3 pt-2">
        <Tabs defaultValue={currentTab}>
          <TabsList className="flex w-full border-b-0" variant="underline">
            <TabsTrigger
              onClick={() => setCurrentTab("positions")}
              value={"positions"}
              variant="underline"
            >
              Positions
            </TabsTrigger>
            <TabsTrigger
              onClick={() => setCurrentTab("open-orders")}
              value={"open-orders"}
              variant="underline"
            >
              Open Orders
            </TabsTrigger>
            <TabsTrigger
              onClick={() => setCurrentTab("trader-history")}
              value={"trader-history"}
              variant="underline"
            >
              Trader History
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
      <div className="flex-1 px-2 pb-2 overflow-auto">
        <RenderTabs />
      </div>
    </div>
  );
};

export default DetailsPanel;
