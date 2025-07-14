"use client";

import PoolInfo from "@/app/_components/lend/pool-info.client";
import ApyChart from "@/app/_components/lend/apy-chart.client";
import MyInvestment from "@/app/_components/lend/my-investment.client";
import LendManagement from "@/app/_components/lend/lend-management.client";
import LendOrdersTable from "@/app/_components/trade/details/tables/lend-orders/lend-orders-table.client";
import LendHistoryTable from "@/app/_components/trade/details/tables/lend-history/lend-history-table.client";
import Button from "@/components/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import { Text } from "@/components/typography";
import { Separator } from "@/components/seperator";
import { executeLendOrder } from "@/lib/api/client";
import { queryTransactionHashByRequestId, queryTransactionHashes } from "@/lib/api/rest";
import { retry } from "@/lib/helpers";
import useRedirectUnconnected from "@/lib/hooks/useRedirectUnconnected";
import { useToast } from "@/lib/hooks/useToast";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import { executeTradeLendOrderMsg } from "@/lib/twilight/zkos";
import { WalletStatus } from "@cosmos-kit/core";
import { useWallet } from "@cosmos-kit/react-lite";
import { Loader2 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { LendOrder } from "@/lib/types";

type TabType = "active-orders" | "lend-history";

const Page = () => {
  useRedirectUnconnected();

  const { toast } = useToast();
  const { status } = useWallet();

  const [currentTab, setCurrentTab] = useState<TabType>("active-orders");
  const [isSettleLoading, setIsSettleLoading] = useState(false);
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  const currentPrice = useSessionStore((state) => state.price.btcPrice);
  const privateKey = useSessionStore((state) => state.privateKey);
  const lendOrders = useTwilightStore((state) => state.lend.lends);
  const poolInfo = useTwilightStore((state) => state.lend.poolInfo);
  const zKAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);
  const removeLend = useTwilightStore((state) => state.lend.removeLend);
  const addTransactionHistory = useTwilightStore(
    (state) => state.history.addTransaction
  );

  // Filter lend orders for active vs history
  const activeLendOrders = useMemo(() => {
    return lendOrders.filter(order => order.orderStatus === "LENDED");
  }, [lendOrders]);

  const lendHistory = useMemo(() => {
    return lendOrders.filter(order => order.orderStatus !== "LENDED");
  }, [lendOrders]);

  const getCurrentPrice = () => currentPrice || 0;

  const getPoolSharePrice = () => poolInfo?.pool_share_price || 0;

  async function settleLendOrder(order: LendOrder) {
    try {
      toast({
        title: "Settling lend order",
        description: "Please do not close this page until the lend order is settled...",
      })

      setIsSettleLoading(true);
      setSettlingOrderId(order.accountAddress); // Use accountAddress as unique identifier

      const lendOrderRes = await retry<
        ReturnType<typeof queryTransactionHashes>,
        string
      >(
        queryTransactionHashes,
        9,
        order.accountAddress,
        2500,
        (txHash) => {
          const found = txHash.result.find(
            (tx) => tx.order_status === "FILLED"
          );

          return found ? true : false;
        }
      );

      if (!lendOrderRes.success) {
        console.error("lend order settle not successful");
        setIsSettleLoading(false);
        setSettlingOrderId(null);
        return;
      }

      const lendOrders = lendOrderRes.data;

      const lendOrderData = lendOrders.result.find(
        (tx) => tx.order_status === "FILLED"
      );

      if (!lendOrderData) {
        setIsSettleLoading(false);
        setSettlingOrderId(null);
        return;
      }

      const msg = await executeTradeLendOrderMsg({
        outputMemo: lendOrderData.output,
        signature: privateKey,
        address: lendOrderData.account_id,
        uuid: lendOrderData.order_id,
        orderStatus: lendOrderData.order_status,
        orderType: lendOrderData.order_type,
        transactionType: "LENDTX",
        executionPricePoolshare: 1,
      });

      const executeLendRes = await executeLendOrder(msg);
      console.log("executeLendRes", executeLendRes);

      const requestId = executeLendRes.result.id_key;

      const requestIdRes = await retry<
        ReturnType<typeof queryTransactionHashes>,
        string
      >(
        queryTransactionHashByRequestId,
        9,
        requestId,
        2500,
        (txHash) => {
          const found = txHash.result.find(
            (tx) => tx.order_status === "SETTLED"
          );

          return found ? true : false;
        }
      );

      if (!requestIdRes.success) {
        console.error("lend order settle not successful");
        setIsSettleLoading(false);
        setSettlingOrderId(null);
        return;
      }

      const requestIdData = requestIdRes.data.result.find(
        (tx) => tx.order_status === "SETTLED"
      );

      const tx_hash = requestIdData?.tx_hash;

      console.log("requestIdData", requestIdData);

      removeLend(order);

      const selectedZkAccount = zKAccounts.find(
        (account) => account.address === order.accountAddress
      );

      if (!selectedZkAccount) {
        console.error("selectedZkAccount not found");
        setIsSettleLoading(false);
        setSettlingOrderId(null);
        return;
      }

      addTransactionHistory({
        date: new Date(),
        from: selectedZkAccount?.address || "",
        fromTag: selectedZkAccount?.tag || "",
        to: order.accountAddress,
        toTag: selectedZkAccount?.tag || "",
        tx_hash: tx_hash || "",
        type: "Settle Lend",
        value: order.value,
      });

      setIsSettleLoading(false);
      setSettlingOrderId(null);

      toast({
        title: "Success",
        description: "Settled lend order successfully",
      });

      updateZkAccount(selectedZkAccount.address, {
        ...selectedZkAccount,
        type: "CoinSettled",
      });

    } catch (err) {
      setIsSettleLoading(false);
      setSettlingOrderId(null);
      console.error(err);
      toast({
        variant: "error",
        title: "Error",
        description: "An error has occurred settling lend order, try again later.",
      });
    }
  }

  function renderTableContent() {
    switch (currentTab) {
      case "active-orders":
        return (
          <LendOrdersTable
            data={activeLendOrders}
            getCurrentPrice={getCurrentPrice}
            getPoolSharePrice={getPoolSharePrice}
            settleLendOrder={settleLendOrder}
            settlingOrderId={settlingOrderId}
          />
        );
      case "lend-history":
        return (
          <LendHistoryTable
            data={lendHistory}
            getCurrentPrice={getCurrentPrice}
          />
        );
    }
  }

  return (
    <div className="mx-8 mt-4 space-y-6 md:space-y-8">
      {/* Pool Info */}
      <div className="rounded-lg bg-card border border-outline p-4 md:p-6">
        <Text heading="h2" className="mb-4 text-lg font-medium">
          Pool Info
        </Text>
        <PoolInfo />
      </div>

      {/* APY Chart and Add Liquidity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* APY Chart */}
        <div className="rounded-lg bg-card border border-outline p-4 md:p-6">
          <Text heading="h2" className="mb-4 text-lg font-medium">
            APY Chart
          </Text>
          <ApyChart />
        </div>

        <div className="rounded-lg bg-card border border-outline p-4 md:p-6">
          <Text heading="h2" className="mb-4 text-lg font-medium">
            Add Liquidity
          </Text>
          <div className="space-y-4">
            <LendManagement />
            <div className="text-sm text-primary-accent">
              <p>Deposit BTC to earn yield from trading fees and lending rewards.</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Investment */}
      <div className="rounded-lg bg-card border border-outline p-4 md:p-6">
        <MyInvestment />
      </div>

      <Separator />

      {/* Active Orders / Lend History */}
      <div className="space-y-4">
        <div className="flex w-full items-center border-b">
          <Tabs defaultValue={currentTab}>
            <TabsList className="flex w-full border-b-0" variant="underline">
              <TabsTrigger
                onClick={() => setCurrentTab("active-orders")}
                value="active-orders"
                variant="underline"
              >
                Active Orders
              </TabsTrigger>
              <TabsTrigger
                onClick={() => setCurrentTab("lend-history")}
                value="lend-history"
                variant="underline"
              >
                Lend History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          {renderTableContent()}
        </div>
      </div>
    </div>
  );
};

export default Page;
