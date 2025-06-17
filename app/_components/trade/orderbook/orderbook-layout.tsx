import { useOrderbookData } from "@/lib/hooks/useOrderbookData";
import { OrderBookDataTable } from "./data-table";
import { orderbookColumns } from "./columns";

type Props = {
  layouts: "split" | "asks" | "bids";
};

export function OrderbookLayouts({ layouts }: Props) {
  const { bids, asks, isLoading, error } = useOrderbookData();

  if (error) {
    console.error("Orderbook error:", error);
  }

  switch (layouts) {
    case "split": {
      return (
        <>
          <OrderBookDataTable
            columns={orderbookColumns}
            data={asks}
            type="asks"
            header
          />
          <OrderBookDataTable
            columns={orderbookColumns}
            data={bids}
            type="bids"
          />
        </>
      );
    }
    case "asks": {
      return (
        <OrderBookDataTable
          columns={orderbookColumns}
          data={asks}
          type="asks"
          header
        />
      );
    }
    case "bids": {
      return (
        <OrderBookDataTable
          columns={orderbookColumns}
          data={bids.slice().reverse()}
          type="bids"
          header
        />
      );
    }
  }
}
