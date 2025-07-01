"use client";
import { executeTradeOrder } from "@/lib/api/client";
import { queryTransactionHashByRequestId, queryTransactionHashes } from "@/lib/api/rest";
import { retry } from "@/lib/helpers";
import { useToast } from "@/lib/hooks/useToast";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import { usePriceFeed } from "@/lib/providers/feed";
import { getZkAccountBalance } from "@/lib/twilight/zk";
import { createQueryTradeOrderMsg, executeTradeLendOrderMsg } from "@/lib/twilight/zkos";
import { TradeOrder } from "@/lib/types";
import BTC from "@/lib/twilight/denoms";
import Big from "big.js";
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { MyTradesDataTable } from "./my-trades/data-table";
import { myTradesColumns, calculateUpnl } from "./my-trades/columns";
import { cancelTradeOrder, queryTradeOrder } from '@/lib/api/relayer';
import dayjs from 'dayjs';
import cn from "@/lib/cn";

const OrderMyTrades = () => {
  const { toast } = useToast();
  const { getCurrentPrice, subscribe } = usePriceFeed();
  const [, forceUpdate] = useState({});

  const privateKey = useSessionStore((state) => state.privateKey);

  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const updateTrade = useTwilightStore((state) => state.trade.updateTrade);
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);
  const tradeOrders = useTwilightStore((state) => state.trade.trades);

  const removeTrade = useTwilightStore((state) => state.trade.removeTrade);

  // Subscribe to price updates to refresh price-dependent columns
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      forceUpdate({});
    });

    return unsubscribe;
  }, [subscribe]);

  // Memoize the callback functions to prevent unnecessary re-renders
  const handleSettleOrder = useCallback(async (tradeOrder: TradeOrder) => {
    if (!tradeOrder.output) {
      toast({
        variant: "error",
        title: "Error",
        description: "Error with settling trade order",
      });
      return;
    }

    const currentAccount = zkAccounts.find(
      (account) => account.address === tradeOrder.accountAddress
    );

    if (!currentAccount) {
      toast({
        variant: "error",
        title: "Error",
        description: "Error account associated with this order is missing",
      });

      return;
    }

    try {
      console.log({
        address: tradeOrder.accountAddress,
        orderStatus: tradeOrder.orderStatus,
        orderType: tradeOrder.orderType,
        outputMemo: tradeOrder.output,
        transactionType: "ORDERTX",
        uuid: tradeOrder.uuid,
        signature: privateKey,
        executionPricePoolshare: 1, // todo: fix for non market order
      });

      const msg = await executeTradeLendOrderMsg({
        address: tradeOrder.accountAddress,
        orderStatus: tradeOrder.orderStatus,
        orderType: tradeOrder.orderType,
        outputMemo: tradeOrder.output,
        transactionType: "ORDERTX",
        uuid: tradeOrder.uuid,
        signature: privateKey,
        executionPricePoolshare: 1, // todo: fix for non market order
      });

      console.log("msg", msg);
      toast({
        title: "Closing order",
        description: "Action is being processed...",
      });

      const executeTradeRes = await executeTradeOrder(msg);

      console.log("executeTradeRes", executeTradeRes);
      const requestId = executeTradeRes.result.id_key;

      const transactionHashCondition = (
        txHashResult: Awaited<ReturnType<typeof queryTransactionHashes>>
      ) => {
        if (txHashResult.result) {
          const transactionHashes = txHashResult.result;

          let hasSettled = false;
          transactionHashes.forEach((result) => {
            if (result.order_status !== "SETTLED") {
              return;
            }

            hasSettled =
              result.order_id === tradeOrder.uuid &&
              !result.tx_hash.includes("Error");
          });

          return hasSettled;
        }
        return false;
      };

      const transactionHashRes = await retry<
        ReturnType<typeof queryTransactionHashes>,
        string
      >(
        queryTransactionHashByRequestId,
        9,
        requestId,
        2500,
        transactionHashCondition
      );

      if (!transactionHashRes.success) {
        console.error("settling order failed to get transaction_hashes");
        toast({
          variant: "error",
          title: "Error",
          description: "Error with settling trade order",
        });
        return;
      }

      console.log("tx_hashes return", transactionHashRes.data.result);
      // note: we have to make sure chain has settled before requesting balance
      // as input is memo and not yet coin

      const settledTx = transactionHashRes.data.result.find(
        (tx) => tx.order_status === "SETTLED"
      )

      const getZkAccountBalanceResult = await retry<
        ReturnType<typeof getZkAccountBalance>,
        {
          zkAccountAddress: string;
          signature: string;
        }
      >(
        getZkAccountBalance,
        9,
        {
          zkAccountAddress: tradeOrder.accountAddress,
          signature: privateKey,
        },
        2500,
        (result) => {
          if (result.value) return true;

          return false;
        }
      );

      if (!getZkAccountBalanceResult.success) {
        console.error("settling order failed to get balance");
        toast({
          variant: "error",
          title: "Error",
          description: "Error with getting balance after settling order.",
        });
        return;
      }

      const { value: newAccountBalance } = getZkAccountBalanceResult.data;

      if (!newAccountBalance) {
        toast({
          variant: "error",
          title: "Error",
          description: "Error with settling trade order",
        });
        return;
      }

      console.log("settle account balance", newAccountBalance);

      updateZkAccount(tradeOrder.accountAddress, {
        ...currentAccount,
        value: newAccountBalance,
        type: "Coin",
      });

      const queryTradeOrderMsg = await createQueryTradeOrderMsg({
        address: tradeOrder.accountAddress,
        orderStatus: "SETTLED",
        signature: privateKey,
      });

      console.log("queryTradeOrderMsg", queryTradeOrderMsg);

      const queryTradeOrderRes = await queryTradeOrder(queryTradeOrderMsg);

      if (!queryTradeOrderRes) {
        throw new Error("Failed to query trade order");
      }

      const traderOrderInfo = queryTradeOrderRes.result;

      console.log("traderOrderInfo", traderOrderInfo);

      updateTrade({
        ...tradeOrder,
        orderStatus: "SETTLED",
        tx_hash: settledTx?.tx_hash || tradeOrder.tx_hash,
        realizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
        unrealizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
        settlementPrice: new Big(traderOrderInfo.settlement_price).toNumber(),
        positionSize: new Big(traderOrderInfo.positionsize).toNumber(),
        entryNonce: traderOrderInfo.entry_nonce,
        entrySequence: traderOrderInfo.entry_sequence,
        executionPrice: new Big(traderOrderInfo.execution_price).toNumber(),
        initialMargin: new Big(traderOrderInfo.initial_margin).toNumber(),
        liquidationPrice: new Big(traderOrderInfo.liquidation_price).toNumber(),
        exit_nonce: traderOrderInfo.exit_nonce,
        date: dayjs(traderOrderInfo.timestamp).toDate(),
        isOpen: false,
        feeFilled: new Big(traderOrderInfo.fee_filled).toNumber(),
        feeSettled: new Big(traderOrderInfo.fee_settled).toNumber(),
      })

      toast({
        title: "Success",
        description: `Successfully closed ${tradeOrder.orderType.toLowerCase()} order`,
      });

      console.log("trade order settled", settledTx?.tx_hash);
    } catch (err) {
      console.error(err);
      toast({
        variant: "error",
        title: "Error",
        description: "Error with settling trade order",
      });
    }
  }, [toast, zkAccounts, privateKey, updateZkAccount, updateTrade]);

  const handleCancelOrder = useCallback(async (tradeOrder: TradeOrder) => {
    const currentAccount = zkAccounts.find(
      (account) => account.address === tradeOrder.accountAddress
    );

    if (!currentAccount) {
      toast({
        variant: "error",
        title: "Error",
        description: "Error account associated with this order is missing",
      });

      removeTrade(tradeOrder);
      return;
    }

    try {
      console.log("uuid", tradeOrder.uuid);

      const result = await cancelTradeOrder({
        address: currentAccount.address,
        uuid: tradeOrder.uuid,
        signature: privateKey,
      });

      if (result.result.includes("not cancelable")) {
        toast({
          variant: "error",
          title: "Error",
          description: "You cannot cancel this order",
        });
        return;
      }

      console.log("cancel result", result);

      const transactionHashCondition = (
        txHashResult: Awaited<ReturnType<typeof queryTransactionHashes>>
      ) => {
        if (txHashResult.result) {
          const transactionHashes = txHashResult.result;

          let hasSettled = false;
          transactionHashes.forEach((result) => {
            if (result.order_status !== "CANCELLED") {
              console.log(result.order_status)
              return;
            }

            hasSettled =
              result.order_id === tradeOrder.uuid &&
              !result.tx_hash.includes("Error");
          });

          return hasSettled;
        }
        return false;
      };

      const transactionHashRes = await retry<
        ReturnType<typeof queryTransactionHashes>,
        string
      >(
        queryTransactionHashes,
        9,
        tradeOrder.accountAddress,
        2500,
        transactionHashCondition
      );

      if (!transactionHashRes.success) {
        console.error("cancel order failed to get transaction_hashes");
        toast({
          variant: "error",
          title: "Error",
          description: "Error with cancelling trade order",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Successfully cancelled ${tradeOrder.orderType.toLowerCase()} order`,
      });

      const getZkAccountBalanceResult = await retry<
        ReturnType<typeof getZkAccountBalance>,
        {
          zkAccountAddress: string;
          signature: string;
        }
      >(
        getZkAccountBalance,
        9,
        {
          zkAccountAddress: tradeOrder.accountAddress,
          signature: privateKey,
        },
        2500,
        (result) => {
          if (result.value) return true;

          return false;
        }
      );

      if (!getZkAccountBalanceResult.success) {
        console.error("cancel order failed to get balance");
        toast({
          variant: "error",
          title: "Error",
          description: "Error with getting balance after cancelling order.",
        });
        return;
      }

      const { value: newAccountBalance } = getZkAccountBalanceResult.data;

      if (!newAccountBalance) {
        toast({
          variant: "error",
          title: "Error",
          description: "Error with cancelling trade order",
        });
        return;
      }

      console.log("cancel account balance", newAccountBalance);

      const queryTradeOrderMsg = await createQueryTradeOrderMsg({
        address: tradeOrder.accountAddress,
        orderStatus: "CANCELLED",
        signature: privateKey,
      });

      console.log("queryTradeOrderMsg", queryTradeOrderMsg);

      const queryTradeOrderRes = await queryTradeOrder(queryTradeOrderMsg);

      if (!queryTradeOrderRes) {
        throw new Error("Failed to query trade order");
      }

      const traderOrderInfo = queryTradeOrderRes.result;

      console.log("traderOrderInfo", traderOrderInfo);

      updateZkAccount(tradeOrder.accountAddress, {
        ...currentAccount,
        value: newAccountBalance,
      });

      updateTrade({
        ...tradeOrder,
        orderStatus: "CANCELLED",
        orderType: tradeOrder.orderType,
        positionType: tradeOrder.positionType,
        tx_hash: tradeOrder.tx_hash,
        uuid: tradeOrder.uuid,
        output: tradeOrder.output,
        realizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
        unrealizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
        settlementPrice: new Big(traderOrderInfo.settlement_price).toNumber(),
        positionSize: new Big(traderOrderInfo.positionsize).toNumber(),
        entryNonce: traderOrderInfo.entry_nonce,
        entrySequence: traderOrderInfo.entry_sequence,
        executionPrice: new Big(traderOrderInfo.execution_price).toNumber(),
        initialMargin: new Big(traderOrderInfo.initial_margin).toNumber(),
        liquidationPrice: new Big(traderOrderInfo.liquidation_price).toNumber(),
        exit_nonce: traderOrderInfo.exit_nonce,
        date: dayjs(traderOrderInfo.timestamp).toDate(),
        isOpen: false,
        feeFilled: new Big(traderOrderInfo.fee_filled).toNumber(),
        feeSettled: new Big(traderOrderInfo.fee_settled).toNumber(),
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "error",
        title: "Error",
        description: "Error with cancelling trade order",
      });
    }
  }, [toast, zkAccounts, privateKey, removeTrade, updateZkAccount, updateTrade]);

  // Create enhanced columns with current price access
  const enhancedColumns = useMemo(() => {
    return myTradesColumns.map(column => {
      if ('accessorKey' in column && column.accessorKey === 'markPrice') {
        return {
          ...column,
          cell: (row: any) => {
            const trade = row.row.original;
            const currentPrice = getCurrentPrice();
            const markPrice = currentPrice || trade.entryPrice;

            return (
              <span className="font-medium">
                ${markPrice.toFixed(2)}
              </span>
            );
          },
        };
      }

      if ('accessorKey' in column && column.accessorKey === 'fee') {
        return {
          ...column,
          cell: (row: any) => {
            const trade = row.row.original;
            const fee = trade.feeFilled + trade.feeSettled;

            return (
              <span className="font-medium">
                {BTC.format(new BTC("sats", Big(fee)).convert("BTC"), "BTC")} BTC
              </span>
            );
          },
        }
      }

      if ('accessorKey' in column && column.accessorKey === 'calculatedUnrealizedPnl') {
        return {
          ...column,
          cell: (row: any) => {
            const trade = row.row.original;
            const isPendingLimit = trade.orderType === "LIMIT" && trade.orderStatus === "PENDING";

            if (isPendingLimit) {
              return <span className="text-xs text-gray-500">—</span>;
            }

            let upnl: number | undefined;
            const currentPrice = getCurrentPrice();
            if (currentPrice && trade.entryPrice) {
              const positionSize = trade.positionSize;
              upnl = calculateUpnl(trade.entryPrice, currentPrice, trade.positionType, positionSize);
            }

            if (upnl === undefined || upnl === null) {
              return <span className="text-xs text-gray-500">—</span>;
            }

            const isPositive = upnl > 0;
            const isNegative = upnl < 0;
            const displayupnl = BTC.format(new BTC("sats", Big(upnl)).convert("BTC"), "BTC")

            return (
              <span
                className={cn(
                  "text-xs font-medium",
                  isPositive && "text-green-medium",
                  isNegative && "text-red",
                  !isPositive && !isNegative && "text-gray-500"
                )}
              >
                {isPositive ? "+" : ""}{displayupnl} BTC
              </span>
            );
          },
        };
      }

      return column;
    });
  }, [getCurrentPrice]);

  // Memoize stable table data that doesn't change with price updates
  const tableData = useMemo(() => {
    return tradeOrders.filter((trade) => trade.isOpen).map((trade) => ({
      ...trade,
      onSettle: () => handleSettleOrder(trade),
      onCancel: () => handleCancelOrder(trade),
    }));
  }, [tradeOrders, handleSettleOrder, handleCancelOrder]);

  return (
    <div className="w-full px-3">
      <MyTradesDataTable
        columns={enhancedColumns}
        data={tableData}
      />
    </div>
  );
};

export default OrderMyTrades;
