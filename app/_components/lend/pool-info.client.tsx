"use client";

import { Text } from "@/components/typography";
import Resource from "@/components/resource";
import Skeleton from "@/components/skeleton";
import { useTwilightStore } from "@/lib/providers/store";
import { useSessionStore } from "@/lib/providers/session";
import React from "react";

const PoolInfo = () => {
  const poolInfo = useTwilightStore((state) => state.lend.poolInfo);
  const currentPrice = useSessionStore((state) => state.price.btcPrice);

  return (
    <div className="flex flex-row flex-wrap gap-6 md:gap-12">
      <div className="flex flex-col">
        <Text className="text-sm text-primary-accent">APY</Text>
        <Resource
          isLoaded={!!poolInfo}
          placeholder={<Skeleton className="h-6 w-16" />}
        >
          <Text className="text-xl font-semibold">
            {poolInfo?.apy?.toFixed(2) || "0.00"}%
          </Text>
        </Resource>
      </div>

      <div className="flex flex-col">
        <Text className="text-sm text-primary-accent">Pool Share</Text>
        <Resource
          isLoaded={!!poolInfo}
          placeholder={<Skeleton className="h-6 w-16" />}
        >
          <Text className="text-xl font-semibold">
            {/* This would be calculated based on user's position vs total pool */}
            0.00%
          </Text>
        </Resource>
      </div>

      <div className="flex flex-col">
        <Text className="text-sm text-primary-accent">TVL</Text>
        <Resource
          isLoaded={!!poolInfo}
          placeholder={<Skeleton className="h-6 w-24" />}
        >
          <Text className="text-xl font-semibold">
            {poolInfo?.tvl_btc?.toLocaleString() || "0"} BTC
          </Text>
        </Resource>
      </div>

      <div className="flex flex-col">
        <Text className="text-sm text-primary-accent">BTC Price</Text>
        <Resource
          isLoaded={!!currentPrice}
          placeholder={<Skeleton className="h-6 w-20" />}
        >
          <Text className="text-xl font-semibold">
            ${currentPrice?.toLocaleString() || "0"}
          </Text>
        </Resource>
      </div>
    </div>
  );
};

export default PoolInfo; 