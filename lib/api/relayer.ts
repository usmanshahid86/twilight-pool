import dayjs from "dayjs";
import wfetch from "../http";
import { createCancelTraderOrderMsg } from "../twilight/zkos";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_ENDPOINT as string;
const RELAYER_PUBLIC_URL = process.env
  .NEXT_PUBLIC_TWILIGHT_PRICE_REST as string;

async function queryLendOrder(lendData: string) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "QueryLendOrderZkos",
    params: {
      data: lendData,
    },
    id: 1,
  });

  const { success, data, error } = await wfetch(RELAYER_URL)
    .post({ body })
    .json<Record<string, any>>();

  if (!success) {
    console.error(error);
    return {};
  }

  return data;
}

async function cancelTradeOrder({
  address,
  uuid,
  signature,
}: {
  address: string;
  uuid: string;
  signature: string;
}) {
  const msg = await createCancelTraderOrderMsg({
    address,
    signature,
    uuid,
  });

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "cancel_trader_order",
    params: {
      data: msg,
    },
    id: 1,
  });

  const { success, data, error } = await wfetch(RELAYER_PUBLIC_URL)
    .post({ body })
    .json<Record<string, any>>();

  if (!success) {
    console.error("cancel trade order error", error);
    return {};
  }

  return data;
}

async function queryTradeOrder(msg: string) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "trader_order_info",
    params: {
      data: msg,
    },
    id: 1,
  });

  const { success, data, error } = await wfetch(RELAYER_PUBLIC_URL, {
    headers: {
      "date-time": dayjs().unix().toString(),
      "Content-Type": "application/json",
    },
  })
    .post({ body })
    .json<Record<string, any>>();

  if (!success) {
    console.error(error);
    return null;
  }

  return data as {
    jsonrpc: "2.0";
    result: {
      account_id: string;
      available_margin: string;
      bankruptcy_price: string;
      bankruptcy_value: string;
      entry_nonce: number;
      entry_sequence: number;
      entryprice: string;
      execution_price: string;
      exit_nonce: number;
      id: number;
      initial_margin: string;
      leverage: string;
      liquidation_price: string;
      maintenance_margin: string;
      order_status: string;
      order_type: string;
      position_type: string;
      positionsize: string;
      settlement_price: string;
      timestamp: string;
      unrealized_pnl: string;
      uuid: string;
      fee_filled: string;
      fee_settled: string;
    };
    id: number;
  };
}

export { queryLendOrder, queryTradeOrder, cancelTradeOrder };
