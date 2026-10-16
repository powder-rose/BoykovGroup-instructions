import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthToken, selectAuthUser, selectIsRestoringSession } from '../store/authSlice.js';
import { WALLET_UPDATED_EVENT, walletRequest } from '../../public/assets/wallet-client.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WalletBalanceContext = createContext({ balanceMinor: null, priceMinor: null });

export function WalletBalanceProvider({ children }) {
  const token = useSelector(selectAuthToken);
  const user = useSelector(selectAuthUser);
  const isRestoring = useSelector(selectIsRestoringSession);
  const active = !isRestoring && user?.role === 'user' && Boolean(token);
  const [result, setResult] = useState({ token: null, balanceMinor: null, priceMinor: null });
  const requestRef = useRef(null);

  const refreshBalance = useCallback(async () => {
    if (!active) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const wallet = await walletRequest(token, '', {
        baseUrl: API_BASE_URL,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setResult({
          token,
          balanceMinor: Number.isSafeInteger(wallet.balanceMinor) ? wallet.balanceMinor : null,
          priceMinor: Number.isSafeInteger(wallet.priceMinor) ? wallet.priceMinor : null,
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        setResult({ token, balanceMinor: null, priceMinor: null });
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [active, token]);

  useEffect(() => {
    if (!active) return undefined;
    const update = () => void refreshBalance();
    const onWalletUpdated = event => {
      const wallet = event.detail;
      if (Number.isSafeInteger(wallet?.balanceMinor) && Number.isSafeInteger(wallet?.priceMinor)) {
        requestRef.current?.abort();
        setResult({ token, balanceMinor: wallet.balanceMinor, priceMinor: wallet.priceMinor });
      } else {
        update();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };
    update();
    window.addEventListener(WALLET_UPDATED_EVENT, onWalletUpdated);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      requestRef.current?.abort();
      window.removeEventListener(WALLET_UPDATED_EVENT, onWalletUpdated);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active, refreshBalance, token]);

  const current = active && result.token === token;
  return (
    <WalletBalanceContext.Provider
      value={{
        balanceMinor: current ? result.balanceMinor : null,
        priceMinor: current ? result.priceMinor : null,
      }}
    >
      {children}
    </WalletBalanceContext.Provider>
  );
}

export function useWalletBalance() {
  return useContext(WalletBalanceContext);
}
