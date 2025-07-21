"use client";

import { Text } from "@/components/typography";
import Resource from "@/components/resource";
import Skeleton from "@/components/skeleton";
import { useTwilightStore } from "@/lib/providers/store";
import { useSessionStore } from "@/lib/providers/session";
import React from "react";
import { useGetPoolShareValue } from '@/lib/hooks/useGetPoolShareValue';

const PoolInfo = () => {
  const poolInfo = useTwilightStore((state) => state.lend.poolInfo);
  const currentPrice = useSessionStore((state) => state.price.btcPrice);

  const { data: poolShareValue } = useGetPoolShareValue();

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
        <Text className="text-sm text-primary-accent">Pool Share Value (sats)</Text>
        <Resource
          isLoaded={!!poolShareValue}
          placeholder={<Skeleton className="h-6 w-16" />}
        >
          <Text className="text-xl font-semibold">
            {poolShareValue?.toFixed(2) || "0"}
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