"use client";
import { getBTCDepositAddress } from "@/lib/api/rest";
import wfetch from '@/lib/http';
import { useWallet } from "@cosmos-kit/react-lite";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

const FAUCET_RPC_URL = "https://faucet-rpc.twilight.rest";

const fetchWhitelistStatus = async (recipientAddress: string) => {
  try {
    const body = JSON.stringify({
      recipientAddress: recipientAddress
    });

    const { success, data, error } = await wfetch(`${FAUCET_RPC_URL}/whitelist/status`)
      .post({ body })
      .json<{
        data: {
          address: string;
          whitelisted: boolean;
        }
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

const LayoutMountWrapper = ({ children }: { children: React.ReactNode }) => {
  const { mainWallet, status } = useWallet();

  const router = useRouter();

  useEffect(() => {
    async function autoConnect() {
      if (status !== "Connected" || !mainWallet) return;
      const chainWallet = mainWallet.getChainWallet("nyks");
      const address = chainWallet?.address || "";

      const whitelistStatus = await fetchWhitelistStatus(address);

      console.log("whitelistStatus", whitelistStatus);
      if (!whitelistStatus) {
        router.push("/kyc");
      }
    }

    autoConnect();
  }, [status]);

  return <>{children}</>;
};

export default LayoutMountWrapper;
