import { useQuery } from "@tanstack/react-query";
import { useTwilightStore } from "../providers/store";
import { createQueryTradeOrderMsg } from "../twilight/zkos";
import { useSessionStore } from "../providers/session";
import { queryTradeOrder } from "../api/relayer";

export const useSyncTrades = () => {
  const tradeOrders = useTwilightStore((state) => state.trade.trades);
  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const selectedZkAccount = useTwilightStore(
    (state) => state.zk.selectedZkAccount
  );
  const privateKey = useSessionStore((state) => state.privateKey);

  const currentZkAccount = zkAccounts[selectedZkAccount];

  useQuery({
    queryKey: ["trades"],
    queryFn: async () => {
      if (tradeOrders.length === 0) return;

      for (const trade of tradeOrders) {
        const queryTradeOrderMsg = await createQueryTradeOrderMsg({
          address: currentZkAccount.address,
          orderStatus: trade.orderStatus,
          signature: privateKey,
        });

        console.log("queryTradeOrderMsg", queryTradeOrderMsg);

        const queryTradeOrderRes = await queryTradeOrder(queryTradeOrderMsg);

        console.log("queryTradeOrderRes", queryTradeOrderRes);
      }
    },
  });
};
