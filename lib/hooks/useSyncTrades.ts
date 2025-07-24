import { useQuery } from "@tanstack/react-query";
import { useTwilightStore } from "../providers/store";
import { createQueryTradeOrderMsg } from "../twilight/zkos";
import { useSessionStore } from "../providers/session";
import { queryTradeOrder } from "../api/relayer";
import Big from "big.js";
import { TradeOrder } from "../types";
import { useWallet } from "@cosmos-kit/react-lite";
import { WalletStatus } from "@cosmos-kit/core";

const statusToSkip = ["CANCELLED", "SETTLED", "LIQUIDATE"];

const keysToUpdateNumber = [
  "bankruptcyPrice",
  "bankruptcyValue",
  "maintenanceMargin",
  "entryPrice",
  "realizedPnl",
  "unrealizedPnl",
  "settlementPrice",
  "positionSize",
  "entryNonce",
  "entrySequence",
  "executionPrice",
  "initialMargin",
  "availableMargin",
  "liquidationPrice",
  "feeFilled",
  "feeSettled",
  "leverage",
  "value",
];

const tradeInfoKeysToTradeKey = {
  order_status: "orderStatus",
  available_margin: "availableMargin",
  bankruptcy_price: "bankruptcyPrice",
  bankruptcy_value: "bankruptcyValue",
  entry_nonce: "entryNonce",
  entry_sequence: "entrySequence",
  entryprice: "entryPrice",
  execution_price: "executionPrice",
  exit_nonce: "exit_nonce",
  initial_margin: "initialMargin",
  leverage: "leverage",
  liquidation_price: "liquidationPrice",
  maintenance_margin: "maintenanceMargin",
  order_type: "orderType",
  position_type: "positionType",
  positionsize: "positionSize",
  settlement_price: "settlementPrice",
  timestamp: "date",
  unrealized_pnl: "unrealizedPnl",
  fee_filled: "feeFilled",
  fee_settled: "feeSettled",
  output: "output",
};

export const useSyncTrades = () => {
  const tradeOrders = useTwilightStore((state) => state.trade.trades);
  const setNewTrades = useTwilightStore((state) => state.trade.setNewTrades);
  const addTradeHistory = useTwilightStore(
    (state) => state.trade_history.addTrade
  );

  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);
  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);

  const { status } = useWallet();

  const privateKey = useSessionStore((state) => state.privateKey);

  useQuery({
    queryKey: ["sync-trades"],
    queryFn: async () => {
      if (status !== WalletStatus.Connected) return true;

      if (tradeOrders.length === 0) return true;

      const updated = new Map<string, Partial<TradeOrder>>();

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

        if (trade.uuid !== traderOrderInfo.uuid) {
          continue;
        }

        const updatedTradeData: Record<string, any> = {};

        for (const [key, value] of Object.entries(traderOrderInfo)) {
          const tradeKey =
            tradeInfoKeysToTradeKey[
              key as keyof typeof tradeInfoKeysToTradeKey
            ];

          if (!(tradeKey in trade)) {
            continue;
          }

          let updatedValue = value;

          if (keysToUpdateNumber.includes(tradeKey)) {
            updatedValue = new Big(value).toNumber();
          }

          const currentValue = trade[tradeKey as keyof TradeOrder];

          if (currentValue === updatedValue) {
            continue;
          }

          if (key === "order_status") {
            updated.set(trade.uuid, {
              isOpen:
                traderOrderInfo.order_status === "CANCELLED" ||
                traderOrderInfo.order_status === "LIQUIDATE" ||
                traderOrderInfo.order_status === "SETTLED"
                  ? false
                  : true,
            });
          }

          updatedTradeData[tradeKey] = updatedValue;
        }

        if (Object.keys(updatedTradeData).length > 0) {
          updated.set(trade.uuid, updatedTradeData);
        }
      }

      if (updated.size < 1) {
        return true;
      }

      const mergedTrades: Array<TradeOrder> = [];

      for (const trade of tradeOrders) {
        const updatedTrade = updated.get(trade.uuid);

        if (updatedTrade) {
          const newTrade = {
            ...trade,
            ...updatedTrade,
          };

          console.log("updatedTrade", updatedTrade);

          mergedTrades.push(newTrade);

          // update zk account balance
          if (
            newTrade.orderStatus === "SETTLED" ||
            newTrade.orderStatus === "LIQUIDATED"
          ) {
            const newBalance = newTrade.availableMargin;

            const existingZkAccount = zkAccounts.find(
              (account) => account.address === newTrade.accountAddress
            );

            if (existingZkAccount) {
              updateZkAccount(newTrade.accountAddress, {
                ...existingZkAccount,
                value: newBalance,
              });
            }
          }

          // order status changed, add to history
          if (updatedTrade.orderStatus) {
            console.log(
              "adding to history",
              trade.orderStatus,
              updatedTrade.orderStatus
            );

            addTradeHistory(newTrade);
          }
        } else {
          mergedTrades.push(trade);
        }
      }

      setNewTrades(mergedTrades);

      return true;
    },
    refetchInterval: 3000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true,
  });
};
