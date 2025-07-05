import { TradeOrder } from "@/lib/types";
import { AccountSlices, StateImmerCreator } from "../utils";

export interface TradeHistorySlice {
  trades: TradeOrder[];
  addTrade: (tradeOrder: TradeOrder) => void;
  removeTrade: (tradeOrder: TradeOrder) => void;
  updateTrade: (tradeOrder: TradeOrder) => void;
  setNewTrades: (trades: TradeOrder[]) => void;
  resetState: () => void;
}

export const initialTradeHistorySliceState = {
  trades: [],
};

export const createTradeHistorySlice: StateImmerCreator<
  AccountSlices,
  TradeHistorySlice
> = (set) => ({
  ...initialTradeHistorySliceState,
  addTrade: (tradeOrder) =>
    set((state) => {
      state.trade_history.trades = [...state.trade_history.trades, tradeOrder];
    }),
  removeTrade: (tradeOrder) =>
    set((state) => {
      state.trade_history.trades = state.trade_history.trades.map((trade) => {
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
      const tradeExists = state.trade_history.trades.some(
        (trade) => trade.uuid === tradeOrder.uuid
      );

      if (tradeExists) {
        state.trade_history.trades = state.trade_history.trades.map((trade) => {
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
      state.trade_history = {
        ...state.trade_history,
        ...initialTradeHistorySliceState,
      };
    });
  },
  setNewTrades: (trades) => {
    set((state) => {
      const currentTrades = state.trade_history.trades;

      const newLocalTrades = currentTrades.filter(
        (currentTrade) =>
          !trades.some(
            (incomingTrade) => incomingTrade.uuid === currentTrade.uuid
          )
      );

      state.trade_history.trades = [...trades, ...newLocalTrades];
    });
  },
});
