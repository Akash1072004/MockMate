import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  startAIInterview, 
  saveCandidateAnswer, 
  completeInterviewSession, 
  sendAITurn,
  AI_STAGE_DEFINITIONS
} from '../services/aiInterviewService';
import { requestEvaluation } from '../services/evaluationService';
import { getCandidateResume, hasResume } from '../services/resumeService';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import CollaborativeCodeEditor from '../components/interview/CollaborativeCodeEditor';
import LeetCodeQuestionPanel from '../components/interview/LeetCodeQuestionPanel';
import { CODE_TEMPLATES } from '../utils/codeTemplates';
import {
  CURATED_CODING_PROBLEMS,
  selectCodingProblem,
  DEFAULT_CODING_PROBLEM,
  getStarterCodeForProblem
} from '../utils/codingProblems';
import { 
  Bot, 
  Sparkles, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  FileText, 
  Play, 
  RotateCw,
  Send,
  Volume2,
  VolumeX,
  Award,
  ChevronRight,
  Mic,
  MicOff,
  Keyboard,
  Edit3,
  Check,
  User,
  MessageSquare,
  Maximize2,
  HelpCircle
} from 'lucide-react';

const TRACK_OPTIONS = ['DSA', 'Technical', 'Frontend', 'Backend', 'Full Stack', 'Behavioral'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const DURATION_OPTIONS = [
  { value: 15, label: '15 Mins (Fast Track)' },
  { value: 30, label: '30 Mins (Standard Mock)' },
  { value: 45, label: '45 Mins (In-Depth Mock)' },
];

export const STAGES = [
  { key: 'introduction', label: '1. Introduction', desc: 'Greeting & format overview' },
  { key: 'personal', label: '2. Background', desc: 'Tell me about yourself' },
  { key: 'resume_dive', label: '3. Resume Discussion', desc: 'Deep dive into projects' },
  { key: 'technical', label: '4. Technical Concepts', desc: 'Architecture & trade-offs' },
  { key: 'coding', label: '5. Live Coding', desc: 'Algorithm challenge' },
  { key: 'followup', label: '6. Complexity & Scaling', desc: 'Time, space & optimizations' },
  { key: 'evaluation', label: '7. Final Evaluation', desc: 'Performance debrief' },
];

const STAGE_ORDER = ['introduction', 'personal', 'resume_dive', 'technical', 'coding', 'followup', 'evaluation'];

const FOLLOWUP_ELIGIBLE_STAGES = ['resume_dive', 'technical', 'followup'];
const MAX_FOLLOWUPS_PER_STAGE = 1;

const SESSION_STORAGE_KEY = 'mockmate_ai_interview_active_session';

export default function AIInterviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Resume state & pre-flight
  const [hasCandidateResume, setHasCandidateResume] = useState(null);
  const [candidateResume, setCandidateResume] = useState(null);
  const [checkingResume, setCheckingResume] = useState(true);

  // Setup state
  const [inSession, setInSession] = useState(false);
  const [interviewType, setInterviewType] = useState('DSA');
  const [difficulty, setDifficulty] = useState('Medium');
  const [duration, setDuration] = useState(30);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Active session conversational state (Authoritative State Machine)
  const [interview, setInterview] = useState(null);
  const [currentStage, setCurrentStage] = useState('introduction');
  const [messages, setMessages] = useState([]);
  const [qaHistory, setQaHistory] = useState([]);
  const [stageFollowUpCount, setStageFollowUpCount] = useState(0);
  const [questionsMap, setQuestionsMap] = useState({});
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [inputMode, setInputMode] = useState('speak');

  // Coding stage state - single source of truth for problem, language, and code preservation
  const [activeCodingProblem, setActiveCodingProblem] = useState(DEFAULT_CODING_PROBLEM);
  const [language, setLanguage] = useState('python');
  const [codeByLanguage, setCodeByLanguage] = useState({
    python: DEFAULT_CODING_PROBLEM.starter_code.python,
    cpp: DEFAULT_CODING_PROBLEM.starter_code.cpp,
    java: DEFAULT_CODING_PROBLEM.starter_code.java,
    javascript: DEFAULT_CODING_PROBLEM.starter_code.javascript,
  });
  const [code, setCode] = useState(DEFAULT_CODING_PROBLEM.starter_code.python);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [showAiChatInCoding, setShowAiChatInCoding] = useState(true);

  // Resizable coding IDE state (Problem Panel <-> Code Editor divider)
  const [codingPanelWidth, setCodingPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('mockmate_ai_panel_width');
      const num = Number(saved);
      return !isNaN(num) && num >= 280 && num <= 850 ? num : 440;
    } catch (_) {
      return 440;
    }
  });
  const [isResizingCoding, setIsResizingCoding] = useState(false);

  const handleMouseDownCodingResize = (e) => {
    e.preventDefault();
    setIsResizingCoding(true);
  };

  useEffect(() => {
    if (!isResizingCoding) return;

    const handleMouseMove = (e) => {
      const maxW = Math.max(350, window.innerWidth - 480);
      const newWidth = Math.max(280, Math.min(e.clientX, maxW));
      setCodingPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingCoding(false);
      setCodingPanelWidth((w) => {
        try {
          localStorage.setItem('mockmate_ai_panel_width', String(w));
        } catch (_) {}
        return w;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingCoding]);

  // STRICT In-flight and completion guards to avoid race conditions & duplicate API requests
  const inFlightRef = useRef(false);
  const completedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const currentStageRef = useRef(currentStage);
  const stageFollowUpCountRef = useRef(stageFollowUpCount);
  const messagesRef = useRef(messages);
  const interviewRef = useRef(interview);
  const qaHistoryRef = useRef(qaHistory);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const codeByLanguageRef = useRef(codeByLanguage);
  const activeCodingProblemRef = useRef(activeCodingProblem);

  useEffect(() => { currentStageRef.current = currentStage; }, [currentStage]);
  useEffect(() => { stageFollowUpCountRef.current = stageFollowUpCount; }, [stageFollowUpCount]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { interviewRef.current = interview; }, [interview]);
  useEffect(() => { qaHistoryRef.current = qaHistory; }, [qaHistory]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { codeByLanguageRef.current = codeByLanguage; }, [codeByLanguage]);
  useEffect(() => { activeCodingProblemRef.current = activeCodingProblem; }, [activeCodingProblem]);

  // Speech-to-text hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Text-to-speech helper
  const speakText = useCallback((text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[AIInterviewPage] Speech synthesis warning:', e);
    }
  }, [voiceEnabled]);

  // Helper to obtain starter code for a specific language and problem
  const getStarterCode = useCallback((lang, problem) => {
    const prob = problem || activeCodingProblemRef.current || DEFAULT_CODING_PROBLEM;
    return getStarterCodeForProblem(prob, lang) || prob?.starter_code?.[lang] || CODE_TEMPLATES[lang] || '';
  }, []);

  // Language Change Handler with Code Preservation across switches (Python <-> C++ <-> Java)
  const handleLanguageChange = useCallback((newLang) => {
    const currentLang = languageRef.current;
    const currentEditorCode = codeRef.current;

    // 1. Save current code for previous language
    const updatedCodeByLang = {
      ...codeByLanguageRef.current,
      [currentLang]: currentEditorCode,
    };

    // 2. Fetch or initialize code for target language
    const targetCode = updatedCodeByLang[newLang] !== undefined
      ? updatedCodeByLang[newLang]
      : getStarterCode(newLang, activeCodingProblemRef.current);

    updatedCodeByLang[newLang] = targetCode;

    // 3. Atomically update state
    setCodeByLanguage(updatedCodeByLang);
    setLanguage(newLang);
    setCode(targetCode);

    languageRef.current = newLang;
    codeRef.current = targetCode;
    codeByLanguageRef.current = updatedCodeByLang;
  }, [getStarterCode]);

  // Reset to default boilerplate for current language
  const handleResetTemplate = useCallback(() => {
    const curLang = languageRef.current;
    const freshStarter = getStarterCode(curLang, activeCodingProblemRef.current);

    setCodeByLanguage((prev) => ({
      ...prev,
      [curLang]: freshStarter,
    }));
    setCode(freshStarter);
    codeRef.current = freshStarter;
  }, [getStarterCode]);

  // Handle editor code edits
  const handleCodeChange = useCallback((newVal) => {
    const curLang = languageRef.current;
    setCode(newVal);
    codeRef.current = newVal;
    setCodeByLanguage((prev) => ({
      ...prev,
      [curLang]: newVal,
    }));
  }, []);

  // Save session recovery snapshot to sessionStorage
  const persistSessionSnapshot = useCallback((sessionData) => {
    try {
      if (completedRef.current) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (err) {
      console.warn('[AIInterviewPage] Failed to save session snapshot:', err);
    }
  }, []);

  // Check resume pre-flight requirement on mount & attempt session restoration
  useEffect(() => {
    if (user?.id) {
      hasResume(user.id)
        .then((ok) => {
          setHasCandidateResume(ok);
          if (ok) {
            getCandidateResume(user.id).then((res) => setCandidateResume(res));
          }
        })
        .finally(() => setCheckingResume(false));

      // Attempt to recover existing active session if user accidentally refreshed
      try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.interview?.id && saved.userId === user.id && !saved.completed) {
            setInterview(saved.interview);
            setCurrentStage(saved.currentStage || 'introduction');
            setStageFollowUpCount(saved.stageFollowUpCount || 0);
            setMessages(saved.messages || []);
            setQaHistory(saved.qaHistory || []);
            setQuestionsMap(saved.questionsMap || {});
            
            const prob = saved.activeCodingProblem || DEFAULT_CODING_PROBLEM;
            setActiveCodingProblem(prob);
            activeCodingProblemRef.current = prob;

            const savedLang = saved.language || 'python';
            setLanguage(savedLang);
            languageRef.current = savedLang;

            const savedCodeByLang = saved.codeByLanguage || {
              [savedLang]: saved.code || prob?.starter_code?.[savedLang] || CODE_TEMPLATES[savedLang] || '',
            };
            setCodeByLanguage(savedCodeByLang);
            codeByLanguageRef.current = savedCodeByLang;

            const currentCode = saved.code || savedCodeByLang[savedLang] || prob?.starter_code?.[savedLang] || '';
            setCode(currentCode);
            codeRef.current = currentCode;

            setInterviewType(saved.interviewType || 'DSA');
            setDifficulty(saved.difficulty || 'Medium');
            setDuration(saved.duration || 30);
            setElapsedSeconds(saved.elapsedSeconds || 0);
            setInSession(true);
          }
        }
      } catch (e) {
        console.warn('[AIInterviewPage] Error restoring session:', e);
      }
    }
  }, [user?.id]);

  // Timer: isolated from phase state machine
  useEffect(() => {
    if (!inSession || completedRef.current) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (interviewRef.current && !completedRef.current) {
          persistSessionSnapshot({
            userId: user?.id,
            interview: interviewRef.current,
            currentStage: currentStageRef.current,
            stageFollowUpCount: stageFollowUpCountRef.current,
            messages: messagesRef.current,
            qaHistory: qaHistoryRef.current,
            questionsMap,
            activeCodingProblem: activeCodingProblemRef.current,
            code: codeRef.current,
            language: languageRef.current,
            codeByLanguage: codeByLanguageRef.current,
            interviewType,
            difficulty,
            duration,
            elapsedSeconds: next,
            completed: false,
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [inSession, questionsMap, interviewType, difficulty, duration, persistSessionSnapshot, user?.id]);

  const remainingSeconds = Math.max(0, duration * 60 - elapsedSeconds);
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start interview session
  const handleStartInterview = async (e) => {
    if (e) e.preventDefault();
    if (!user || inFlightRef.current || completing) return;

    if (!hasCandidateResume) {
      setSetupError('Please upload your resume before starting an AI interview.');
      return;
    }

    inFlightRef.current = true;
    setStarting(true);
    setSetupError('');

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}. Bio: ${profile?.bio || ''}`;

      const { interview: newInterview, questions: createdQuestions } = await startAIInterview({
        candidateId: user.id,
        candidateName,
        interviewType,
        difficulty,
        duration,
      });

      const qMap = {};
      (createdQuestions || []).forEach((q) => {
        const stageMatch = STAGE_ORDER.find((stg) => (q.question_text || '').toLowerCase().includes(stg));
        if (stageMatch) {
          qMap[stageMatch] = q.id;
        }
      });
      setQuestionsMap(qMap);

      // Select an appropriate coding problem ONCE for this entire interview session
      const selectedProblem = selectCodingProblem({ difficulty, track: interviewType });
      setActiveCodingProblem(selectedProblem);
      activeCodingProblemRef.current = selectedProblem;

      const initialLang = 'python';
      const initialStarter = getStarterCodeForProblem(selectedProblem, initialLang) || selectedProblem.starter_code?.python || '';
      setCode(initialStarter);
      codeRef.current = initialStarter;
      const initialCodeByLang = {
        python: selectedProblem.starter_code?.python || '',
        cpp: selectedProblem.starter_code?.cpp || '',
        java: selectedProblem.starter_code?.java || '',
        javascript: selectedProblem.starter_code?.javascript || '',
      };
      setCodeByLanguage(initialCodeByLang);
      codeByLanguageRef.current = initialCodeByLang;

      setInterview(newInterview);
      setInSession(true);
      setCurrentStage('introduction');
      setStageFollowUpCount(0);
      setIsAiTyping(true);

      const firstTurn = await sendAITurn({
        stage: 'introduction',
        candidateName,
        resumeText: resumeSummary,
        history: [],
        interviewType,
        difficulty,
        intent: 'ask_stage_question',
        followUpCount: 0,
      });

      if (completedRef.current) return;

      const initialMessage = {
        role: 'assistant',
        content: firstTurn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'introduction',
      };

      setMessages([initialMessage]);
      speakText(firstTurn.reply);

      persistSessionSnapshot({
        userId: user.id,
        interview: newInterview,
        currentStage: 'introduction',
        stageFollowUpCount: 0,
        messages: [initialMessage],
        qaHistory: [],
        questionsMap: qMap,
        activeCodingProblem: selectedProblem,
        code: initialStarter,
        language: initialLang,
        codeByLanguage: initialCodeByLang,
        interviewType,
        difficulty,
        duration,
        elapsedSeconds: 0,
        completed: false,
      });
    } catch (err) {
      console.error('[AIInterviewPage] Start error:', err);
      setSetupError(err.message || 'Failed to initialize AI interview.');
    } finally {
      inFlightRef.current = false;
      setStarting(false);
      setIsAiTyping(false);
    }
  };

  /**
   * Candidate sends response in dialogue:
   * - In stages where follow-up is eligible (resume_dive, technical, followup):
   *   If candidate answer needs probing or clarification and followUpCount < MAX_FOLLOWUPS,
   *   the AI asks an intelligent, targeted follow-up question while remaining in the current stage.
   *   Otherwise, the state machine deterministically advances to the next stage.
   * - In stage 5 (Coding): candidate can chat/ask questions with AI WITHOUT leaving coding view.
   */
  const handleSendResponse = async (textToSend) => {
    const trimmed = (textToSend || userInput || '').trim();
    if (!trimmed || inFlightRef.current || completedRef.current || isAiTyping) return;

    inFlightRef.current = true;
    if (isListening) {
      stopListening();
    }
    resetTranscript();

    const currentStageVal = currentStageRef.current;
    const currentFollowUpCount = stageFollowUpCountRef.current;

    const userMsg = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      stage: currentStageVal,
    };

    const updatedHistory = [...messagesRef.current, userMsg];
    setMessages(updatedHistory);
    setUserInput('');
    setIsAiTyping(true);

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}`;

      // Determine state machine transition vs. in-stage follow-up
      let nextStage = currentStageVal;
      let nextFollowUpCount = currentFollowUpCount;
      let intent = 'ask_stage_question';

      const isEligibleForFollowUp = FOLLOWUP_ELIGIBLE_STAGES.includes(currentStageVal);
      const canDoFollowUp = isEligibleForFollowUp && currentFollowUpCount < MAX_FOLLOWUPS_PER_STAGE;

      // In Coding Stage: check if candidate message indicates inability to solve or request to move on
      if (currentStageVal === 'coding') {
        const isSkipIntent = /(can'?t|cannot|unable to|not able to)\s+(solve|figure|code|do|complete)|i'?m stuck|give up|skip (this|the)?\s*(problem|question|coding)|move on|don'?t know how to (solve|approach|do)/i.test(trimmed);
        if (isSkipIntent) {
          inFlightRef.current = false;
          await transitionCodingOut({
            isSkip: true,
            skipReason: `Candidate indicated inability to solve: "${trimmed}"`,
            candidateSpokenText: trimmed,
          });
          return;
        }
      }

      if (currentStageVal === 'introduction') {
        nextStage = 'personal';
        nextFollowUpCount = 0;
      } else if (currentStageVal === 'personal') {
        nextStage = 'resume_dive';
        nextFollowUpCount = 0;
      } else if (currentStageVal === 'resume_dive') {
        if (canDoFollowUp) {
          nextStage = 'resume_dive';
          nextFollowUpCount = currentFollowUpCount + 1;
          intent = 'probe_followup';
        } else {
          nextStage = 'technical';
          nextFollowUpCount = 0;
        }
      } else if (currentStageVal === 'technical') {
        if (canDoFollowUp) {
          nextStage = 'technical';
          nextFollowUpCount = currentFollowUpCount + 1;
          intent = 'probe_followup';
        } else {
          nextStage = 'coding';
          nextFollowUpCount = 0;
        }
      } else if (currentStageVal === 'coding') {
        nextStage = 'coding';
        nextFollowUpCount = currentFollowUpCount;
        intent = 'clarify_coding';
      } else if (currentStageVal === 'followup') {
        if (canDoFollowUp) {
          nextStage = 'followup';
          nextFollowUpCount = currentFollowUpCount + 1;
          intent = 'probe_followup';
        } else {
          nextStage = 'evaluation';
          nextFollowUpCount = 0;
        }
      } else if (currentStageVal === 'evaluation') {
        nextStage = 'evaluation';
        nextFollowUpCount = 0;
        intent = 'closing_summary';
      }

      // Record question & answer pair for authoritative evaluation
      const lastAiQuestion = [...messagesRef.current].reverse().find((m) => m.role === 'assistant')?.content || '';
      const stageQuestionId = questionsMap[currentStageVal];

      if (interviewRef.current?.id && stageQuestionId) {
        saveCandidateAnswer({
          interviewId: interviewRef.current.id,
          questionId: stageQuestionId,
          candidateAnswer: trimmed,
          codeSnapshot: currentStageVal === 'coding' ? codeRef.current : '',
        }).catch((err) => console.warn('[AIInterviewPage] Answer persist warning:', err));
      }

      const newQaItem = {
        stage: currentStageVal,
        question: lastAiQuestion,
        answer: trimmed,
        codeSnapshot: currentStageVal === 'coding' ? codeRef.current : '',
        questionId: stageQuestionId,
        isFollowUp: intent === 'probe_followup',
      };
      const updatedQaHistory = [...qaHistoryRef.current, newQaItem];
      setQaHistory(updatedQaHistory);

      // Call AI turn with current context and follow-up depth
      const turn = await sendAITurn({
        stage: nextStage,
        candidateName,
        resumeText: resumeSummary,
        history: updatedHistory,
        lastUserMessage: trimmed,
        interviewType,
        difficulty,
        codingProblem: activeCodingProblemRef.current,
        code: codeRef.current,
        intent,
        followUpCount: nextFollowUpCount,
      });

      if (completedRef.current) return;

      const aiMsg = {
        role: 'assistant',
        content: turn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: nextStage,
      };

      setMessages([...updatedHistory, aiMsg]);
      setCurrentStage(nextStage);
      setStageFollowUpCount(nextFollowUpCount);
      speakText(turn.reply);

      // Stable Coding Problem Association
      let effectiveProb = activeCodingProblemRef.current;
      if (turn.codingProblem && !effectiveProb) {
        effectiveProb = turn.codingProblem;
        setActiveCodingProblem(turn.codingProblem);
        activeCodingProblemRef.current = turn.codingProblem;

        // Initialize code for current language if empty
        if (!codeRef.current) {
          const starter = turn.codingProblem.starter_code?.[languageRef.current] || CODE_TEMPLATES[languageRef.current] || '';
          setCode(starter);
          codeRef.current = starter;
        }
      }

      persistSessionSnapshot({
        userId: user.id,
        interview: interviewRef.current,
        currentStage: nextStage,
        stageFollowUpCount: nextFollowUpCount,
        messages: [...updatedHistory, aiMsg],
        qaHistory: updatedQaHistory,
        questionsMap,
        activeCodingProblem: effectiveProb,
        code: codeRef.current,
        language: languageRef.current,
        codeByLanguage: codeByLanguageRef.current,
        interviewType,
        difficulty,
        duration,
        elapsedSeconds,
        completed: false,
      });
    } catch (err) {
      console.error('[AIInterviewPage] Turn error:', err);
      if (!completedRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I noted your response. Let's proceed forward with the next part of our discussion.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            stage: currentStageVal,
          },
        ]);
      }
    } finally {
      inFlightRef.current = false;
      setIsAiTyping(false);
    }
  };

  /**
   * Unified transition out of Coding stage:
   * Handles both successful code submissions and candidate skip / "can't solve" actions.
   */
  const transitionCodingOut = async ({ isSkip = false, skipReason = '', candidateSpokenText = '' } = {}) => {
    if (inFlightRef.current || completedRef.current || currentStageRef.current !== 'coding') return;

    inFlightRef.current = true;
    setIsAiTyping(true);

    try {
      const candidateName = profile?.full_name || user.email?.split('@')[0] || 'Candidate';
      const resumeSummary = candidateResume?.rawText || `Skills: ${(profile?.skills || []).join(', ')}`;
      const currentProb = activeCodingProblemRef.current || DEFAULT_CODING_PROBLEM;

      const outcome = isSkip ? 'skipped' : 'submitted';
      const answerText = isSkip
        ? `[SKIPPED] ${skipReason || 'Candidate indicated they were unable to solve this problem and requested to move forward.'}`
        : `Completed coding solution submitted in ${languageRef.current.toUpperCase()}.`;

      const codingQuestionId = questionsMap['coding'];
      if (interviewRef.current?.id && codingQuestionId) {
        await saveCandidateAnswer({
          interviewId: interviewRef.current.id,
          questionId: codingQuestionId,
          candidateAnswer: answerText,
          codeSnapshot: codeRef.current || '',
        });
      }

      const codingQa = {
        stage: 'coding',
        question: currentProb ? `${currentProb.title} (${currentProb.topic})` : 'Live Coding Challenge',
        answer: answerText,
        codeSnapshot: codeRef.current || '',
        language: languageRef.current,
        questionId: codingQuestionId,
        codingOutcome: outcome,
      };
      const updatedQa = [...qaHistoryRef.current, codingQa];
      setQaHistory(updatedQa);

      const nextStage = 'followup';
      setCurrentStage(nextStage);
      setStageFollowUpCount(0);

      const userNote = {
        role: 'user',
        content: isSkip
          ? `[Skipped coding problem: "${currentProb.title}"] ${candidateSpokenText ? `Candidate: "${candidateSpokenText}"` : ''}`
          : `[Submitted ${languageRef.current.toUpperCase()} coding solution for "${currentProb.title}"]`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: nextStage,
      };

      const updatedHistory = [...messagesRef.current, userNote];
      setMessages(updatedHistory);

      const turn = await sendAITurn({
        stage: nextStage,
        candidateName,
        resumeText: resumeSummary,
        history: updatedHistory,
        lastUserMessage: isSkip
          ? (candidateSpokenText || "I wasn't able to complete the code for this problem. Let's move on to discuss the approach or other questions.")
          : `I have completed my ${languageRef.current} code solution and submitted it for review.`,
        interviewType,
        difficulty,
        codingProblem: currentProb,
        code: codeRef.current || '',
        intent: isSkip ? 'skip_coding' : 'ask_stage_question',
        followUpCount: 0,
      });

      if (completedRef.current) return;

      const aiMsg = {
        role: 'assistant',
        content: turn.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: nextStage,
      };

      setMessages([...updatedHistory, aiMsg]);
      speakText(turn.reply);

      persistSessionSnapshot({
        userId: user.id,
        interview: interviewRef.current,
        currentStage: nextStage,
        stageFollowUpCount: 0,
        messages: [...updatedHistory, aiMsg],
        qaHistory: updatedQa,
        questionsMap,
        activeCodingProblem: currentProb,
        code: codeRef.current,
        language: languageRef.current,
        codeByLanguage: codeByLanguageRef.current,
        interviewType,
        difficulty,
        duration,
        elapsedSeconds,
        completed: false,
        codingOutcome: outcome,
      });
    } catch (err) {
      console.error('[AIInterviewPage] Coding transition error:', err);
    } finally {
      inFlightRef.current = false;
      setIsAiTyping(false);
    }
  };

  /**
   * Candidate completes coding and clicks "Submit Solution & Continue to Review"
   */
  const handleCompleteCodingStage = async () => {
    await transitionCodingOut({ isSkip: false });
  };

  /**
   * Candidate cannot solve and clicks "I Can't Solve This" skip button
   */
  const handleSkipCodingStage = async () => {
    if (inFlightRef.current || completedRef.current || currentStage !== 'coding') return;
    const confirmed = window.confirm(
      "Are you sure you want to move on? This problem will be recorded as skipped, and you will proceed to complexity & conceptual questions."
    );
    if (!confirmed) return;

    await transitionCodingOut({
      isSkip: true,
      skipReason: 'Candidate chose to skip via "I Can\'t Solve This" button.',
    });
  };

  // Complete session & evaluate
  const handleCompleteInterview = async () => {
    if (!interview?.id || completing || completedRef.current) return;
    if (!window.confirm('Finish this interview and generate your AI evaluation report?')) return;

    completedRef.current = true;
    inFlightRef.current = true;
    setCompleting(true);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      const allQas = qaHistoryRef.current;
      for (const item of allQas) {
        if (item.questionId) {
          await saveCandidateAnswer({
            interviewId: interview.id,
            questionId: item.questionId,
            candidateAnswer: item.answer || '',
            codeSnapshot: item.codeSnapshot || '',
          }).catch((e) => console.warn('[AIInterviewPage] Answer batch save warning:', e));
        }
      }

      await completeInterviewSession(interview.id);

      await requestEvaluation(interview.id, {
        transcript: messagesRef.current,
        qaHistory: allQas,
        codeSnapshot: codeRef.current,
      }).catch((e) => console.warn('[AIInterviewPage] Pre-eval request warning:', e));

      sessionStorage.removeItem(SESSION_STORAGE_KEY);

      navigate(`/interview/results/${interview.id}`);
    } catch (err) {
      console.error('[AIInterviewPage] Complete error:', err);
      alert('Failed to complete interview: ' + err.message);
      setCompleting(false);
      completedRef.current = false;
    } finally {
      inFlightRef.current = false;
    }
  };

  // 1. RESUME REQUIRED SCREEN (PRE-FLIGHT)
  if (!checkingResume && hasCandidateResume === false) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', maxWidth: '640px' }}>
        <div className="card" style={{ padding: '3rem 2.5rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
          }}>
            <FileText size={32} color="#f59e0b" />
          </div>

          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: '#f9fafb' }}>
            Resume Required
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Upload your resume before starting an AI interview. MockMate uses your resume to personalize questions, explore your real projects, and evaluate your architectural decisions.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/profile" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span>Go to Profile & Upload Resume</span>
            </Link>
            <Link to="/candidate/dashboard" className="btn btn-outline btn-lg">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. SETUP SCREEN (Resume verified)
  if (!inSession) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '780px' }}>
        <Link to="/candidate/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bot size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', margin: 0, color: '#f9fafb' }}>
                AI Mock Interview
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Evidence-Based Technical Simulation with Adaptive Follow-ups
              </p>
            </div>
          </div>

          {setupError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span>{setupError}</span>
            </div>
          )}

          {/* Resume Confirmation Banner */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="#10b981" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f9fafb' }}>
                  Resume Verified
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Questions will reference your real projects, languages, and technical experience.
                </div>
              </div>
            </div>
            <Link to="/profile" className="btn btn-outline btn-xs">
              Change
            </Link>
          </div>

          <form onSubmit={handleStartInterview}>
            {/* Track Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Interview Track
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {TRACK_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInterviewType(t)}
                    style={{
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: interviewType === t ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                      background: interviewType === t ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      color: interviewType === t ? '#fff' : 'var(--text-secondary)',
                      fontWeight: interviewType === t ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      fontSize: '0.9rem',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Difficulty Level
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: difficulty === d ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                      background: difficulty === d ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      color: difficulty === d ? '#fff' : 'var(--text-secondary)',
                      fontWeight: difficulty === d ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      fontSize: '0.9rem',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="form-group" style={{ marginBottom: '2.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Session Duration
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: duration === opt.value ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                      background: duration === opt.value ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                      color: duration === opt.value ? '#fff' : 'var(--text-secondary)',
                      fontWeight: duration === opt.value ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <Clock size={16} />
                    <span style={{ fontSize: '0.875rem' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Structured Stages Preview */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '2rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                Interview Blueprint (7 Structured Stages)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {STAGES.map((s, idx) => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}>
                      {idx + 1}
                    </div>
                    <span>{s.label.split('. ')[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={starting}
              className="btn btn-primary btn-lg"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.05rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
              }}
            >
              {starting ? (
                <>
                  <RotateCw size={20} className="spin" />
                  <span>Preparing AI Interviewer & Analyzing Resume...</span>
                </>
              ) : (
                <>
                  <Play size={20} />
                  <span>Start AI Interview</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. LIVE INTERVIEW SESSION
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#0a0d14' }}>
      {/* TOP BAR: Session Info & Stage Indicator */}
      <div style={{
        background: '#0d111b',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left: AI Interviewer Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
          }}>
            <Bot size={20} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f9fafb' }}>
                Alex Vance (AI Interviewer)
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                Adaptive Engine
              </span>
              <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                {interviewType} • {difficulty}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Resume-Aware Adaptive Session
            </div>
          </div>
        </div>

        {/* Center: Stage Progress Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {STAGES.map((s, idx) => {
            const stageOrder = STAGES.findIndex((x) => x.key === currentStage);
            const isPast = idx < stageOrder;
            const isCurrent = idx === stageOrder;

            return (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isCurrent ? 'rgba(99, 102, 241, 0.2)' : isPast ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  border: isCurrent ? '1px solid #6366f1' : '1px solid transparent',
                  color: isCurrent ? '#a5b4fc' : isPast ? '#34d399' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: isCurrent ? 700 : 500,
                  transition: 'all 0.2s ease',
                }}
              >
                {isPast ? <Check size={12} /> : <span>{idx + 1}</span>}
                <span className="hide-mobile">{s.label.split('. ')[1]}</span>
                {idx < STAGES.length - 1 && (
                  <ChevronRight size={12} color="var(--border-subtle)" style={{ marginLeft: '0.2rem' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Timer, Voice Toggle, Complete Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--bg-input)',
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: remainingSeconds < 300 ? '#ef4444' : '#f9fafb',
          }}>
            <Clock size={15} />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="btn btn-ghost btn-sm"
            style={{ color: voiceEnabled ? '#10b981' : 'var(--text-muted)' }}
            title={voiceEnabled ? 'Voice output enabled' : 'Voice output muted'}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          <button
            onClick={handleCompleteInterview}
            disabled={completing}
            className="btn btn-outline btn-sm"
            style={{ borderColor: '#6366f1', color: '#a5b4fc' }}
          >
            {completing ? 'Concluding...' : 'Finish & Evaluate'}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: currentStage === 'coding' ? '1fr 380px' : '1fr 320px', overflow: 'hidden' }}>
        
        {/* LEFT / CENTER VIEW */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* STAGE 5: CODING SPLIT VIEW (Resizable: Problem Panel + Drag Divider + Monaco IDE) */}
          {currentStage === 'coding' ? (
            <div style={{ 
              flex: 1, 
              display: 'grid', 
              gridTemplateColumns: `${codingPanelWidth}px 6px 1fr`, 
              height: '100%', 
              overflow: 'hidden',
              userSelect: isResizingCoding ? 'none' : 'auto',
            }}>
              {/* Problem Description Panel */}
              <div style={{ height: '100%', overflowY: 'auto', borderRight: '1px solid var(--border-subtle)', background: '#0d1321' }}>
                <LeetCodeQuestionPanel
                  question={activeCodingProblem || DEFAULT_CODING_PROBLEM}
                  activeQuestion={activeCodingProblem || DEFAULT_CODING_PROBLEM}
                  questions={[activeCodingProblem || DEFAULT_CODING_PROBLEM]}
                />
              </div>

              {/* Draggable Vertical Resizing Divider */}
              <div
                onMouseDown={handleMouseDownCodingResize}
                title="Drag to resize Problem Panel and Code Editor"
                style={{
                  width: '6px',
                  cursor: 'col-resize',
                  background: isResizingCoding ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                  zIndex: 10,
                  transition: isResizingCoding ? 'none' : 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: '2px', height: '32px', background: isResizingCoding ? '#a5b4fc' : 'rgba(255, 255, 255, 0.25)', borderRadius: '1px' }} />
              </div>

              {/* Monaco Code Editor with Language Selector, Reset & Submit/Skip Action Buttons */}
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CollaborativeCodeEditor
                    code={code}
                    language={language}
                    onCodeChange={handleCodeChange}
                    onLanguageChange={handleLanguageChange}
                    onResetTemplate={handleResetTemplate}
                    interviewId={interview?.id || 'mock-ai-room'}
                    questionId={activeCodingProblem?.id || 'two-sum'}
                    readOnly={false}
                  />
                </div>
                
                {/* Submit Solution & Skip Bar */}
                <div style={{
                  padding: '0.75rem 1.25rem',
                  background: '#0d111b',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Language: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{language.toUpperCase()}</span> • Ask questions in the sidebar or submit your code to continue.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={handleSkipCodingStage}
                      disabled={isAiTyping || inFlightRef.current}
                      className="btn btn-outline-danger btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        background: 'rgba(239, 68, 68, 0.05)',
                        cursor: isAiTyping || inFlightRef.current ? 'not-allowed' : 'pointer',
                      }}
                      title="Skip this coding problem if you are stuck or unable to solve it"
                    >
                      <HelpCircle size={15} />
                      <span>I Can't Solve This</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteCodingStage}
                      disabled={isAiTyping || inFlightRef.current}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Submit Solution & Continue to Review</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STAGES 1-4, 6-7: CONVERSATIONAL STAGE VIEW */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Stage Banner */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.05)',
                borderBottom: '1px solid var(--border-subtle)',
                padding: '0.75rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Sparkles size={16} color="#818cf8" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f9fafb' }}>
                    {STAGES.find((s) => s.key === currentStage)?.label}: {STAGES.find((s) => s.key === currentStage)?.desc}
                  </span>
                  {stageFollowUpCount > 0 && (
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                      Follow-up In Progress
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Alex is analyzing your reasoning, depth, and communication.
                </div>
              </div>

              {/* Chat Message Scroll List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}>
                {messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.35rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                      }}>
                        {isUser ? (
                          <>
                            <span>{m.timestamp}</span>
                            <span style={{ fontWeight: 600, color: '#cbd5e1' }}>You</span>
                            <User size={14} />
                          </>
                        ) : (
                          <>
                            <Bot size={14} color="#818cf8" />
                            <span style={{ fontWeight: 600, color: '#a5b4fc' }}>Alex Vance</span>
                            <span>{m.timestamp}</span>
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          padding: '1rem 1.25rem',
                          borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isUser ? '#4f46e5' : '#1e293b',
                          color: '#fff',
                          fontSize: '0.95rem',
                          lineHeight: '1.6',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}

                {isAiTyping && (
                  <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a5b4fc', fontSize: '0.85rem' }}>
                    <RotateCw size={14} className="spin" />
                    <span>Alex is thinking & analyzing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* CANDIDATE INPUT AREA (Always pinned at bottom of center area) */}
          <div style={{
            background: '#0d111b',
            borderTop: '1px solid var(--border-subtle)',
            padding: '1rem 1.5rem',
            flexShrink: 0,
          }}>
            {/* Input Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setInputMode('speak')}
                  className={`btn btn-xs ${inputMode === 'speak' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Mic size={14} />
                  <span>Voice (Speech-to-Text)</span>
                </button>
                <button
                  onClick={() => setInputMode('type')}
                  className={`btn btn-xs ${inputMode === 'type' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Keyboard size={14} />
                  <span>Keyboard Typing</span>
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {inputMode === 'speak' ? 'Click microphone to speak naturally' : 'Press Enter to submit answer'}
              </div>
            </div>

            {/* SPEAK MODE: Large Voice Capture Interface */}
            {inputMode === 'speak' && (
              <div style={{
                background: 'var(--bg-input)',
                border: isListening ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: isListening ? '#ef4444' : '#6b7280',
                      boxShadow: isListening ? '0 0 8px #ef4444' : 'none',
                    }} />
                    <span style={{ fontSize: '0.875rem', color: isListening ? '#f87171' : 'var(--text-secondary)' }}>
                      {isListening ? 'Listening to your microphone... speak clearly' : transcript ? 'Voice captured. You can send or edit below.' : 'Microphone idle. Click the button to start speaking.'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (isListening) {
                        stopListening();
                      } else {
                        resetTranscript();
                        startListening();
                      }
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: isListening ? '#ef4444' : '#6366f1',
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isListening ? '0 0 16px rgba(239, 68, 68, 0.5)' : '0 0 12px rgba(99, 102, 241, 0.4)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                    title={isListening ? 'Stop Listening' : 'Click to Speak'}
                  >
                    {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                  </button>
                </div>

                {/* Transcript Action Controls */}
                {transcript && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      onClick={() => {
                        stopListening();
                        setUserInput(transcript);
                        setInputMode('type');
                      }}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Edit3 size={13} />
                      <span>Edit Transcript</span>
                    </button>
                    <button
                      onClick={() => handleSendResponse(transcript)}
                      disabled={isAiTyping || inFlightRef.current}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Send size={13} />
                      <span>Send Answer</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TYPE MODE: Direct Text Input Bar */}
            {inputMode === 'type' && (
              <form onSubmit={(e) => { e.preventDefault(); handleSendResponse(userInput); }} style={{ display: 'flex', gap: '0.75rem' }}>
                <textarea
                  rows={2}
                  placeholder="Type your response to the interviewer..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendResponse(userInput);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    color: '#f9fafb',
                    fontSize: '0.925rem',
                    resize: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!userInput.trim() || isAiTyping || inFlightRef.current}
                  className="btn btn-primary"
                  style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Send size={16} />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: 7-STAGE PROGRESS & RESUME CONTEXT */}
        <div style={{
          background: '#0e1422',
          borderLeft: '1px solid var(--border-subtle)',
          padding: '1.75rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          overflowY: 'auto',
        }}>
          {/* Stepper Header */}
          <div>
            <h3 style={{ fontSize: '1rem', color: '#f9fafb', marginBottom: '0.25rem' }}>
              Interview Progress
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Deterministic 7-Stage State Machine
            </p>
          </div>

          {/* Stepper Progress List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {STAGES.map((s, idx) => {
              const stageOrder = STAGES.findIndex((x) => x.key === currentStage);
              const isPast = idx < stageOrder;
              const isCurrent = idx === stageOrder;

              return (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isCurrent ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    border: isCurrent ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isPast ? '#10b981' : isCurrent ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {isPast ? <Check size={13} /> : idx + 1}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#a5b4fc' : isPast ? '#94a3b8' : 'var(--text-muted)' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resume Analyzed Card */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#10b981' }}>
              <CheckCircle2 size={16} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Resume: Analyzed</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4, margin: '0 0 0.65rem 0' }}>
              Alex is examining projects and tech stacks extracted from your verified resume.
            </p>

            {profile?.skills && profile.skills.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {(Array.isArray(profile.skills) ? profile.skills : profile.skills.split(',')).slice(0, 4).map((sk, skIdx) => (
                  <span key={skIdx} className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                    {typeof sk === 'string' ? sk.trim() : sk}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current Topic Indicator */}
          <div style={{ marginTop: 'auto', background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem', fontWeight: 600 }}>
              Current Focus
            </div>
            <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
              {currentStage === 'introduction' ? 'Candidate Introduction'
                : currentStage === 'personal' ? 'Experience & Passion'
                : currentStage === 'resume_dive' ? (stageFollowUpCount > 0 ? 'Project Architecture (Deep Dive)' : 'Project Architecture')
                : currentStage === 'technical' ? (stageFollowUpCount > 0 ? 'Core Concepts (Probing Trade-offs)' : 'Core Concepts & Trade-offs')
                : currentStage === 'coding' ? 'Live Coding Solution'
                : currentStage === 'followup' ? (stageFollowUpCount > 0 ? 'Complexity & Optimization Follow-up' : 'Time & Space Complexity')
                : 'Session Wrap-up'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
