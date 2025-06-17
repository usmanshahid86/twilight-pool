import { useQuery } from "@tanstack/react-query";
import { queryTransactionHashes, TransactionHash } from "../api/rest";
import { TwilightApiResponse } from "../types";

export function useUserTrades(addresses: string[] = []) {
  const query = useQuery({
    queryKey: ["user-trades", addresses],
    queryFn: async (): Promise<Record<string, TransactionHash[]>> => {
      const result: Record<string, TransactionHash[]> = {};

      // Fetch transaction hashes for each address
      await Promise.all(
        addresses.map(async (address) => {
          const response = await queryTransactionHashes(address);

          // Handle the response - it can be either empty object or TwilightApiResponse
          if (
            response &&
            typeof response === "object" &&
            "result" in response
          ) {
            const twilightResponse = response as TwilightApiResponse<
              TransactionHash[]
            >;
            result[address] = twilightResponse.result || [];
          } else {
            result[address] = [];
          }
        })
      );

      return result;
    },
    enabled: addresses.length > 0, // Only run query if we have addresses
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
  });

  return query;
}
