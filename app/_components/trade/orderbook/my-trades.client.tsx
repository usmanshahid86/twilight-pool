"use client";
import { cancelTradeOrder, executeTradeOrder } from "@/lib/api/client";
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
import React, { useMemo } from "react";
import { MyTradesDataTable } from "./my-trades/data-table";
import { myTradesColumns, calculateUpnl } from "./my-trades/columns";
import { queryTradeOrder } from '@/lib/api/relayer';
import dayjs from 'dayjs';

const OrderMyTrades = () => {
  const { toast } = useToast();
  const { feed } = usePriceFeed();

  const privateKey = useSessionStore((state) => state.privateKey);

  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const updateTrade = useTwilightStore((state) => state.trade.updateTrade);
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);
  const tradeOrders = useTwilightStore((state) => state.trade.trades);

  // Get the current price from the feed
  const currentPrice = feed.length > 1 ? feed[feed.length - 1] : 0;

  async function settleOrder(tradeOrder: TradeOrder) {
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
  }

  // async function cancelOrder(tradeOrder: TradeOrder) {
  //   const currentAccount = zkAccounts.find(
  //     (account) => account.address === tradeOrder.accountAddress
  //   );

  //   if (!currentAccount) {
  //     toast({
  //       variant: "error",
  //       title: "Error",
  //       description: "Error account associated with this order is missing",
  //     });

  //     removeTrade(tradeOrder);
  //     return;
  //   }

  //   try {
  //     const result = await cancelTradeOrder({
  //       accountId: currentAccount.address,
  //       uuid: tradeOrder.uuid,
  //       orderType: tradeOrder.orderType,
  //       orderStatus: tradeOrder.orderStatus,
  //     });

  //     console.log("cancel result", result);

  //     const transactionHashCondition = (
  //       txHashResult: Awaited<ReturnType<typeof queryTransactionHashes>>
  //     ) => {
  //       if (txHashResult.result) {
  //         const transactionHashes = txHashResult.result;

  //         let hasSettled = false;
  //         transactionHashes.forEach((result) => {
  //           if (result.order_status !== "SETTLED") {
  //             return;
  //           }

  //           hasSettled =
  //             result.order_id === tradeOrder.uuid &&
  //             !result.tx_hash.includes("Error");
  //         });

  //         return hasSettled;
  //       }
  //       return false;
  //     };

  //     const transactionHashRes = await retry<
  //       ReturnType<typeof queryTransactionHashes>,
  //       string
  //     >(
  //       queryTransactionHashes,
  //       9,
  //       tradeOrder.accountAddress,
  //       2500,
  //       transactionHashCondition
  //     );

  //     if (!transactionHashRes.success) {
  //       console.error("cancel order failed to get transaction_hashes");
  //       toast({
  //         variant: "error",
  //         title: "Error",
  //         description: "Error with cancelling trade order",
  //       });
  //       return;
  //     }

  //     toast({
  //       title: "Success",
  //       description: `Successfully cancelled ${tradeOrder.orderType.toLowerCase()} order`,
  //     });

  //     const getZkAccountBalanceResult = await retry<
  //       ReturnType<typeof getZkAccountBalance>,
  //       {
  //         zkAccountAddress: string;
  //         signature: string;
  //       }
  //     >(
  //       getZkAccountBalance,
  //       9,
  //       {
  //         zkAccountAddress: tradeOrder.accountAddress,
  //         signature: privateKey,
  //       },
  //       2500,
  //       (result) => {
  //         if (result.value) return true;

  //         return false;
  //       }
  //     );

  //     if (!getZkAccountBalanceResult.success) {
  //       console.error("cancel order failed to get balance");
  //       toast({
  //         variant: "error",
  //         title: "Error",
  //         description: "Error with getting balance after cancelling order.",
  //       });
  //       return;
  //     }

  //     const { value: newAccountBalance } = getZkAccountBalanceResult.data;

  //     if (!newAccountBalance) {
  //       toast({
  //         variant: "error",
  //         title: "Error",
  //         description: "Error with cancelling trade order",
  //       });
  //       return;
  //     }

  //     console.log("cancel account balance", newAccountBalance);

  //     updateZkAccount(tradeOrder.accountAddress, {
  //       ...currentAccount,
  //       value: newAccountBalance,
  //     });

  //     removeTrade(tradeOrder);

  //     addTradeHistory({
  //       accountAddress: tradeOrder.accountAddress,
  //       date: new Date(),
  //       orderStatus: "CANCELLED",
  //       orderType: tradeOrder.orderType,
  //       positionType: tradeOrder.positionType,
  //       tx_hash: tradeOrder.tx_hash,
  //       uuid: tradeOrder.uuid,
  //       value: tradeOrder.value,
  //       output: tradeOrder.output,
  //     });
  //   } catch (err) {
  //     console.error(err);
  //     toast({
  //       variant: "error",
  //       title: "Error",
  //       description: "Error with cancelling trade order",
  //     });
  //   }
  // }

  const tableData = useMemo(() => {
    return tradeOrders.filter((trade) => trade.isOpen).map((trade) => {
      // Calculate unrealized PnL
      let calculatedUnrealizedPnl: number | undefined;

      if (currentPrice && trade.entryPrice) {
        // Calculate PnL if current price and entry price are available
        const positionSize = trade.positionSize
        calculatedUnrealizedPnl = calculateUpnl(trade.entryPrice, currentPrice, trade.positionType, positionSize);
      }

      return {
        ...trade,
        currentPrice: currentPrice,
        calculatedUnrealizedPnl: calculatedUnrealizedPnl,
        onSettle: settleOrder,
        onCancel: () => {
          // await cancelOrder(trade);
        },
      };
    });
  }, [tradeOrders, currentPrice]);

  return (
    <div className="w-full px-3">
      <MyTradesDataTable
        columns={myTradesColumns}
        data={tableData}
      />
    </div>
  );
};

export default OrderMyTrades;
