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
  const localVersionRef = useRef(0);
  const remoteVersionBySenderRef = useRef({});

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

  // Question switching effect
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

    let targetLang = currentLangRef.current;
    if (Array.isArray(availableLanguages) && availableLanguages.length > 0) {
      if (!availableLanguages.includes(targetLang)) {
        targetLang = availableLanguages[0];
      }
    }

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

    const channelName = 'interview_code_' + interviewId;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'code-change' }, ({ payload }) => {
        if (!payload || payload.senderId === userId) return;

        console.log('[COLLAB] broadcast received', { senderId: payload.senderId, version: payload.version });

        // Discard out-of-order packets from this sender using monotonic versioning
        if (payload.version && remoteVersionBySenderRef.current[payload.senderId] && payload.version <= remoteVersionBySenderRef.current[payload.senderId]) {
          return;
        }
        if (payload.version) {
          remoteVersionBySenderRef.current[payload.senderId] = payload.version;
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
          console.log('[COLLAB] remote code applied');
        }
        if (payload.language && payload.language !== currentLangRef.current) {
          setLanguage(payload.language);
          currentLangRef.current = payload.language;
        }

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
      .on('broadcast', { event: 'code-sync-request' }, ({ payload }) => {
        if (!payload || payload.requesterId === userId) return;
        console.log('[COLLAB] Peer requested code-sync:', payload.requesterId);
        // If we have active code, reply with snapshot so joining peer receives current live code
        if (currentCodeRef.current) {
          sendBroadcastMessage('code-sync-response', {
            targetUserId: payload.requesterId,
            questionId: currentQuestionIdRef.current,
            language: currentLangRef.current,
            code: currentCodeRef.current,
            version: localVersionRef.current,
          });
        }
      })
      .on('broadcast', { event: 'code-sync-response' }, ({ payload }) => {
        if (!payload || payload.targetUserId !== userId) return;
        console.log('[COLLAB] Received initial code snapshot from peer:', { length: payload.code ? payload.code.length : 0, lang: payload.language });

        isReceivingRemoteRef.current = true;
        if (payload.language && payload.language !== currentLangRef.current) {
          setLanguage(payload.language);
          currentLangRef.current = payload.language;
        }
        if (payload.code !== undefined && payload.code !== currentCodeRef.current) {
          setCode(payload.code);
          currentCodeRef.current = payload.code;
          if (payload.questionId) {
            if (!codeCacheRef.current[payload.questionId]) codeCacheRef.current[payload.questionId] = {};
            codeCacheRef.current[payload.questionId][payload.language || currentLangRef.current] = payload.code;
            codeCacheRef.current[payload.questionId]._activeLang = payload.language || currentLangRef.current;
          }
          console.log('[COLLAB] remote code applied (initial sync)');
        }
        queueMicrotask(() => {
          isReceivingRemoteRef.current = false;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[COLLAB] channel subscribed');
          channelSubscribedRef.current = true;
          // Request initial code synchronization from any peer already in the room
          sendBroadcastMessage('code-sync-request', { requesterId: userId });

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

  // Low-latency broadcast dispatcher with 20ms burst coalescing
  const dispatchCodeBroadcast = useCallback((newCode, lang) => {
    const payload = {
      senderId: userId,
      questionId: currentQuestionIdRef.current,
      code: newCode,
      language: lang,
      timestamp: Date.now(),
      version: ++localVersionRef.current,
    };

    console.log('[COLLAB] local change', { length: newCode.length, lang });

    if (!broadcastThrottleTimerRef.current) {
      // Send immediately on leading edge
      sendBroadcastMessage('code-change', payload);
      console.log('[COLLAB] broadcast sent', { version: payload.version });
      // Micro-coalesce subsequent rapid keystrokes within 20ms
      broadcastThrottleTimerRef.current = setTimeout(() => {
        broadcastThrottleTimerRef.current = null;
        if (pendingBroadcastRef.current && pendingBroadcastRef.current.event === 'code-change') {
          const next = pendingBroadcastRef.current.payload;
          pendingBroadcastRef.current = null;
          sendBroadcastMessage('code-change', next);
          console.log('[COLLAB] broadcast sent (coalesced)', { version: next.version });
        }
      }, 20);
    } else {
      pendingBroadcastRef.current = { event: 'code-change', payload };
    }
  }, [userId, sendBroadcastMessage]);

  // Local user updates code
  const handleCodeChange = (newCode) => {
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
