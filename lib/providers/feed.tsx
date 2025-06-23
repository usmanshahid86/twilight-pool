"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type PriceFeedProviderProps = {
  children: React.ReactNode;
};

type UsePriceFeedProps = {
  feed: number[];
  addPrice: (price: number) => void;
};

const defaultContext: UsePriceFeedProps = {
  feed: [],
  addPrice: () => { },
};

const feedContext = createContext<UsePriceFeedProps | undefined>(undefined);

export const usePriceFeed = () => useContext(feedContext) ?? defaultContext;

export const PriceFeedProvider: React.FC<PriceFeedProviderProps> = (props) => {
  return <PriceFeed {...props} />;
};

const PriceFeed: React.FC<PriceFeedProviderProps> = ({ children }) => {
  const [feed, setFeed] = useState<number[]>([]);

  const addPrice = useCallback<(price: number) => void>(
    (price) => {
      setFeed((currentFeed) => {
        const newFeed = [...currentFeed, price];

        // Keep only the last 2 prices
        if (newFeed.length > 2) {
          newFeed.shift();
        }

        return newFeed;
      });
    },
    []
  );

  const value = useMemo(() => {
    return {
      feed,
      addPrice,
    };
  }, [feed, addPrice]);

  return <feedContext.Provider value={value}>{children}</feedContext.Provider>;
};
