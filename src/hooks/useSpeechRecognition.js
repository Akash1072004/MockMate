import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Robust Browser-native Speech-to-Text hook using SpeechRecognition / webkitSpeechRecognition.
 * Fully supports real microphone transcription, interim words, locale selection, and Chromium/Brave diagnosis.
 */
export function useSpeechRecognition({ onResult, onError, lang = 'en-IN' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const isManualStopRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  // Clean up any active recognition when component unmounts
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    isManualStopRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {
        try {
          recognitionRef.current.abort();
        } catch (__) {}
      }
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const msg = 'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or another Chromium-based browser.';
      setError(msg);
      if (onError) onError(msg);
      return;
    }

    if (isListeningRef.current) {
      return;
    }

    setError(null);
    isManualStopRef.current = false;

    // 1. Check microphone permission via Permissions API if available.
    // If permission is already granted, avoid re-requesting getUserMedia on every click,
    // which can conflict with the Windows audio driver when rapidly opening/closing audio tracks.
    let isAlreadyGranted = false;
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permissionStatus.state === 'denied') {
          const userMsg = 'Microphone permission is blocked. Please allow microphone access in your browser settings and try again.';
          setError(userMsg);
          if (onError) onError(userMsg);
          setIsListening(false);
          isListeningRef.current = false;
          return;
        }
        if (permissionStatus.state === 'granted') {
          isAlreadyGranted = true;
        }
      } catch (_) {
        // Permissions query for microphone may not be supported in all browsers; continue
      }
    }

    // 2. If permission is not yet confirmed granted, request it once via getUserMedia to prompt the user
    if (!isAlreadyGranted && typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release tracks so SpeechRecognition has exclusive audio driver access
        stream.getTracks().forEach((track) => track.stop());
        // Small delay to allow the audio capture driver to cleanly release the device
        await new Promise((resolve) => setTimeout(resolve, 80));
      } catch (err) {
        console.warn('[useSpeechRecognition] Microphone access check failed:', err);
        let userMsg = 'Could not access microphone.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          userMsg = 'Microphone permission is blocked. Please allow microphone access in your browser settings and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          userMsg = 'No microphone was detected. Please connect a microphone and try again.';
        } else {
          userMsg = err.message || 'Microphone access failed.';
        }
        setError(userMsg);
        if (onError) onError(userMsg);
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
    }

    // 3. Stop/abort any stale recognition instance before starting fresh
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    // 4. Create a fresh SpeechRecognition instance for this speaking session
    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang || 'en-IN';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setError(null);
      };

      recognition.onresult = (event) => {
        let currentInterim = '';
        let finalSpeech = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            finalSpeech += text;
          } else {
            currentInterim += text;
          }
        }

        if (finalSpeech) {
          setTranscript((prev) => {
            const trimmed = finalSpeech.trim();
            const updated = prev ? `${prev} ${trimmed}` : trimmed;
            if (onResult) onResult(updated);
            return updated;
          });
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event) => {
        console.warn('[useSpeechRecognition] Speech recognition error event:', event.error);
        if (event.error === 'no-speech') {
          // Normal silence timeout while candidate is thinking - do not treat as fatal error
          return;
        }
        if (event.error === 'aborted') {
          // Intentional stop by candidate, ignore
          return;
        }

        let userMsg = `Speech recognition error: ${event.error}`;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          userMsg = 'Microphone permission was denied. Please allow microphone access in your browser settings and try again.';
        } else if (event.error === 'audio-capture') {
          userMsg = 'No microphone was detected. Please ensure your microphone is connected and working.';
        } else if (event.error === 'network') {
          // Detect if Brave browser is being used (Brave disables Google Speech API by default)
          const isBrave = Boolean(
            typeof navigator !== 'undefined' && navigator.brave && typeof navigator.brave.isBrave === 'function'
          );

          if (isBrave) {
            userMsg = 'Speech recognition service is blocked in Brave (Brave disables Google Speech API by default). Please use Google Chrome or Microsoft Edge, or switch to Keyboard Typing.';
          } else {
            userMsg = 'Speech recognition service is unavailable. The browser could not reach the speech recognition server. Check your browser/network settings, try Google Chrome or Edge, or switch to Keyboard Typing.';
          }
        }

        setError(userMsg);
        if (onError) onError(userMsg);
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[useSpeechRecognition] Failed to start SpeechRecognition:', err);
      if (err.name !== 'InvalidStateError') {
        const msg = err.message || 'Failed to start speech recognition.';
        setError(msg);
        if (onError) onError(msg);
      }
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [isSupported, lang, onResult, onError]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  const setManualTranscript = useCallback((text) => {
    setTranscript(text);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript: setManualTranscript,
  };
}
