"use client";
import wfetch from '@/lib/http';
import { useSessionStore } from '@/lib/providers/session';
import { useWallet } from "@cosmos-kit/react-lite";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

const FAUCET_RPC_URL = process.env.NEXT_PUBLIC_FAUCET_ENDPOINT as string;

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
  const pathname = usePathname();

  const kycStatus = useSessionStore((state) => state.kycStatus);
  const setKycStatus = useSessionStore((state) => state.setKycStatus);

  useEffect(() => {
    async function autoConnect() {
      if (status !== "Connected" || !mainWallet) return;
      const chainWallet = mainWallet.getChainWallet("nyks");
      const address = chainWallet?.address || "";

      if (kycStatus) return;

      const whitelistStatus = await fetchWhitelistStatus(address);

      console.log("whitelistStatus", whitelistStatus);

      if (!whitelistStatus) {
        setKycStatus(false);
        console.log("redirecting to kyc");
        router.push("/kyc");
        return;
      }

      setKycStatus(true);
    }

    autoConnect();
  }, [status, pathname, mainWallet]);

  return <>{children}</>;
};

export default LayoutMountWrapper;
