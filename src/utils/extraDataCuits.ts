/**
 * Returns the subset of CUITs for which ExtraData should be fetched:
 * only those where at least one BCRA endpoint (debts or cheques) returned successfully.
 */
export function getExtraDataCuits<D, C>(
  cuits: string[],
  debtSettled: PromiseSettledResult<D>[],
  checksSettled: PromiseSettledResult<C>[],
): string[] {
  return cuits.filter((_, i) =>
    debtSettled[i]?.status === 'fulfilled' || checksSettled[i]?.status === 'fulfilled'
  );
}
