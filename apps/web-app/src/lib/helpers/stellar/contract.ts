export function shortenContractId(
  id: string,
  prefixLength = 5,
  suffixLength = 4
): string {
  if (id.length <= prefixLength + suffixLength) {
    return id;
  }
  const start = id.slice(0, prefixLength);
  const end = id.slice(-suffixLength);
  return `${start}…${end}`;
}
