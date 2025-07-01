import { TradeOrder } from "@/lib/types";
import { AccountSlices, StateImmerCreator } from "../utils";

export interface TradeSlice {
  trades: TradeOrder[];
  addTrade: (tradeOrder: TradeOrder) => void;
  removeTrade: (tradeOrder: TradeOrder) => void;
  updateTrade: (tradeOrder: TradeOrder) => void;
  resetState: () => void;
}

export const initialTradeSliceState = {
  trades: [],
};

export const createTradeSlice: StateImmerCreator<AccountSlices, TradeSlice> = (
  set
) => ({
  ...initialTradeSliceState,
  addTrade: (tradeOrder) =>
    set((state) => {
      state.trade.trades = [...state.trade.trades, tradeOrder];
    }),
  removeTrade: (tradeOrder) =>
    set((state) => {
      state.trade.trades = state.trade.trades.map((trade) => {
        if (trade.uuid === tradeOrder.uuid) {
          return {
            ...trade,
            isOpen: false,
          };
        }
        return trade;
      });
    }),
  updateTrade: (tradeOrder) =>
    set((state) => {
      const tradeExists = state.trade.trades.some(
        (trade) => trade.uuid === tradeOrder.uuid
      );

      if (tradeExists) {
        state.trade.trades = state.trade.trades.map((trade) => {
          if (trade.uuid === tradeOrder.uuid) {
            return {
              ...trade,
              ...tradeOrder,
            };
          }
          return trade;
        });
      }
    }),
  resetState: () => {
    set((state) => {
      state.trade = {
        ...state.trade,
        ...initialTradeSliceState,
      };
    });
  },
});
