import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import React, { useState, useMemo, useCallback } from "react";
import OrderMyTrades from "../orderbook/my-trades.client";
import { useTwilightStore } from '@/lib/providers/store';
import PositionsTable from './tables/positions/positions-table.client';
import { useSessionStore } from '@/lib/providers/session';
import { useToast } from '@/lib/hooks/useToast';
import { TradeOrder, ZkAccount } from '@/lib/types';
import { cancelZkOrder, settleOrder } from '@/lib/zk/trade';
import Link from 'next/link';
import Big from 'big.js';
import dayjs from 'dayjs';
import OpenOrdersTable from './tables/open-orders/open-orders-table.client';
import TraderHistoryTable from './tables/trader-history/trader-history-table.client';
import OrderHistoryTable from './tables/order-history/order-history-table.client';
import { useWallet } from '@cosmos-kit/react-lite';
import { createZkAccount, createZkBurnTx } from '@/lib/twilight/zk';
import { ZkPrivateAccount } from '@/lib/zk/account';
import { verifyAccount, verifyQuisQuisTransaction } from '@/lib/twilight/zkos';
import { broadcastTradingTx } from '@/lib/api/zkos';
import { safeJSONParse } from '@/lib/helpers';
import { twilightproject } from 'twilightjs';
import Long from 'long';
import BTC from '@/lib/twilight/denoms';

type TabType = "history" | "trades" | "positions" | "open-orders" | "trader-history";

