import { WalletStatus } from "@cosmos-kit/core";
import { useWallet } from "@cosmos-kit/react-lite";
import { useQuery } from "@tanstack/react-query";

export default function useGetTwilightBTCBalance() {
  const { status, mainWallet } = useWallet();

  const fetchTwilightBalance = async () => {
    const chainWallet = mainWallet?.getChainWallet("nyks");

    if (!chainWallet) {
      throw new Error("no chainWallet");
    }

    const twilightAddress = chainWallet.address;

    if (!twilightAddress) {
      throw new Error("no twilightAddress");
    }

    const stargateClient = await chainWallet.getSigningStargateClient();
    const satsBalance = await stargateClient.getBalance(
      twilightAddress,
      "sats"
    );

    const { amount } = satsBalance;
    return parseInt(amount);
  };

  const {
    data: twilightSats = 0,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["twilightBtcBalance", mainWallet?.walletName, status],
    queryFn: fetchTwilightBalance,
    enabled: status === WalletStatus.Connected,
    refetchInterval: 5000,
    staleTime: 5000, // Consider data stale after 10 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    twilightSats,
    isLoading,
    refetch,
    error,
  };
}
