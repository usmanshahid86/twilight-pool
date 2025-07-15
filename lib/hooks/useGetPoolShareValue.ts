import { useQuery } from "@tanstack/react-query";
import { getPoolShareValue } from "../api/rest";

export function useGetPoolShareValue() {
  const query = useQuery({
    queryKey: ["pool-share-value"],
    queryFn: async (): Promise<number> => {
      const result = await getPoolShareValue();

      return result;
    },
    enabled: true,
    refetchInterval: 30000,
    staleTime: 25000,
  });

  return query;
}
