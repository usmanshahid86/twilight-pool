import { z } from "zod";

export const ZkAccountSchema = z.object({
  tag: z.string(),
  address: z.string(),
  scalar: z.string(),
  type: z.literal("Coin").or(z.literal("Memo")),
  isOnChain: z.boolean().optional(),
  value: z.number().optional(), // note: sats value
});

export const TradeOrderSchema = z.object({
  accountAddress: z.string(),
  value: z.number(),
  uuid: z.string(),
  orderStatus: z.string(),
  orderType: z.string(),
  output: z.string().optional(),
  tx_hash: z.string(),
  positionType: z.string(),
  entryPrice: z.number(),
  leverage: z.number(),
  date: z.date(),
  isOpen: z.boolean(),
  realizedPnl: z.number().optional(),
  unrealizedPnl: z.number().optional(),
});

export const LendOrderSchema = z.object({
  accountAddress: z.string(),
  value: z.number(),
  uuid: z.string(),
  orderStatus: z.string(),
});

export const TransactionHistorySchema = z.object({
  from: z.string(),
  to: z.string(),
  fromTag: z.string(),
  toTag: z.string(),
  tx_hash: z.string(),
  value: z.number(),
  date: z.date(),
  type: z.string(),
});
