"use client";

import { Check, X } from "lucide-react";
import { useSessionStore } from "@/lib/providers/session";
import cn from "@/lib/cn";

const KycStatus = () => {
  const kycStatus = useSessionStore((state) => state.kycStatus);

  return (
    <div className="flex items-center space-x-1">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full",
          kycStatus
            ? "text-green"
            : "text-red"
        )}
      >
        {kycStatus ? (
          <Check className="h-4 w-4" />
        ) : (
          <X className="h-4 w-4" />
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          kycStatus
            ? "text-green"
            : "text-red"
        )}
      >
        {kycStatus ? "Verified" : "Not Verified"}
      </span>
    </div>
  );
};

export default KycStatus;
