import { useQuery } from "@tanstack/react-query";
import { useTwilightStore } from "../providers/store";
import { useWallet } from "@cosmos-kit/react-lite";
import { WalletStatus } from "@cosmos-kit/core";
import { useSessionStore } from "../providers/session";
import { getZkAccountBalance } from "../twilight/zk";

export const useSyncBalance = () => {
  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);

  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);
  const privateKey = useSessionStore((state) => state.privateKey);
  const { status } = useWallet();

  useQuery({
    queryKey: ["sync-balance"],
    queryFn: async () => {
      if (status !== WalletStatus.Connected) return true;

      for (const zkAccount of zkAccounts) {
        if (!zkAccount.isOnChain) continue;

        if (zkAccount.type === "Memo") continue;

        const balance = await getZkAccountBalance({
          zkAccountAddress: zkAccount.address,
          signature: privateKey,
        });

        if (balance.value === undefined) {
          console.error("Error getting balance");
          continue;
        }

        if (balance.value === zkAccount.value) continue;

        updateZkAccount(zkAccount.address, {
          ...zkAccount,
          value: balance.value,
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
