import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { updateInterviewCode } from '../services/interviewService';
import { CODE_TEMPLATES } from '../utils/codeTemplates';

export function useCollaborativeCode({ 
  interviewId, 
  userId, 
  questionId = null,
  initialCode = '', 
  initialLanguage = 'python',
  starterCodeByLang = null,
  availableLanguages = null,
}) {
  const [language, setLanguage] = useState(initialLanguage || 'python');
  const [code, setCode] = useState(initialCode || CODE_TEMPLATES[initialLanguage || 'python'] || '');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'remote'
  
  const channelRef = useRef(null);
  const channelSubscribedRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const broadcastThrottleTimerRef = useRef(null);
  const pendingBroadcastRef = useRef(null);
  const isReceivingRemoteRef = useRef(false);
  const lastLocalEditTimeRef = useRef(0);
  const latestRemoteTimestampRef = useRef(0);
  const localVersionRef = useRef(0);
  const hasLoadedInitialRef = useRef(false);

  const currentQuestionIdRef = useRef(questionId);
  const prevQuestionIdRef = useRef(questionId);
  const currentLangRef = useRef(language);
  const currentCodeRef = useRef(code);

  // Multi-tier cache: questionId -> { [lang]: code, activeLang: lang }
  const codeCacheRef = useRef({});

  useEffect(() => {
    currentLangRef.current = language;
  }, [language]);

  useEffect(() => {
    currentCodeRef.current = code;
  }, [code]);

  // Helper to retrieve starter code for a specific language
  const getStarterForLang = useCallback((lang) => {
    if (starterCodeByLang && starterCodeByLang[lang] !== undefined) {
      return starterCodeByLang[lang];
    }
    return CODE_TEMPLATES[lang] || '';
  }, [starterCodeByLang]);

  // Question switching effect: preserve previous question code and restore target question code
  useEffect(() => {
    const prevQId = prevQuestionIdRef.current;
    if (prevQId && prevQId !== questionId) {
      if (!codeCacheRef.current[prevQId]) {
        codeCacheRef.current[prevQId] = {};
      }
      codeCacheRef.current[prevQId][currentLangRef.current] = currentCodeRef.current;
      codeCacheRef.current[prevQId]._activeLang = currentLangRef.current;
    }

    prevQuestionIdRef.current = questionId;
    currentQuestionIdRef.current = questionId;

    if (!questionId) return;

    // Determine target language respecting availableLanguages
    let targetLang = currentLangRef.current;
    if (Array.isArray(availableLanguages) && availableLanguages.length > 0) {
      if (!availableLanguages.includes(targetLang)) {
        targetLang = availableLanguages[0];
      }
    }

    // Load code for new question
    const qCache = codeCacheRef.current[questionId];
    if (qCache) {
      const preferredLang = qCache._activeLang && (!Array.isArray(availableLanguages) || availableLanguages.includes(qCache._activeLang))
        ? qCache._activeLang
        : targetLang;
      const targetCode = qCache[preferredLang] !== undefined ? qCache[preferredLang] : getStarterForLang(preferredLang);
      setLanguage(preferredLang);
      setCode(targetCode);
      currentLangRef.current = preferredLang;
      currentCodeRef.current = targetCode;
    } else {
      const initialStarter = getStarterForLang(targetLang);
      codeCacheRef.current[questionId] = {
        [targetLang]: initialStarter,
        _activeLang: targetLang,
      };
      setLanguage(targetLang);
      setCode(initialStarter);
      currentLangRef.current = targetLang;
      currentCodeRef.current = initialStarter;
    }
  }, [questionId, availableLanguages, getStarterForLang]);

  // Sync initial values when loaded from database on session mount / refresh
  useEffect(() => {
    if (hasLoadedInitialRef.current) return;

    if (initialLanguage && initialLanguage !== currentLangRef.current) {
      setLanguage(initialLanguage);
      currentLangRef.current = initialLanguage;
    }
    if (initialCode !== undefined && initialCode !== null && initialCode !== '') {
      setCode(initialCode);
      currentCodeRef.current = initialCode;
      hasLoadedInitialRef.current = true;
      if (questionId) {
        if (!codeCacheRef.current[questionId]) codeCacheRef.current[questionId] = {};
        codeCacheRef.current[questionId][initialLanguage || language] = initialCode;
        codeCacheRef.current[questionId]._activeLang = initialLanguage || language;
      }
    }
  }, [initialCode, initialLanguage, questionId]);

  // Helper to send broadcast payload safely
  const sendBroadcastMessage = useCallback((event, payload) => {
    if (!channelRef.current || !channelSubscribedRef.current) {
      pendingBroadcastRef.current = { event, payload };
      return;
    }
    try {
      channelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });
    } catch (err) {
      console.warn('[CollaborativeCode] Broadcast send failed:', err);
    }
  }, []);

  // Realtime Broadcast Channel Setup
  useEffect(() => {
    if (!interviewId || !userId || !supabase) return;

    const channel = supabase.channel(`interview_code_${interviewId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'code-change' }, ({ payload }) => {
        if (!payload || payload.senderId === userId) return;

        // Discard stale out-of-order packets
        if (payload.timestamp && payload.timestamp < latestRemoteTimestampRef.current) {
          return;
        }
        latestRemoteTimestampRef.current = payload.timestamp || Date.now();

        // If local user typed more recently than this payload was created, preserve local edits
        if (payload.timestamp && payload.timestamp < lastLocalEditTimeRef.current) {
          return;
        }

        // If payload belongs to another question, update cache without altering active view
        if (payload.questionId && payload.questionId !== currentQuestionIdRef.current) {
          if (!codeCacheRef.current[payload.questionId]) codeCacheRef.current[payload.questionId] = {};
          const pLang = payload.language || 'python';
          codeCacheRef.current[payload.questionId][pLang] = payload.code;
          codeCacheRef.current[payload.questionId]._activeLang = pLang;
          return;
        }

        isReceivingRemoteRef.current = true;

        if (payload.code !== undefined && payload.code !== currentCodeRef.current) {
          setCode(payload.code);
          currentCodeRef.current = payload.code;
          if (currentQuestionIdRef.current) {
            if (!codeCacheRef.current[currentQuestionIdRef.current]) {
              codeCacheRef.current[currentQuestionIdRef.current] = {};
            }
            codeCacheRef.current[currentQuestionIdRef.current][payload.language || currentLangRef.current] = payload.code;
          }
        }
        if (payload.language && payload.language !== currentLangRef.current) {
          setLanguage(payload.language);
          currentLangRef.current = payload.language;
        }

        // Immediately release receiving flag on microtask so future local typing is never blocked
        queueMicrotask(() => {
          isReceivingRemoteRef.current = false;
        });
      })
      .on('broadcast', { event: 'language-change' }, ({ payload }) => {
        if (!payload || payload.senderId === userId) return;

        if (payload.questionId && payload.questionId !== currentQuestionIdRef.current) {
          if (!codeCacheRef.current[payload.questionId]) codeCacheRef.current[payload.questionId] = {};
          codeCacheRef.current[payload.questionId]._activeLang = payload.language;
          if (payload.code !== undefined) {
            codeCacheRef.current[payload.questionId][payload.language] = payload.code;
          }
          return;
        }

        isReceivingRemoteRef.current = true;

        if (payload.language) {
          setLanguage(payload.language);
          currentLangRef.current = payload.language;
        }
        if (payload.code !== undefined && payload.code !== currentCodeRef.current) {
          setCode(payload.code);
          currentCodeRef.current = payload.code;
        }

        queueMicrotask(() => {
          isReceivingRemoteRef.current = false;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelSubscribedRef.current = true;
          // Flush any pending broadcast that occurred during initial connection
          if (pendingBroadcastRef.current) {
            const { event, payload } = pendingBroadcastRef.current;
            pendingBroadcastRef.current = null;
            sendBroadcastMessage(event, payload);
          }
        }
      });

    channelRef.current = channel;

    return () => {
      channelSubscribedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (broadcastThrottleTimerRef.current) {
        clearTimeout(broadcastThrottleTimerRef.current);
      }
    };
  }, [interviewId, userId, sendBroadcastMessage]);

  // Debounced database persistence (purely background recovery/state save)
  const persistToDatabase = useCallback((codeToSave, langToSave) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        await updateInterviewCode(interviewId, codeToSave, langToSave);
        setSyncStatus('synced');
      } catch (err) {
        console.error('[CollaborativeCode] Failed to persist code to Supabase:', err);
        setSyncStatus('synced');
      }
    }, 1800);
  }, [interviewId]);

  // Low-latency broadcast dispatcher with 25ms burst coalescing
  const dispatchCodeBroadcast = useCallback((newCode, lang) => {
    const payload = {
      senderId: userId,
      questionId: currentQuestionIdRef.current,
      code: newCode,
      language: lang,
      timestamp: Date.now(),
      version: ++localVersionRef.current,
    };

    if (!broadcastThrottleTimerRef.current) {
      // Send immediately on leading edge
      sendBroadcastMessage('code-change', payload);
      // Micro-coalesce subsequent rapid keystrokes within 25ms
      broadcastThrottleTimerRef.current = setTimeout(() => {
        broadcastThrottleTimerRef.current = null;
        if (pendingBroadcastRef.current && pendingBroadcastRef.current.event === 'code-change') {
          const next = pendingBroadcastRef.current.payload;
          pendingBroadcastRef.current = null;
          sendBroadcastMessage('code-change', next);
        }
      }, 25);
    } else {
      // Store latest keystroke state to be dispatched at end of micro-window
      pendingBroadcastRef.current = { event: 'code-change', payload };
    }
  }, [userId, sendBroadcastMessage]);

  // Local user updates code
  const handleCodeChange = (newCode) => {
    lastLocalEditTimeRef.current = Date.now();
    setCode(newCode);
    currentCodeRef.current = newCode;

    if (currentQuestionIdRef.current) {
      if (!codeCacheRef.current[currentQuestionIdRef.current]) {
        codeCacheRef.current[currentQuestionIdRef.current] = {};
      }
      codeCacheRef.current[currentQuestionIdRef.current][language] = newCode;
      codeCacheRef.current[currentQuestionIdRef.current]._activeLang = language;
    }

    // Do not echo if this change was triggered by remote update application
    if (isReceivingRemoteRef.current) return;

    // Send low-latency broadcast
    dispatchCodeBroadcast(newCode, language);

    // Schedule background database persistence
    persistToDatabase(newCode, language);
  };

  // Local user updates programming language
  const handleLanguageChange = (newLang) => {
    const qId = currentQuestionIdRef.current;
    if (qId) {
      if (!codeCacheRef.current[qId]) codeCacheRef.current[qId] = {};
      codeCacheRef.current[qId][language] = code;
    }

    let nextCode = '';
    if (qId && codeCacheRef.current[qId] && codeCacheRef.current[qId][newLang]) {
      nextCode = codeCacheRef.current[qId][newLang];
    } else {
      nextCode = getStarterForLang(newLang);
    }

    setLanguage(newLang);
    setCode(nextCode);
    currentLangRef.current = newLang;
    currentCodeRef.current = nextCode;

    if (qId) {
      codeCacheRef.current[qId][newLang] = nextCode;
      codeCacheRef.current[qId]._activeLang = newLang;
    }

    if (isReceivingRemoteRef.current) return;

    const payload = {
      senderId: userId,
      questionId: qId,
      language: newLang,
      code: nextCode,
      timestamp: Date.now(),
      version: ++localVersionRef.current,
    };
    sendBroadcastMessage('language-change', payload);
    persistToDatabase(nextCode, newLang);
  };

  // Reset to default template
  const resetToTemplate = () => {
    const template = getStarterForLang(language);
    handleCodeChange(template);
  };

  return {
    code,
    language,
    syncStatus,
    setCode: handleCodeChange,
    setLanguage: handleLanguageChange,
    resetToTemplate,
  };
}