const DetailsPanel = () => {
  const [currentTab, setCurrentTab] = useState<TabType>("positions");

  const tradeOrders = useTwilightStore((state) => state.trade.trades);

  const orderHistoryData = useTwilightStore((state) => state.trade_history.trades);
  const privateKey = useSessionStore((state) => state.privateKey);

  const updateTrade = useTwilightStore((state) => state.trade.updateTrade)
  const removeTrade = useTwilightStore((state) => state.trade.removeTrade)

  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount)
  const removeZkAccount = useTwilightStore((state) => state.zk.removeZkAccount);

  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);

  const addTradeHistory = useTwilightStore((state) => state.trade_history.addTrade)

  const addTransactionHistory = useTwilightStore(
    (state) => state.history.addTransaction
  );

  const positionsData = useMemo(() => {
    return tradeOrders.filter((trade) => trade.orderStatus === "FILLED")
  }, [tradeOrders])

  const openOrdersData = useMemo(() => {
    return tradeOrders.filter((trade) => trade.orderStatus === "PENDING")
  }, [tradeOrders])

  const traderHistoryData = useMemo(() => {
    return orderHistoryData.filter((trade) => trade.orderStatus === "SETTLED" || trade.orderStatus === "LIQUIDATE" || trade.orderStatus === "FILLED")
  }, [orderHistoryData])

  const {
    toast,
  } = useToast()

  const { mainWallet } = useWallet();

  const chainWallet = mainWallet?.getChainWallet("nyks");
  const twilightAddress = chainWallet?.address


  const cleanupTradeOrder = useCallback(async (privateKey: string, zkAccount: ZkAccount) => {
    if (!twilightAddress) {
      return {
        success: false,
        message: "Twilight address not found",
      }
    }

    if (!zkAccount.value) {
      return {
        success: false,
        message: "ZkAccount does not have a value",
      }
    }

    const transientZkAccount = await createZkAccount({
      tag: Math.random().toString(36).substring(2, 15),
      signature: privateKey,
    });

    const senderZkPrivateAccount = await ZkPrivateAccount.create({
      signature: privateKey,
      existingAccount: zkAccount,
    });

    console.log("senderZkPrivateAccount", senderZkPrivateAccount.get());

    const privateTxSingleResult =
      await senderZkPrivateAccount.privateTxSingle(
        zkAccount.value,
        transientZkAccount.address
      );

    if (!privateTxSingleResult.success) {
      return {
        success: false,
        message: privateTxSingleResult.message,
      }
    }

    const {
      scalar: updatedTransientScalar,
      txId,
      updatedAddress: updatedTransientAddress,
    } = privateTxSingleResult.data;

    console.log("txId", txId, "updatedAddess", updatedTransientAddress);

    console.log(
      "transient zkAccount balance =",
      zkAccount.value,
    );

    const {
      success,
      msg: zkBurnMsg,
      zkAccountHex,
    } = await createZkBurnTx({
      signature: privateKey,
      zkAccount: {
        tag: zkAccount.tag,
        address: updatedTransientAddress,
        scalar: updatedTransientScalar,
        isOnChain: true,
        value: zkAccount.value,
        type: "Coin",
      },
      initZkAccountAddress: transientZkAccount.address,
    });

    if (!success || !zkBurnMsg || !zkAccountHex) {
      return {
        success: false,
        message: "Error creating zkBurnTx msg",
      }
    }

    console.log({
      zkAccountHex: zkAccountHex,
      balance: zkAccount.value,
      signature: privateKey,
      initZkAccountAddress: transientZkAccount.address,
    });

    const isAccountValid = await verifyAccount({
      zkAccountHex: zkAccountHex,
      balance: zkAccount.value,
      signature: privateKey,
    });

    console.log("isAccountValid", isAccountValid);

    toast({
      title: "Broadcasting transfer",
      description:
        "Please do not close this page while your BTC is being transferred to your funding account...",
    });

    const txValidMessage = await verifyQuisQuisTransaction({
      tx: zkBurnMsg,
    });

    console.log("txValidMessage", txValidMessage);

    const tradingTxResString = await broadcastTradingTx(
      zkBurnMsg,
      twilightAddress
    );

    console.log("zkBurnMsg tradingTxResString >>"), tradingTxResString;

    const tradingTxRes = safeJSONParse(tradingTxResString as string);

    if (!tradingTxRes.success || Object.hasOwn(tradingTxRes, "error")) {
      toast({
        variant: "error",
        title: "An error has occurred",
        description: "Please try again later.",
      });
      console.error("error broadcasting zkBurnTx msg", tradingTxRes);
      return {
        success: false,
        message: "Error broadcasting zkBurnTx msg",
      }
    }

    console.log("tradingTxRes", tradingTxRes);

    const { mintBurnTradingBtc } =
      twilightproject.nyks.zkos.MessageComposer.withTypeUrl;

    const stargateClient = await chainWallet.getSigningStargateClient();

    console.log({
      btcValue: Long.fromNumber(zkAccount.value),
      encryptScalar: updatedTransientScalar,
      mintOrBurn: false,
      qqAccount: zkAccountHex,
      twilightAddress,
    });

    const mintBurnMsg = mintBurnTradingBtc({
      btcValue: Long.fromNumber(zkAccount.value),
      encryptScalar: updatedTransientScalar,
      mintOrBurn: false,
      qqAccount: zkAccountHex,
      twilightAddress,
    });

    console.log("mintBurnMsg", mintBurnMsg);
    const mintBurnRes = await stargateClient.signAndBroadcast(
      twilightAddress,
      [mintBurnMsg],
      "auto"
    );

    addTransactionHistory({
      date: new Date(),
      from: zkAccount.address,
      fromTag: zkAccount.tag,
      to: twilightAddress,
      toTag: "Funding",
      tx_hash: mintBurnRes.transactionHash,
      type: "Burn",
      value: zkAccount.value,
    });

    removeZkAccount(zkAccount);

    toast({
      title: "Success",
      description: (
        <div className="opacity-90">
          {`Successfully sent ${new BTC("sats", Big(zkAccount.value))
            .convert("BTC")
            .toString()} BTC to Funding Account. `}
          <Link
            href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/${mintBurnRes.transactionHash}`}
            target={"_blank"}
            className="text-sm underline hover:opacity-100"
          >
            Explorer link
          </Link>
        </div>
      ),
    });

    return {
      success: true,
    }

  }, [toast, zkAccounts, privateKey, updateTrade, removeZkAccount]);

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

    toast({
      title: "Order settled successfully",
      description: "Please do not close this page while your balance is being updated...",
    })

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

    const balance = Math.round(Big(settledData.available_margin).toNumber())

    if (!updatedAccount) {
      toast({
        title: "Failed to settle position",
        description: "Failed to find account",
        variant: "error",
      })
      return;
    }

    console.log("newBalance", balance || trade.value)

    // update the account balance in case cleanup fails
    updateZkAccount(trade.accountAddress, {
      ...updatedAccount,
      type: "CoinSettled",
      value: balance || trade.value,
    });

    const result = await cleanupTradeOrder(privateKey, {
      ...updatedAccount,
      value: balance || trade.value,
    });

    if (!result.success) {
      toast({
        title: "Failed to update balance",
        description: "Please manually transfer your balance to your funding account in the wallet page",
        variant: "error",
      })
      return;
    }

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

  }, [privateKey, zkAccounts])

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

    const zkAccount = zkAccounts.find(account => account.address === order.accountAddress);

    if (!zkAccount) {
      toast({
        title: "Failed to cancel order",
        description: "Failed to find account",
        variant: "error",
      })
      return;
    }
    const result = await cleanupTradeOrder(privateKey, zkAccount);

    if (!result.success) {
      toast({
        title: "Error with settling trade order",
        description: result.message,
        variant: "error",
      })
      return;
    }

    toast({
      title: "Order cancelled",
      description: <div className="opacity-90">
        Successfully cancelled {order.orderType.toLowerCase()} order.{" "}
        {
          cancelOrderData.tx_hash && (
            <Link
              href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/${cancelOrderData.tx_hash}`}
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

    // addTradeHistory({
    //   ...order,
    //   orderStatus: cancelOrderData.order_status,
    //   availableMargin: Big(cancelOrderData.available_margin).toNumber(),
    //   maintenanceMargin: Big(cancelOrderData.maintenance_margin).toNumber(),
    //   unrealizedPnl: Big(cancelOrderData.unrealized_pnl).toNumber(),
    //   settlementPrice: Big(cancelOrderData.settlement_price).toNumber(),
    //   positionSize: Big(cancelOrderData.positionsize).toNumber(),
    //   orderType: cancelOrderData.order_type,
    //   date: dayjs(cancelOrderData.timestamp).toDate(),
    //   exit_nonce: cancelOrderData.exit_nonce,
    //   executionPrice: Big(cancelOrderData.execution_price).toNumber(),
    //   isOpen: false,
    //   feeSettled: Big(cancelOrderData.fee_settled).toNumber(),
    //   feeFilled: Big(cancelOrderData.fee_filled).toNumber(),
    //   realizedPnl: Big(cancelOrderData.unrealized_pnl).toNumber(),
    //   tx_hash: cancelOrderData.tx_hash || order.tx_hash,
    // })

    updateZkAccount(order.accountAddress, {
      ...updatedAccount,
      type: "Coin",
    });

  }, [privateKey, zkAccounts])

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
      <div className="">
        <RenderTabs />
      </div>
    </div>
  );
};

export default DetailsPanel;
