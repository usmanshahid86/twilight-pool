import { useQuery } from "@tanstack/react-query";
import { getOpenLimitOrders } from "@/lib/api/rest";
import {
  DisplayLimitOrderData,
  LimitChange,
  LimitOrderData,
} from "@/lib/types";
import { useRef } from "react";

function convertDisplayLimitData(
  limitData: LimitOrderData[],
  currentData: DisplayLimitOrderData[],
  sort: boolean
): DisplayLimitOrderData[] {
  const sorted = limitData.sort((left, right) =>
    sort ? left.price - right.price : right.price - left.price
  );

  if (currentData.length < 1) {
    return sorted.map((order) => {
      return {
        price: order.price,
        size: order.positionsize,
        change: LimitChange.EQUAL,
      };
    });
  }

  return sorted.map((order, index) => {
    // current data should have same sorting
    const oldPrice = currentData[index]
      ? currentData[index].price
      : order.price;

    return {
      price: order.price,
      size: order.positionsize,
      change:
        oldPrice === order.price
          ? LimitChange.EQUAL
          : order.price > oldPrice
          ? LimitChange.INCREASE
          : LimitChange.DECREASE,
    };
  });
}

export function useOrderbookData() {
  // Use refs to store previous data for change calculation
  const previousBidsRef = useRef<DisplayLimitOrderData[]>([]);
  const previousAsksRef = useRef<DisplayLimitOrderData[]>([]);

  const query = useQuery({
    queryKey: ["orderbook"],
    queryFn: async () => {
      const result = await getOpenLimitOrders();

      if (!result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to fetch orderbook data"
        );
      }

      return result.data.result;
    },
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 4000, // Consider data stale after 4 seconds
  });

  // Process the data when available
  const processedData = query.data
    ? {
        bids: convertDisplayLimitData(
          query.data.bid,
          previousBidsRef.current,
          false
        ),
        asks: convertDisplayLimitData(
          query.data.ask,
          previousAsksRef.current,
          false
        ),
      }
    : {
        bids: [],
        asks: [],
      };

  // Update refs after processing
  if (query.data) {
    previousBidsRef.current = processedData.bids;
    previousAsksRef.current = processedData.asks;
  }

  return {
    ...query,
    data: processedData,
    bids: processedData.bids,
    asks: processedData.asks,
  };
}
