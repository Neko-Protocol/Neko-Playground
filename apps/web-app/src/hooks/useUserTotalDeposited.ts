export function useUserTotalDeposited(_userAddress: string | undefined) {
  return {
    data: { totalUsd: 0, positionCount: 0 },
    isLoading: false,
    error: null,
  };
}
