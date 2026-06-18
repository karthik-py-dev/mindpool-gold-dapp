import type { WalletState } from '../types';

declare global {
  interface Window {
    tronWeb?: {
      defaultAddress?: { base58?: string };
      fullNode?: { host?: string };
      ready?: boolean;
    };
    tronLink?: {
      request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
    };
  }
}

const EMPTY_WALLET: WalletState = {
  connected: false,
  address: '',
  network: 'Not connected',
  isDemo: false
};

export function getSavedWallet(): WalletState {
  const saved = localStorage.getItem('mindpool_wallet');
  if (!saved) return EMPTY_WALLET;
  try {
    return JSON.parse(saved) as WalletState;
  } catch {
    return EMPTY_WALLET;
  }
}

export function saveWallet(wallet: WalletState) {
  localStorage.setItem('mindpool_wallet', JSON.stringify(wallet));
}

export function clearWallet() {
  localStorage.removeItem('mindpool_wallet');
}

export async function connectTronLink(): Promise<WalletState> {
  if (!window.tronLink || !window.tronWeb) {
    const demoWallet = makeDemoWallet();
    saveWallet(demoWallet);
    return demoWallet;
  }

  try {
    await window.tronLink.request?.({ method: 'tron_requestAccounts' });
    const address = window.tronWeb.defaultAddress?.base58;
    if (!address) throw new Error('TronLink did not return an address.');

    const network = getNetworkName(window.tronWeb.fullNode?.host ?? 'Unknown network');
    const wallet: WalletState = {
      connected: true,
      address,
      network,
      isDemo: false
    };
    saveWallet(wallet);
    return wallet;
  } catch (error) {
    console.warn('TronLink connect failed. Falling back to demo wallet:', error);
    const demoWallet = makeDemoWallet();
    saveWallet(demoWallet);
    return demoWallet;
  }
}

export function makeDemoWallet(): WalletState {
  const existing = localStorage.getItem('mindpool_demo_wallet');
  const address = existing || `DEMO_T${Math.random().toString(36).slice(2, 9).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
  localStorage.setItem('mindpool_demo_wallet', address);
  return {
    connected: true,
    address,
    network: 'Demo / Shasta Testnet Simulation',
    isDemo: true
  };
}

function getNetworkName(host: string): string {
  const lower = host.toLowerCase();
  if (lower.includes('shasta')) return 'Shasta Testnet';
  if (lower.includes('nile')) return 'Nile Testnet';
  if (lower.includes('trongrid')) return 'Mainnet detected - switch to testnet';
  return host;
}
