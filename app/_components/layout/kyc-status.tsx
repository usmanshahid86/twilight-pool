"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/lib/providers/session";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover";
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@cosmos-kit/react-lite';
import wfetch from '@/lib/http';

const FAUCET_RPC_URL = process.env.NEXT_PUBLIC_FAUCET_ENDPOINT as string;
const MANDATORY_KYC = process.env.NEXT_PUBLIC_MANDATORY_KYC === "true";

const KycStatus = () => {
  const kycStatus = useSessionStore((state) => state.kycStatus);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter()

  const setKycStatus = useSessionStore((state) => state.setKycStatus);

  const { mainWallet } = useWallet();

  const chainWallet = mainWallet?.getChainWallet("nyks");
  const address = chainWallet?.address || "";

  const pathname = usePathname();

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

  useEffect(() => {
    async function autoConnect() {
      if (!address) return;

      if (kycStatus) return;

      const whitelistStatus = await fetchWhitelistStatus(address);

      if (!whitelistStatus) {
        setKycStatus(false);

        if (!MANDATORY_KYC) return;

        if (pathname === "/faucet") {
          router.push("/verify-region");
        }

        return;
      }

      setKycStatus(true);
    }

    autoConnect();
  }, [kycStatus, address]);


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-3 h-3 rounded-full transition-colors cursor-pointer ${kycStatus ? "bg-green-medium" : "bg-red"
            }`}
          aria-label={kycStatus ? "Region Verified" : "Region Unverified"}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onClick={() => router.push("/verify-region")}
        />
      </PopoverTrigger>
      <PopoverContent
        className="px-2 py-0.5 items-center justify-center inline-flex text-xs w-auto bg-background/80 select-none"
        side="bottom"
        align="center"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {kycStatus ? "Verified" : "Unverified"}
      </PopoverContent>
    </Popover>
  );
};

export default KycStatus;
