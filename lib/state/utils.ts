import { StateCreator } from "zustand";
import { ZkAccountSlice } from "./local/accounts";
import { LendSlice } from "./local/lend";
import { TradeSlice } from "./local/trade";
import { TradeSessionSlice } from "./session/trade";
import { HistorySlice } from "./local/history";
import { PriceSlice } from "./session/price";
import { TradeHistorySlice } from "./local/trade-history";

export interface AccountSlices {
  zk: ZkAccountSlice;
  lend: LendSlice;
  trade: TradeSlice;
  history: HistorySlice;
  trade_history: TradeHistorySlice;
}

export interface SessionSlices {
  trade: TradeSessionSlice;
  twilightAddress: string;
  privateKey: string;
  setPrivateKey: (privateKey: string) => void;
  price: PriceSlice;
  kycStatus: boolean;
  setKycStatus: (kycStatus: boolean) => void;
}

export type StateImmerCreator<SlicesT, SliceT> = StateCreator<
  SlicesT,
  [["zustand/immer", never]],
  [],
  SliceT
>;
