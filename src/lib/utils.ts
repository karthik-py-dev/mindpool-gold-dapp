export function formatCoins(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(value);
}

export function shortAddress(address: string): string {
  if (!address) return 'Not connected';
  if (address.startsWith('DEMO')) return address;
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

export function makeId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clampAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value * 100) / 100;
}
