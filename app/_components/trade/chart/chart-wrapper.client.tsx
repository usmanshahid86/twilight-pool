"use client";
import React, { useCallback, useRef, useState } from "react";
import Chart from "./chart.client";
import Series from "./series.client";
import { ISeriesApi, UTCTimestamp } from "lightweight-charts";
import useWebSocket from "@/lib/hooks/useWebsocket";
import { CandleData, getCandleData } from "@/lib/api/rest";
import { usePriceFeed } from "@/lib/providers/feed";
import { CandleInterval } from "@/lib/types";
import dayjs, { ManipulateType } from "dayjs";
import utc from "dayjs/plugin/utc";
import cn from "@/lib/cn";
dayjs.extend(utc);

type ContainerRef = HTMLElement | null;

type BinanceKlineCandleData = {
  e: "kline";     // Event type
  E: number;      // Event time (ms timestamp)
  s: string;      // Symbol
  k: {
    t: number;    // Kline start time (ms timestamp)
    T: number;    // Kline close time (ms timestamp)
    s: string;    // Symbol
    i: string;    // Interval (e.g., "1m")
    f: number;    // First trade ID
    L: number;    // Last trade ID
    o: string;    // Open price
    c: string;    // Close price
    h: string;    // High price
    l: string;    // Low price
    v: string;    // Base asset volume
    n: number;    // Number of trades
    x: boolean;   // Is this kline closed?
    q: string;    // Quote asset volume
    V: string;    // Taker buy base asset volume
    Q: string;    // Taker buy quote asset volume
    B: string;    // Ignore
  };
}

type CandlestickData = {
  btc_volume: string;
  close: string;
  end: string;
  high: string;
  low: string;
  open: string;
  resolution: string;
  start: string;
  updated_at: string;
  trades: number;
};

type Props = {
  candleData: CandleData[];
};

const TIME_INTERVALS: {
  name: string;
  id: CandleInterval;
  offset: { unit: ManipulateType; amount: number };
}[] = [
    {
      id: CandleInterval.ONE_MINUTE,
      name: "1m",
      offset: {
        unit: "minute",
        amount: 720,
      },
    },
    {
      id: CandleInterval.FIFTEEN_MINUTE,
      name: "15m",
      offset: {
        unit: "minute",
        amount: 10800,
      },
    },
    {
      id: CandleInterval.FOUR_HOUR,
      name: "4h",
      offset: {
        unit: "hour",
        amount: 720,
      },
    },
    {
      id: CandleInterval.ONE_DAY,
      name: "24h",
      offset: {
        unit: "day",
        amount: 90,
      },
    },
  ];


const ChartWrapper = ({ candleData }: Props) => {
  const { addPrice } = usePriceFeed();

  const [container, setContainer] = useState<ContainerRef>(null);
  const handleRef = useCallback((ref: ContainerRef) => setContainer(ref), []);

  const [timeInterval, setTimeInterval] = useState<CandleInterval>(
    CandleInterval.ONE_MINUTE
  );

  const seriesRef = useRef<ISeriesApi<"Candlestick">>(null);

  const onOpen = useCallback(() => {
    console.log("candle feed opened");
  }, []);

  const onMessage = useCallback((event: MessageEvent) => {
    try {
      if (!seriesRef.current || seriesRef.current === null) {
        return;
      }

      const parsedMessage = JSON.parse(event.data);

      const candleStickData = parsedMessage.k;

      const time = dayjs
        .utc(candleStickData.T)
        .unix();

      const localTimezoneOffset = new Date().getTimezoneOffset() * 60;
      const currentMinuteInMs = (time - localTimezoneOffset) as UTCTimestamp;

      const { close, open, high, low } = {
        close: parseFloat(candleStickData.c),
        open: parseFloat(candleStickData.o),
        high: parseFloat(candleStickData.h),
        low: parseFloat(candleStickData.l),
      };

      const dataToUpdate = {
        close: close,
        open: open,
        high: high,
        low: low,
        time: currentMinuteInMs as UTCTimestamp,
      }

      addPrice(close);
      seriesRef.current.update(dataToUpdate)
    } catch (err) {
      console.error(err)
    }
  }, [addPrice]);

  const onClose = useCallback(() => {
    console.log("candle feed closed");
  }, []);

  const intervalSymbol = TIME_INTERVALS.find(item => item.id === timeInterval)?.name;

  const { reconnect } = useWebSocket({
    url: intervalSymbol ? `wss://stream.binance.com/ws/btcusdt@kline_${intervalSymbol}` : '',
    onOpen,
    onMessage,
    onClose,
  });

  return (
    <div>
      <div className="flex h-[40px] w-full border-b bg-background/40">
        {TIME_INTERVALS.map((item) => (
          <button
            className={cn(
              "border-r px-4 text-sm text-primary/80 hover:text-theme",
              timeInterval === item.id && "text-theme"
            )}
            key={item.name}
            onClick={async (e) => {
              e.preventDefault();

              if (timeInterval === item.id) return;

              setTimeInterval(item.id);

              try {
                const timeOffset = dayjs().subtract(
                  item.offset.amount,
                  item.offset.unit
                );

                const candleDataResponse = await getCandleData({
                  since: timeOffset.toISOString(),
                  interval: item.id,
                  limit: 1000,
                });

                const fetchedCandleData = candleDataResponse.success
                  ? candleDataResponse.data.result
                  : [];

                fetchedCandleData.sort(
                  (left, right) =>
                    Date.parse(left.end) / 1000 - Date.parse(right.end) / 1000
                );

                const chartData = fetchedCandleData.map((candle) => {
                  const unixTime = Math.floor(
                    Date.parse(candle.start) / 1000
                  ) as UTCTimestamp;

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

                if (seriesRef.current) {
                  seriesRef.current.setData(chartData);
                }

                reconnect();
              } catch (err) {
                console.log("cleanup err", err);
              }
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div ref={handleRef}>
        {container && (
          <Chart container={container} interval={timeInterval} setInterval={setTimeInterval}>
            <Series data={candleData} ref={seriesRef} />
          </Chart>
        )}
      </div>
    </div>
  );
};

export default ChartWrapper;
