"use client";
import React, {
  forwardRef,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useEffect,
} from "react";
import { chartContext } from "./chart.client";
import { CandlestickSeries, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { CandleData, getCandleData } from "@/lib/api/rest";
import dayjs, { ManipulateType } from 'dayjs';
import { CandleInterval } from '@/lib/types';

type Props = {
  data: CandleData[];
  children?: React.ReactNode;
};

type SeriesApi = {
  _api?: ISeriesApi<"Candlestick">;
  api: () => ISeriesApi<"Candlestick"> | void;
  free: () => void;
  lastUpdatedTime: number;
  loadingHistoricalData: boolean;
  debounceTimer?: NodeJS.Timeout;
};

const intervalToOffset: Record<CandleInterval, { unit: ManipulateType; amount: number }> = {
  [CandleInterval.ONE_MINUTE]: {
    unit: "minute",
    amount: 720,
  },
  [CandleInterval.FIVE_MINUTE]: {
    unit: "minute",
    amount: 720,
  },
  [CandleInterval.FIFTEEN_MINUTE]: {
    unit: "day",
    amount: 7,
  },
  [CandleInterval.ONE_HOUR]: {
    unit: "day",
    amount: 7,
  },
  [CandleInterval.FOUR_HOUR]: {
    unit: "day",
    amount: 7,
  },
  [CandleInterval.EIGHT_HOUR]: {
    unit: "day",
    amount: 7,
  },
  [CandleInterval.TWELVE_HOUR]: {
    unit: "day",
    amount: 7,
  },
  [CandleInterval.ONE_DAY]: {
    unit: "day",
    amount: 14,
  },
  [CandleInterval.ONE_DAY_CHANGE]: {
    unit: "day",
    amount: 1,
  },
}

const Series = forwardRef<ISeriesApi<"Candlestick"> | void, Props>(
  (props, ref) => {
    const { children, data } = props;
    const parent = useContext(chartContext);

    // Use a ref to store the current interval so the listener can access the latest value
    const currentIntervalRef = useRef<CandleInterval>(parent.interval);

    const context = useRef<SeriesApi>({
      lastUpdatedTime: 0,
      _api: undefined,
      loadingHistoricalData: false,
      debounceTimer: undefined,
      api() {
        if (!this._api) {
          if (!parent._api) {
            parent.api();
          }

          console.log("series calling parent._api", parent._api);

          this._api = parent._api?.addSeries(CandlestickSeries, {
            upColor: "#5FDB66",
            downColor: "#F84952",
            wickUpColor: "#5FDB66",
            wickDownColor: "#F84952",
          });

          parent._api?.timeScale().subscribeVisibleLogicalRangeChange((newVisibleLogicalRange) => {
            if (!newVisibleLogicalRange) return;

            const barsInfo = this._api?.barsInLogicalRange(newVisibleLogicalRange)

            const currentData = this._api?.data() || [];

            if (!barsInfo) return;

            // Clear existing debounce timer
            if (this.debounceTimer) {
              clearTimeout(this.debounceTimer);
            }

            // Set up debounced API call (300ms delay)
            this.debounceTimer = setTimeout(async () => {
              // Prevent multiple simultaneous requests
              if (this.loadingHistoricalData) return;

              if (barsInfo !== null && barsInfo.barsBefore < 50) {
                this.loadingHistoricalData = true;
                // try to load additional historical data and prepend it to the series data
                console.log("barsInfo", barsInfo)

                const localTimezoneOffset = new Date().getTimezoneOffset() * 60;

                const sinceInMs = (barsInfo.from as number) + localTimezoneOffset

                // Use the current interval from the ref instead of the captured value
                const currentInterval = currentIntervalRef.current;
                const interval = intervalToOffset[currentInterval]
                const since = dayjs.unix(sinceInMs).subtract(interval.amount, interval.unit).toISOString();

                console.log(currentInterval)
                const candleDataResponse = await getCandleData({
                  since,
                  interval: currentInterval,
                  limit: 1000,
                })

                if (!candleDataResponse.success || candleDataResponse.error) {
                  console.error("Error fetching historical candle data:", candleDataResponse.error);
                  return;
                }

                const candleData = candleDataResponse.data.result;

                // Transform the new candle data to match the chart format
                const newChartData = candleData.map((candle: CandleData) => {
                  const unixTime = Math.floor(
                    Date.parse(candle.start) / 1000
                  );

                  const localTimezoneOffset = new Date().getTimezoneOffset() * 60;
                  const time = (unixTime - localTimezoneOffset) as UTCTimestamp;

                  return {
                    close: parseFloat(candle.close),
                    open: parseFloat(candle.open),
                    high: parseFloat(candle.high),
                    low: parseFloat(candle.low),
                    time,
                  };
                });

                // Create a Map to handle duplicates - later entries will overwrite earlier ones
                const dataMap = new Map();

                // First add new historical data
                newChartData.forEach(item => {
                  dataMap.set(item.time, item);
                });

                // Then add current data (this will overwrite any duplicates, keeping current data)
                currentData.forEach(item => {
                  dataMap.set(item.time, item);
                });

                // Convert back to array and sort by time
                const mergedData = Array.from(dataMap.values()).sort((a, b) => (a.time as number) - (b.time as number));

                // Set the merged data
                this._api?.setData(mergedData);

                // Reset loading flag
                this.loadingHistoricalData = false;
              }
            }, 300); // 300ms debounce delay
          });

          const chartData = data.map((candleData) => {
            const unixTime = Math.floor(
              Date.parse(candleData.start) / 1000
            );

            const localTimezoneOffset = new Date().getTimezoneOffset() * 60;
            const time = (unixTime - localTimezoneOffset) as UTCTimestamp;

            return {
              close: parseFloat(candleData.close),
              open: parseFloat(candleData.open),
              high: parseFloat(candleData.high),
              low: parseFloat(candleData.low),
              time,
            };
          });

          this._api?.setData(chartData);

          parent._api?.timeScale().setVisibleLogicalRange({ from: chartData.length - 50, to: chartData.length });
          // console.log(this._api?.data());
        }
        return this._api;
      },
      free() {
        // Clear debounce timer on cleanup
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        if (this._api) {
          parent.free();
        }
      },
    });

    useLayoutEffect(() => {
      const currentRef = context.current;
      currentRef.api();

      return () => currentRef.free();
    }, []);

    // Update the interval ref whenever the parent interval changes
    useEffect(() => {
      currentIntervalRef.current = parent.interval;
    }, [parent.interval]);

    useImperativeHandle(ref, () => context.current.api(), []);

    return <>{children}</>;
  }
);

Series.displayName = "Series";

export default Series;
