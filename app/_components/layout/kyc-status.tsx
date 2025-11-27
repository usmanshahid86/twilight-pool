"use client";

import { useState } from "react";
import { useSessionStore } from "@/lib/providers/session";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover";
import { useRouter } from 'next/navigation';
import useVerifyStatus from '@/lib/hooks/useVerifyStatus';


const KycStatus = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter()

  const { isVerified } = useVerifyStatus();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-3 h-3 rounded-full transition-colors cursor-pointer ${isVerified ? "bg-green-medium" : "bg-red"
            }`}
          aria-label={isVerified ? "Region Verified" : "Region Unverified"}
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
        {isVerified ? "Verified" : "Unverified"}
      </PopoverContent>
    </Popover>
  );
};

export default KycStatus;
