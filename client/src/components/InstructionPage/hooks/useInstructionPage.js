import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import {
  selectAuthToken,
  selectIsAdmin,
  selectIsRestoringSession,
} from '../../../store/authSlice.js';
import { getInstructionViews, recordInstructionView } from '../../../api/instructionsApi.js';
import { getInstructionPath } from '../../../lib/instructionLinks.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function useInstructionPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = useSelector(selectIsAdmin);
  const authToken = useSelector(selectAuthToken);
  const isRestoringSession = useSelector(selectIsRestoringSession);
  const [result, setResult] = useState({ routeKey: '', instruction: null, status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [viewStats, setViewStats] = useState(null);
  const lastViewedIdRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    setResult({ routeKey: id, instruction: null, status: 'loading' });
    setEditOpen(false);

    async function loadInstruction() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/instructions/page/${encodeURIComponent(id)}`,
          {
            signal: controller.signal,
          },
        );

        if (response.status === 404) {
          if (!controller.signal.aborted) {
            setResult({ routeKey: id, instruction: null, status: 'not-found' });
          }
          return;
        }

        if (!response.ok) {
          throw new Error('Не удалось загрузить инструкцию.');
        }

        const data = await response.json();
        if (!data || typeof data.id !== 'string' || typeof data.title !== 'string') {
          throw new Error('Не удалось загрузить инструкцию.');
        }

        if (!controller.signal.aborted) {
          setResult({ routeKey: id, instruction: data, status: 'ready' });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ routeKey: id, instruction: null, status: 'error' });
        }
      }
    }

    void loadInstruction();
    return () => controller.abort();
  }, [id, retry]);

  const status = result.routeKey === id ? result.status : 'loading';
  const instruction = status === 'ready' ? result.instruction : null;
  const instructionId = instruction?.id;

  useEffect(() => {
    if (!instruction) return;

    const canonicalPath = getInstructionPath(instruction);
    if (location.pathname !== canonicalPath) {
      navigate(
        { pathname: canonicalPath, search: location.search, hash: location.hash },
        { replace: true },
      );
    }
  }, [instruction, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (!instructionId || !location.hash) return undefined;
    let anchor;
    try {
      anchor = decodeURIComponent(location.hash.slice(1));
    } catch {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [instructionId, location.hash]);

  useEffect(() => {
    if (
      !instructionId ||
      isRestoringSession ||
      isAdmin ||
      lastViewedIdRef.current === instructionId
    ) {
      return;
    }

    lastViewedIdRef.current = instructionId;
    recordInstructionView(instructionId).catch(() => {});
  }, [instructionId, isAdmin, isRestoringSession]);

  useEffect(() => {
    setViewStats(null);
    if (!instructionId || isRestoringSession || !isAdmin || !authToken) {
      return undefined;
    }

    let cancelled = false;
    getInstructionViews(instructionId, authToken)
      .then(data => {
        if (!cancelled) setViewStats(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [instructionId, authToken, isAdmin, isRestoringSession]);

  function applyPublishedInstruction(saved, metadata) {
    if (metadata?.hasPublishedVersion === false) {
      setEditOpen(false);
      navigate('/instrukcii-po-ohrane-truda', { replace: true });
      return;
    }

    if (!saved || saved.id !== instructionId) return;

    setResult(current => ({
      ...current,
      instruction: {
        ...saved,
        relatedInstructions: current.instruction?.relatedInstructions || [],
      },
    }));
    setEditOpen(false);
  }

  return {
    instruction,
    relatedInstructions: instruction?.relatedInstructions || [],
    loading: status === 'loading',
    error: status === 'error',
    notFound: status === 'not-found',
    retryLoad: () => setRetry(value => value + 1),
    editOpen,
    setEditOpen,
    isAdmin,
    viewStats,
    applyPublishedInstruction,
  };
}
