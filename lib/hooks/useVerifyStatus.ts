import { useQuery } from "@tanstack/react-query";
import wfetch from "../http";
import { useWallet } from "@cosmos-kit/react-lite";

const FAUCET_RPC_URL = process.env.NEXT_PUBLIC_FAUCET_ENDPOINT as string;

export default function useVerifyStatus() {
  const { mainWallet } = useWallet();

  const chainWallet = mainWallet?.getChainWallet("nyks");
  const address = chainWallet?.address || "";
  const fetchWhitelistStatus = async (recipientAddress: string) => {
    try {
      const body = JSON.stringify({
        recipientAddress: recipientAddress,
      });

      const { success, data, error } = await wfetch(
        `${FAUCET_RPC_URL}/whitelist/status`
      )
        .post({ body })
        .json<{
          data: {
            address: string;
            whitelisted: boolean;
          };
        }>();

      if (!success) {
        console.error("Failed to fetch whitelist status:", error);
        return false;
      }

      if (!data.data.whitelisted) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error fetching whitelist status:", error);
      return false;
    }
  };

  const { data: isVerified } = useQuery({
    queryKey: ["verifyStatus", address],
    queryFn: async () => {
      const verified = await fetchWhitelistStatus(address);

      return verified;
    },
    enabled: !!address,
    refetchInterval: 5000,
    staleTime: 5000,
  });

  return {
    isVerified,
  };
}
