import { useQuery } from "@tanstack/react-query";
import { useTwilightStore } from "../providers/store";
import { createQueryTradeOrderMsg } from "../twilight/zkos";
import { useSessionStore } from "../providers/session";
import { queryTradeOrder } from "../api/relayer";
import Big from "big.js";
import dayjs from "dayjs";
import { TradeOrder } from "../types";
import { useWallet } from "@cosmos-kit/react-lite";
import { WalletStatus } from "@cosmos-kit/core";

const statusToSkip = ["CANCELLED", "SETTLED"];

export const useSyncTrades = () => {
  const tradeOrders = useTwilightStore((state) => state.trade.trades);
  const setNewTrades = useTwilightStore((state) => state.trade.setNewTrades);

  const { status } = useWallet();

  const privateKey = useSessionStore((state) => state.privateKey);

  useQuery({
    queryKey: ["sync-trades"],
    queryFn: async () => {
      if (status !== WalletStatus.Connected) return true;

      if (tradeOrders.length === 0) return true;

      const updated: TradeOrder[] = [];

      for (const trade of tradeOrders) {
        if (statusToSkip.includes(trade.orderStatus)) continue;

        const queryTradeOrderMsg = await createQueryTradeOrderMsg({
          address: trade.accountAddress,
          orderStatus: trade.orderStatus,
          signature: privateKey,
        });

        const queryTradeOrderRes = await queryTradeOrder(queryTradeOrderMsg);

        if (!queryTradeOrderRes) {
          continue;
        }

        const traderOrderInfo = queryTradeOrderRes.result;

        const updatedTrade: TradeOrder = {
          ...trade,
          bankruptcyPrice: new Big(traderOrderInfo.bankruptcy_price).toNumber(),
          bankruptcyValue: new Big(traderOrderInfo.bankruptcy_value).toNumber(),
          maintenanceMargin: new Big(
            traderOrderInfo.maintenance_margin
          ).toNumber(),
          entryPrice: new Big(traderOrderInfo.entryprice).toNumber(),
          orderStatus: traderOrderInfo.order_status,
          uuid: traderOrderInfo.uuid,
          realizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
          unrealizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
          settlementPrice: new Big(traderOrderInfo.settlement_price).toNumber(),
          positionSize: new Big(traderOrderInfo.positionsize).toNumber(),
          entryNonce: traderOrderInfo.entry_nonce,
          entrySequence: traderOrderInfo.entry_sequence,
          executionPrice: new Big(traderOrderInfo.execution_price).toNumber(),
          initialMargin: new Big(traderOrderInfo.initial_margin).toNumber(),
          availableMargin: new Big(traderOrderInfo.available_margin).toNumber(),
          liquidationPrice: new Big(
            traderOrderInfo.liquidation_price
          ).toNumber(),
          exit_nonce: traderOrderInfo.exit_nonce,
          date: dayjs(traderOrderInfo.timestamp).toDate(),
          feeFilled: new Big(traderOrderInfo.fee_filled).toNumber(),
          feeSettled: new Big(traderOrderInfo.fee_settled).toNumber(),
          isOpen:
            traderOrderInfo.order_status === "SETTLED" ||
            traderOrderInfo.order_status === "CANCELLED"
              ? false
              : true,
        };

        updated.push(updatedTrade);
      }

      const mergedTrades = tradeOrders.map((trade) => {
        const updatedTrade = updated.find((t) => t.uuid === trade.uuid);

        if (updatedTrade) {
          return updatedTrade;
        }

        return trade;
      });

      setNewTrades(mergedTrades);

      return true;
    },
    refetchInterval: 2500,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true,
  });
};
