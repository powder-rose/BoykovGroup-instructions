import { useEffect, useRef, useState } from 'react';

import { useSelector } from 'react-redux';

import {
  selectAuthToken,
  selectAuthUser,
  selectIsRestoringSession,
} from '../../../store/authSlice.js';

import { downloadQuotaFromHeaders } from '../../../lib/downloadQuota.js';
import useDownloadQuota from './useDownloadQuota.js';
import { downloadPurchasedInstruction } from '../../../../public/assets/wallet-client.js';

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

  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);

  const [message, setMessage] = useState(null);

  const messageTimerRef = useRef(null);
  const downloadControllerRef = useRef(null);

  useEffect(() => {
    setIsLimitModalOpen(false);
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

  const { remaining, quotaError, refreshQuota, updateQuota, purchaseId } = useDownloadQuota(
    token,
    isCatalogDownload && isUser && !isRestoring,
    instructionId,
  );

  const isLimitReached = isCatalogDownload && remaining === 0 && !purchaseId;

  async function downloadPdf() {
    if (!instructionId || !token || isDownloading || downloadControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    downloadControllerRef.current = controller;
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
            setIsLimitModalOpen(true);
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

  function handleClick() {
    if (isRestoring || isDownloading) {
      return;
    }

    if (!user || !token) {
      setIsRegistrationOpen(true);

      return;
    }

    if (isLimitReached) {
      setIsLimitModalOpen(true);
      return;
    }

    if (isAdmin || isUser) {
      void downloadPdf();
    }
  }

  return {
    user,
    isLimitModalOpen,
    setIsLimitModalOpen,
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
