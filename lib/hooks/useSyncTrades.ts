import { useQuery } from "@tanstack/react-query";
import { useTwilightStore } from "../providers/store";
import { createQueryTradeOrderMsg } from "../twilight/zkos";
import { useSessionStore } from "../providers/session";
import { queryTradeOrder } from "../api/relayer";
import Big from "big.js";
import dayjs from "dayjs";

const statusToSkip = ["CANCELLED", "SETTLED"];

export const useSyncTrades = () => {
  const tradeOrders = useTwilightStore((state) => state.trade.trades);
  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const selectedZkAccount = useTwilightStore(
    (state) => state.zk.selectedZkAccount
  );
  const updateTrade = useTwilightStore((state) => state.trade.updateTrade);

  const privateKey = useSessionStore((state) => state.privateKey);

  const currentZkAccount = zkAccounts[selectedZkAccount];

  useQuery({
    queryKey: ["sync-trades"],
    queryFn: async () => {
      if (tradeOrders.length === 0) return true;

      for (const trade of tradeOrders) {
        if (statusToSkip.includes(trade.orderStatus)) continue;

        const queryTradeOrderMsg = await createQueryTradeOrderMsg({
          address: currentZkAccount.address,
          orderStatus: trade.orderStatus,
          signature: privateKey,
        });

        const queryTradeOrderRes = await queryTradeOrder(queryTradeOrderMsg);

        if (!queryTradeOrderRes) {
          continue;
        }

        const traderOrderInfo = queryTradeOrderRes.result;

        updateTrade({
          ...trade,
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
        });
      }

      return true;
    },
    refetchInterval: 2500,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true,
  });
};
