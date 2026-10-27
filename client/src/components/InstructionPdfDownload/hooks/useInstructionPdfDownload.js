import { useEffect, useRef, useState } from 'react';

import { useSelector } from 'react-redux';

import {
  selectAuthToken,
  selectAuthUser,
  selectIsRestoringSession,
} from '../../../store/authSlice.js';

import { downloadQuotaFromHeaders } from '../../../lib/downloadQuota.js';
import useDownloadQuota from './useDownloadQuota.js';
import {
  downloadPurchasedInstruction,
  notifyWalletUpdated,
  purchaseCatalogInstruction,
  walletRequest,
} from '../../../../public/assets/wallet-client.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getPdfFileName(response, instructionId) {
  const disposition = response.headers.get('Content-Disposition') || '';

  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      /* use fallback */
    }
  }

  return `instruction-${instructionId}.pdf`;
}

export default function useInstructionPdfDownload(instructionId, downloadUrl) {
  const token = useSelector(selectAuthToken);

  const user = useSelector(selectAuthUser);

  const isRestoring = useSelector(selectIsRestoringSession);

  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

  const [purchaseDialog, setPurchaseDialog] = useState(null);
  const [activeFormat, setActiveFormat] = useState('pdf');

  const [isDownloading, setIsDownloading] = useState(false);

  const [message, setMessage] = useState(null);

  const messageTimerRef = useRef(null);
  const downloadControllerRef = useRef(null);

  useEffect(() => {
    setPurchaseDialog(null);
    setIsDownloading(false);
    setMessage(null);
    return () => {
      downloadControllerRef.current?.abort();
      downloadControllerRef.current = null;
    };
  }, [token, instructionId, downloadUrl]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  function showMessage(text, type = 'error') {
    setMessage({
      text,
      type,
    });

    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }

    messageTimerRef.current = window.setTimeout(() => {
      setMessage(null);

      messageTimerRef.current = null;
    }, 5000);
  }

  const isAdmin = user?.role === 'admin';

  const isCatalogDownload = !downloadUrl && !isAdmin;

  const isUser = user?.role === 'user';

  const { remaining, quotaError, refreshQuota, updateQuota, purchaseId, wordPurchaseId } =
    useDownloadQuota(token, isCatalogDownload && isUser && !isRestoring, instructionId);

  const isLimitReached = isCatalogDownload && remaining === 0 && !purchaseId;

  async function downloadPdf() {
    if (!instructionId || !token || isDownloading || downloadControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    downloadControllerRef.current = controller;
    setActiveFormat('pdf');
    setIsDownloading(true);

    try {
      if (purchaseId) {
        await downloadPurchasedInstruction(token, purchaseId, {
          baseUrl: API_BASE_URL,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        showMessage('PDF готов к сохранению.', 'success');
        return;
      }
      const url =
        downloadUrl || `${API_BASE_URL}/api/instructions/${encodeURIComponent(instructionId)}/pdf`;

      const response = await fetch(url, {
        method: 'GET',

        headers: {
          Authorization: `Bearer ${token}`,

          Accept: 'application/pdf',
        },

        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `Ошибка скачивания (${response.status})`;

        try {
          const data = await response.json();

          if (controller.signal.aborted) return;
          if (isCatalogDownload) updateQuota(data);
          if (data.code === 'DOWNLOAD_LIMIT_REACHED') {
            showMessage('Бесплатные скачивания закончились. Теперь инструкцию можно купить.');
            return;
          }

          if (data?.error) {
            errorMessage = data.error;
          }
        } catch {
          /* keep default message */
        }

        throw new Error(errorMessage);
      }

      if (isCatalogDownload) updateQuota(downloadQuotaFromHeaders(response.headers));

      const contentType = response.headers.get('Content-Type') || '';

      if (!contentType.toLowerCase().includes('application/pdf')) {
        throw new Error('Сервер вернул не PDF-файл');
      }

      const blob = await response.blob();
      if (controller.signal.aborted) return;

      if (blob.size < 1000) {
        throw new Error('Получен пустой PDF-файл');
      }

      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = objectUrl;

      link.download = getPdfFileName(response, instructionId);

      link.style.display = 'none';

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 5000);

      showMessage('PDF готов к сохранению.', 'success');
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('PDF download error:', error);

      showMessage(error?.message || 'Не удалось скачать PDF');
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null;
        setIsDownloading(false);
        if (isCatalogDownload && !controller.signal.aborted) void refreshQuota();
      }
    }
  }

  async function buyInstruction(format) {
    if (!instructionId || !token || downloadControllerRef.current) return;
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    setActiveFormat(format);
    setIsDownloading(true);

    try {
      // Recheck the actual server balance before charging; the header may be stale.
      const result = await purchaseCatalogInstruction(token, instructionId, {
        baseUrl: API_BASE_URL,
        signal: controller.signal,
        format,
        confirmed: true,
      });
      if (controller.signal.aborted) return;
      if (result.kind === 'topup') {
        notifyWalletUpdated(result.wallet);
        setPurchaseDialog({ format, wallet: result.wallet });
        return;
      }

      // The server makes the purchase idempotent and charges the account at most once.
      notifyWalletUpdated(result.wallet);
      setPurchaseDialog(null);
      await downloadPurchasedInstruction(token, result.purchaseId, {
        baseUrl: API_BASE_URL,
        signal: controller.signal,
        format,
      });
      if (!controller.signal.aborted) {
        showMessage(
          `Инструкция куплена. ${format === 'docx' ? 'Word' : 'PDF'} готов к сохранению.`,
          'success',
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.code === 'INSUFFICIENT_BALANCE') {
        try {
          const wallet = await walletRequest(token, '', {
            baseUrl: API_BASE_URL,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          notifyWalletUpdated(wallet);
          setPurchaseDialog({ format, wallet });
        } catch {
          if (!controller.signal.aborted)
            showMessage('Баланс изменился. Закройте окно и проверьте его ещё раз.');
        }
        return;
      }
      if (error.code === 'FREE_DOWNLOADS_AVAILABLE') {
        setPurchaseDialog(null);
        showMessage('У вас ещё есть бесплатное скачивание. Баланс не списан.');
        return;
      }
      console.error('Instruction purchase error:', error);
      setPurchaseDialog(previous => (previous ? { ...previous, error: error.message } : previous));
      showMessage(error?.message || 'Не удалось купить инструкцию.');
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null;
        setIsDownloading(false);
        if (!controller.signal.aborted) void refreshQuota();
      }
    }
  }

  async function requestPurchase(format) {
    if (!instructionId || !token || downloadControllerRef.current) return;
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    setActiveFormat(format);
    setIsDownloading(true);
    try {
      const checkout = await walletRequest(
        token,
        `/checkout?instructionId=${encodeURIComponent(instructionId)}&format=${format}`,
        { baseUrl: API_BASE_URL, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (
        !Number.isSafeInteger(checkout.wallet?.balanceMinor) ||
        checkout.wallet?.priceMinor !== 5000
      )
        throw new Error('Не удалось проверить стоимость и баланс. Попробуйте ещё раз.');
      notifyWalletUpdated(checkout.wallet);
      if (checkout.instruction?.purchaseId) {
        await downloadPurchasedInstruction(token, checkout.instruction.purchaseId, {
          baseUrl: API_BASE_URL,
          signal: controller.signal,
          format,
        });
        if (!controller.signal.aborted)
          showMessage(`${format === 'docx' ? 'Word' : 'PDF'} готов к сохранению.`, 'success');
      } else {
        setPurchaseDialog({ format, wallet: checkout.wallet });
      }
    } catch (error) {
      if (!controller.signal.aborted) showMessage(error.message || 'Не удалось проверить покупку.');
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null;
        setIsDownloading(false);
        if (!controller.signal.aborted) void refreshQuota();
      }
    }
  }

  function handleWordClick() {
    if (isRestoring || isDownloading) return;
    setActiveFormat('docx');
    if (!user || !token) {
      setIsRegistrationOpen(true);
      return;
    }
    if (isUser) void requestPurchase('docx');
  }

  function handleClick() {
    if (isRestoring || isDownloading) {
      return;
    }
    setActiveFormat('pdf');

    if (!user || !token) {
      setIsRegistrationOpen(true);

      return;
    }

    if (isLimitReached) {
      void requestPurchase('pdf');
      return;
    }

    if (isAdmin || isUser) {
      void downloadPdf();
    }
  }

  return {
    user,
    purchaseDialog,
    closePurchaseDialog: () => {
      if (!downloadControllerRef.current) setPurchaseDialog(null);
    },
    confirmPurchase: () => {
      if (purchaseDialog) void buyInstruction(purchaseDialog.format);
    },
    activeFormat,
    wordPurchaseId,
    handleWordClick,
    purchaseId,
    isRestoring,
    isRegistrationOpen,
    setRegistrationOpen: setIsRegistrationOpen,
    isDownloading,
    message,
    isCatalogDownload,
    isLimitReached,
    remaining,
    quotaError,
    handleClick,
  };
}
