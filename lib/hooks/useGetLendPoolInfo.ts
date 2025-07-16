import { useQuery } from "@tanstack/react-query";
import { getLendPoolInfo } from "../api/rest";
import { LendPoolInfo } from "../types";
import { useTwilightStore } from "../providers/store";
import BTC from "../twilight/denoms";
import Big from "big.js";

export function useGetLendPoolInfo() {
  const setPoolInfo = useTwilightStore((state) => state.lend.setPoolInfo);

  const query = useQuery({
    queryKey: ["lend-pool-info"],
    queryFn: async (): Promise<LendPoolInfo | null> => {
      const result = await getLendPoolInfo();

      if (!result) return null;

      setPoolInfo({
        apy: 0,
        pool_share: Number(result.total_pool_share),
        tvl_btc: new BTC("sats", Big(result.total_locked_value))
          .convert("BTC")
          .toNumber(),
      });
      return result;
    },
    enabled: true,
    refetchInterval: 30000,
    staleTime: 25000,
  });

  return query;
}
