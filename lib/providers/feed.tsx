"use client";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";

type PriceFeedProviderProps = {
  children: React.ReactNode;
};

type PriceUpdateCallback = () => void;

type UsePriceFeedProps = {
  feed: number[];
  addPrice: (price: number) => void;
  getCurrentPrice: () => number;
  subscribe: (callback: PriceUpdateCallback) => () => void;
};

const defaultContext: UsePriceFeedProps = {
  feed: [],
  addPrice: () => { },
  getCurrentPrice: () => 0,
  subscribe: () => () => { },
};

const feedContext = createContext<UsePriceFeedProps | undefined>(undefined);

export const usePriceFeed = () => useContext(feedContext) ?? defaultContext;

export const PriceFeedProvider: React.FC<PriceFeedProviderProps> = (props) => {
  return <PriceFeed {...props} />;
};

const PriceFeed: React.FC<PriceFeedProviderProps> = ({ children }) => {
  const feedRef = useRef<number[]>([]);
  const subscribersRef = useRef<Set<PriceUpdateCallback>>(new Set());

  const addPrice = useCallback<(price: number) => void>(
    (price) => {
      const newFeed = [...feedRef.current, price];

      // Keep only the last 2 prices
      if (newFeed.length > 2) {
        newFeed.shift();
      }

      feedRef.current = newFeed;

      // Notify all subscribers
      subscribersRef.current.forEach(callback => callback());
    },
    []
  );

  const getCurrentPrice = useCallback(() => {
    return feedRef.current.length > 1 ? feedRef.current[feedRef.current.length - 1] : 0;
  }, []);

  const subscribe = useCallback((callback: PriceUpdateCallback) => {
    subscribersRef.current.add(callback);

    // Return unsubscribe function
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const value = useMemo(() => {
    return {
      feed: feedRef.current,
      addPrice,
      getCurrentPrice,
      subscribe,
    };
  }, [addPrice, getCurrentPrice, subscribe]);

  return <feedContext.Provider value={value}>{children}</feedContext.Provider>;
};
