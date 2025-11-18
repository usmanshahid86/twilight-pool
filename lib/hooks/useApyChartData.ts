import { useQuery } from "@tanstack/react-query";
import wfetch from "../http";

const RELAYER_URL = "https://relayer.twilight.rest/api";

export type ApyChartRange = "24 hours" | "7 days" | "30 days";
export type ApyChartStep =
  | "1 minute"
  | "5 minutes"
  | "15 minutes"
  | "30 minutes"
  | "1 hour"
  | "2 hours"
  | "4 hours"
  | "12 hours";
export type ApyChartLookback = "24 hours" | "7 days" | "30 days";

export interface ApyChartParams {
  range: ApyChartRange;
  step: ApyChartStep;
  lookback: ApyChartLookback;
}

export interface ApyChartDataPoint {
  time: number;
  value: number;
}

export interface ApyChartResponse {
  jsonrpc: string;
  id: number;
  result?: ApyChartDataPoint[];
  error?: {
    code: number;
    message: string;
  };
}

async function fetchApyChartData(
  params: ApyChartParams
): Promise<ApyChartDataPoint[]> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "apy_chart",
    id: 123,
    params: {
      range: params.range,
      step: params.step,
      lookback: params.lookback,
    },
  });

  const { success, data, error } = await wfetch(RELAYER_URL)
    .post({ body })
    .json<ApyChartResponse>();

  if (!success) {
    console.error("Failed to fetch APY chart data:", error);
    throw new Error("Failed to fetch APY chart data");
  }

  if (data.error) {
    console.error("APY chart API error:", data.error);
    throw new Error(data.error.message || "APY chart API error");
  }

  if (!data.result) {
    console.warn("No APY chart data received");
    return [];
  }

  return data.result;
}

export function useApyChartData(params: ApyChartParams) {
  return useQuery({
    queryKey: ["apyChart", params.range, params.step, params.lookback],
    queryFn: () => fetchApyChartData(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
