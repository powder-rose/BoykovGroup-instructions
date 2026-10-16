import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCloudPayments } from '../../lib/cloudPayments.js';
import {
  walletRequest,
  walletPaymentUrl,
  downloadPurchasedInstruction,
  notifyWalletUpdated,
} from '../../../public/assets/wallet-client.js';

const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

export default function useWalletCheckout(token, instructionId, initialTopupId) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [pendingId, setPendingId] = useState(initialTopupId || '');
  const lifeRef = useRef(null);
  const readingRef = useRef(null);
  const operationRef = useRef(false);
  const requestRef = useRef(null);
  const api = useCallback(
    (endpoint, options = {}) =>
      walletRequest(token, endpoint, { baseUrl, signal: lifeRef.current?.signal, ...options }),
    [token],
  );

  const refresh = useCallback(async () => {
    readingRef.current?.abort();
    const controller = new AbortController();
    readingRef.current = controller;
    try {
      const result = await api(
        `/checkout${instructionId ? `?instructionId=${encodeURIComponent(instructionId)}` : ''}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted && !lifeRef.current?.signal.aborted) setData(result);
      return result;
    } catch (error) {
      if (!controller.signal.aborted && !lifeRef.current?.signal.aborted)
        setNotice({ type: 'error', text: error.message });
      return null;
    }
  }, [api, instructionId]);

  useEffect(() => {
    const controller = new AbortController();
    lifeRef.current = controller;
    void refresh();
    const focus = () => {
      if (!operationRef.current) void refresh();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') focus();
    };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => {
      controller.abort();
      readingRef.current?.abort();
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);

  async function perform(kind, action) {
    if (operationRef.current) return;
    operationRef.current = true;
    setBusy(kind);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      if (!lifeRef.current?.signal.aborted)
        setNotice({
          type: 'error',
          text:
            error.name === 'AbortError'
              ? 'Ответ задерживается. Проверьте баланс перед повторной оплатой.'
              : error.message,
        });
    } finally {
      operationRef.current = false;
      if (!lifeRef.current?.signal.aborted) {
        setBusy('');
        await refresh();
      }
    }
  }

  const verify = useCallback(
    async (id, transactionId) => {
      const result = await api(`/topups/${encodeURIComponent(id)}/confirm`, {
        body: transactionId ? { transactionId } : {},
      });
      if (lifeRef.current?.signal.aborted) return result;
      readingRef.current?.abort();
      setData(previous => (previous ? { ...previous, wallet: result.wallet } : previous));
      if (result.topup.status === 'paid') {
        notifyWalletUpdated(result.wallet);
        setPendingId('');
        requestRef.current = null;
        window.history.replaceState(window.history.state, '', walletPaymentUrl(instructionId));
        setNotice({
          type: 'success',
          text:
            result.topup.creditedMinor > 0
              ? 'Баланс пополнен. Теперь можно купить инструкцию.'
              : 'Этот платёж возвращён. Актуальный баланс указан ниже.',
        });
      } else if (result.topup.status === 'declined' || result.topup.status === 'expired') {
        setPendingId('');
        requestRef.current = null;
        window.history.replaceState(window.history.state, '', walletPaymentUrl(instructionId));
        setNotice({
          type: 'error',
          text:
            result.topup.status === 'expired'
              ? 'Срок оплаты истёк. Если деньги списались, обратитесь в поддержку; если нет — начните новое пополнение.'
              : 'Платёж не прошёл. Можно попробовать ещё раз.',
        });
      } else {
        setNotice({
          type: 'info',
          text: 'Пока ждём подтверждение платежа. Если деньги уже списались, не оплачивайте повторно — нажмите «Проверить оплату» чуть позже.',
        });
      }
      return result;
    },
    [api, instructionId],
  );

  useEffect(() => {
    if (!pendingId) return undefined;
    let stopped = false;
    let timer;
    let attempt = 0;
    const delays = [1000, 3000, 7000, 15000, 30000, 60000];
    const poll = async () => {
      if (stopped || lifeRef.current?.signal.aborted) return;
      if (operationRef.current) {
        timer = window.setTimeout(poll, 1000);
        return;
      }
      try {
        const result = await verify(pendingId);
        if (result.topup.status !== 'pending') return;
      } catch {
        // Manual retry stays available if the provider or network is temporarily unavailable.
      }
      attempt += 1;
      if (!stopped && attempt < delays.length) timer = window.setTimeout(poll, delays[attempt]);
    };
    timer = window.setTimeout(poll, delays[0]);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [pendingId, verify]);

  const checkPayment = id => perform('confirm', () => verify(id || pendingId));

  const topup = (amountMinor, consent) =>
    perform('topup', async () => {
      // Load the provider before creating an order, so a blocked script does not leave a payment attempt.
      const cp = await loadCloudPayments();
      if (lifeRef.current?.signal.aborted) return;
      if (!requestRef.current || requestRef.current.amountMinor !== amountMinor)
        requestRef.current = { amountMinor, requestId: crypto.randomUUID() };
      const order = await api('/topups', { body: { ...requestRef.current, ...consent } });
      if (lifeRef.current?.signal.aborted) return;
      if (order.status === 'expired') {
        requestRef.current = null;
        throw new Error(
          'Срок этого платежа истёк. Нажмите «Пополнить» ещё раз, чтобы создать новый.',
        );
      }
      if (order.status === 'paid') {
        await verify(order.id);
        return;
      }
      setPendingId(order.id);
      const returnUrl = new URL(walletPaymentUrl(instructionId, order.id), window.location.origin)
        .href;
      window.history.replaceState(window.history.state, '', returnUrl);
      const widget = new cp.CloudPayments();
      const result = await widget.start({
        publicTerminalId: order.publicTerminalId,
        description: 'Пополнение баланса для покупки инструкций БОЙКОВГРУПП',
        paymentSchema: 'Single',
        amount: order.amountMinor / 100,
        currency: order.currency,
        culture: 'ru-RU',
        skin: 'classic',
        externalId: order.id,
        userInfo: order.userInfo,
        successRedirectUrl: returnUrl,
        failRedirectUrl: returnUrl,
      });
      if (lifeRef.current?.signal.aborted) return;
      // The browser result is only a lookup hint. It never credits the balance.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const confirmation = await verify(order.id, result?.data?.transactionId);
        if (confirmation.topup.status !== 'pending' || lifeRef.current?.signal.aborted) break;
        if (attempt < 4) await new Promise(resolve => window.setTimeout(resolve, 1500));
        if (lifeRef.current?.signal.aborted) break;
      }
    });

  const buy = () =>
    perform('purchase', async () => {
      let purchaseId = data?.instruction?.purchaseId;
      if (!purchaseId) {
        const result = await api('/purchases', {
          body: { instructionId, priceMinor: data.wallet.priceMinor },
        });
        if (lifeRef.current?.signal.aborted) return;
        purchaseId = result.purchaseId;
        readingRef.current?.abort();
        notifyWalletUpdated(result.wallet);
        setData(previous => ({
          ...previous,
          wallet: result.wallet,
          instruction: { ...previous.instruction, purchaseId },
        }));
      }
      await downloadPurchasedInstruction(token, purchaseId, {
        baseUrl,
        signal: lifeRef.current?.signal,
      });
      if (!lifeRef.current?.signal.aborted)
        setNotice({
          type: 'success',
          text: 'PDF готов к сохранению. Инструкция также доступна в личном кабинете.',
        });
    });

  return { data, busy, notice, pendingId, refresh, topup, checkPayment, buy };
}
