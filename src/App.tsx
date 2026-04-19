import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, ensureAuth, testFirestoreConnection } from './lib/firebase';
import { 
  Zap, 
  Wind, 
  MapPin, 
  Users, 
  Trophy, 
  Activity, 
  Youtube, 
  RefreshCw,
  Thermometer,
  CloudSun,
  AlertTriangle,
  MessageSquare,
  Send,
  User,
  ShieldAlert,
  Sparkles,
  Globe,
  Search,
  Settings,
  Dumbbell,
  Key,
  X,
  ChevronDown
} from 'lucide-react';
import { FitnessForge } from './components/FitnessForge';

type AppMode = 'tactical' | 'fitness';

interface PlayerContext {
  name: string;
  role: string;
  historical_context: string;
  youtube_video: string;
  status: 'pending' | 'ready' | 'loading';
}

interface MatchInfo {
  match: string;
  batting_team: string;
  bowling_team: string;
  batting_squad: string[];
  bowling_squad: string[];
  stadium: string;
  stadium_capacity: number;
  is_home_game: boolean;
  target: number;
  current_score: number;
  wickets_lost: number;
  overs_completed: number;
  current_batter: string;
  current_bowler: string;
  weather: {
    temp: number;
    humidity: number;
    condition: string;
  };
}

interface Analytics {
  pressure_score: number;
  rrr: number;
  status: string;
  meter_color: string;
  reactions: {
    batter: string;
    bowler: string;
  };
}

interface DashboardData {
  match_info: MatchInfo;
  analytics: Analytics;
  youtube_search: string;
}

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

const PressureGauge = ({ score, color }: { score: number; color: string }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />
      <svg className="w-48 h-48 transform -rotate-90">
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="12"
          fill="transparent"
        />
        <motion.circle
          cx="96"
          cy="96"
          r={radius}
          stroke={color}
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          key={score}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold font-mono tracking-tighter"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-1 text-center">Pressure<br/>Index</span>
      </div>
    </div>
  );
};

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('tactical');
  const [showSettings, setShowSettings] = useState(false);
  const [customKey, setCustomKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userName, setUserName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [overPrediction, setOverPrediction] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [squadContext, setSquadContext] = useState<Record<string, PlayerContext>>({});
  const [fetchingSquad, setFetchingSquad] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [isGrounded, setIsGrounded] = useState(false);
  const [groundingStatus, setGroundingStatus] = useState<'idle' | 'fetching' | 'synced' | 'limited'>('idle');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setGroundingStatus('fetching');
    setError(null);
    try {
      // Safely access GEMINI_API_KEY
      const apiKey = customKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : (import.meta as any).env.VITE_GEMINI_API_KEY);
      
      if (!apiKey) {
         throw new Error("GE_KEY_MISSING");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Identify a high-profile live cricket match happening today (${new Date().toLocaleDateString()}). 
        Extract current match details: Teams, Stadium, Batting team, Bowling team, Score, Wickets, Overs, Striker, and Bowler.
        Search for "live cricket score ipl" or "live cricket score international" to get the most recent data. 
        If no high-profile live match is found, find the most recent completed match today.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              match: { type: Type.STRING },
              batting_team: { type: Type.STRING },
              bowling_team: { type: Type.STRING },
              stadium: { type: Type.STRING },
              score: { type: Type.INTEGER, description: "Current score in runs" },
              wickets: { type: Type.INTEGER, description: "Current wickets lost" },
              overs: { type: Type.NUMBER, description: "Current overs completed" },
              batter: { type: Type.STRING },
              bowler: { type: Type.STRING },
              target: { type: Type.INTEGER, description: "Target score if known, or 200" }
            },
            required: ["match", "batting_team", "bowling_team", "score", "wickets", "overs", "batter", "bowler"]
          }
        }
      });

      const discovered = JSON.parse(response.text || "{}");
      
      const match_info: MatchInfo = {
        match: discovered.match || "Match Simulation",
        batting_team: discovered.batting_team || "Batting Squad",
        bowling_team: discovered.bowling_team || "Bowling Squad",
        stadium: discovered.stadium || "Global Digital Stadium",
        stadium_capacity: 45000,
        is_home_game: false,
        target: discovered.target || 180,
        current_score: discovered.score || 75,
        wickets_lost: discovered.wickets || 2,
        overs_completed: discovered.overs || 8.4,
        current_batter: discovered.batter || "In Form Batter",
        current_bowler: discovered.bowler || "Aggressive Bowler",
        weather: { temp: 30, humidity: 40, condition: "Clear" },
        batting_squad: [],
        bowling_squad: []
      };

      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_info })
      });
      
      const result = await analysisResponse.json();
      setData(result);
      
      if (result) {
        setGroundingStatus('synced');
        setIsGrounded(true);
        setIsRateLimited(false);
        
        // Stagger dependent AI calls to avoid 429 Rate Limits
        setTimeout(() => analyzeHistoricalMoments(result.match_info.current_batter, result.analytics.status), 1000);
        setTimeout(() => generateOverPrediction(result.match_info, result.analytics), 3000);
        setTimeout(() => fetchFullSquad(result.match_info.match, result.match_info.batting_team, result.match_info.bowling_team), 5000);
      }
    } catch (error: any) {
      console.error("Discovery error, falling back to simulation:", error);
      
      const is429 = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      if (is429) {
        setIsRateLimited(true);
        setGroundingStatus('limited');
      }

      if (error?.message === "GE_KEY_MISSING") {
        setError("Gemini API Key is missing. Please configure it in the settings menu.");
      }

      // Fallback to legacy mock for stability if discovery fails
      try {
        const response = await fetch('/api/live-match');
        const result = await response.json();
        setData(result);
        if (!is429) setGroundingStatus('idle');
      } catch (fallbackError) {
        console.error("Critical failure: Fallback also failed.", fallbackError);
        setError("System failed to initialize. Please check server logs.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getGeminiChatResponse = async (userMsg: string) => {
    if (!data || aiResponding) return;
    setAiResponding(true);
    try {
      const apiKey = customKey || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an expert cricket analyst responding to a fan in a live chat for the match ${data.match_info.match}. 
        Situation: ${data.match_info.current_score}/${data.match_info.wickets_lost} after ${data.match_info.overs_completed} overs. 
        Strees score: ${data.analytics.pressure_score}/100.
        User said: "${userMsg}"
        Respond as 'Gemini AI' with a brief, witty, and analytical insight (max 30 words). Be conversational.`
      });
      
      if (response.text) {
        await addDoc(collection(db, 'messages'), {
          user: 'Gemini AI',
          text: response.text,
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Gemini chat response error:", error);
    } finally {
      setAiResponding(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      
      // Clear previous timer
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);

      // If last message is not from Gemini AI, wait for 10 seconds for a human to reply
      if (lastMsg.user !== 'Gemini AI') {
        aiTimeoutRef.current = setTimeout(() => {
          // If no new messages arrived in 6 seconds (reduced for snappier demo), Gemini responds
          getGeminiChatResponse(lastMsg.text);
        }, 6000); 
      }
    }
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [messages, data]);

  const fetchFullSquad = async (match: string, teamA: string, teamB: string) => {
    if (fetchingSquad) return;
    setFetchingSquad(true);
    try {
      const apiKey = customKey || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find the official playing 11 squad for both teams in the match ${match} (Teams: ${teamA} vs ${teamB}) today. 
        Return as JSON with keys: "batting_squad" (array of strings) and "bowling_squad" (array of strings).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              batting_squad: { type: Type.ARRAY, items: { type: Type.STRING } },
              bowling_squad: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["batting_squad", "bowling_squad"]
          }
        }
      });

      const squadData = JSON.parse(response.text || "{}");
      if (squadData.batting_squad) {
        setData(prev => prev ? ({
          ...prev,
          match_info: {
            ...prev.match_info,
            batting_squad: squadData.batting_squad,
            bowling_squad: squadData.bowling_squad
          }
        }) : null);

        // Initialize empty context for new players
        const allPlayers = [...squadData.batting_squad, ...squadData.bowling_squad];
        setSquadContext(prev => {
           const next = { ...prev };
           allPlayers.forEach(p => {
             if (!next[p]) next[p] = { name: p, role: 'Player', historical_context: '', youtube_video: '', status: 'pending' };
           });
           return next;
        });
      }
    } catch (error) {
      console.error("Squad fetch error:", error);
    } finally {
      setFetchingSquad(false);
    }
  };

  const buildPlayerContext = async (playerName: string) => {
    if (squadContext[playerName]?.status === 'ready' || squadContext[playerName]?.status === 'loading') return;
    
    setSquadContext(prev => ({
      ...prev,
      [playerName]: { ...prev[playerName], status: 'loading' }
    }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Research historical data for cricket player ${playerName}. 
        Find:
        1. A summary of their historical performance under extreme pressure (focus, crowd interaction, mental state).
        2. A specific search query for a YouTube video of one of their high-pressure matches.
        Keep the summary short (50 words). Return as JSON: {"history": "...", "video_query": "..."}`
      });

      const profile = JSON.parse(response.text || "{}");
      setSquadContext(prev => ({
        ...prev,
        [playerName]: {
          ...prev[playerName],
          historical_context: profile.history,
          youtube_video: `https://www.youtube.com/results?search_query=${encodeURIComponent(profile.video_query || playerName)}`,
          status: 'ready'
        }
      }));
    } catch (error) {
      console.error(`Context error for ${playerName}:`, error);
      setSquadContext(prev => ({
        ...prev,
        [playerName]: { ...prev[playerName], status: 'pending' }
      }));
    }
  };

  const generateOverPrediction = async (matchInfo: MatchInfo, analytics: Analytics) => {
    setPredicting(true);
    try {
      const apiKey = customKey || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Predict the outcome of the current over in this cricket match. 
        Context: ${matchInfo.match}. 
        Batter: ${matchInfo.current_batter}. 
        Bowler: ${matchInfo.current_bowler}. 
        Pressure Score: ${analytics.pressure_score}/100. 
        Current State: ${analytics.status}.
        Provide a short (max 40 words), bold, and exciting prediction for the fans in the chat. Focus on momentum shifts.`
      });
      setOverPrediction(response.text || null);
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setPredicting(false);
    }
  };

  const fetchGroundedScore = async () => {
    if (!data || isRateLimited) return;
    setGroundingStatus('fetching');
    try {
      const apiKey = customKey || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Search for the latest LIVE score of the ${data.match_info.match} cricket match today. 
        Extract:
        1. Current score (total runs)
        2. Wickets lost
        3. Overs completed
        4. Name of the BATTER currently facing (the striker)
        5. Name of the BOWLER currently bowling
        Provide this exactly as a JSON object with keys: "score" (number), "wickets" (number), "overs" (number), "batter" (string), "bowler" (string).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              wickets: { type: Type.NUMBER },
              overs: { type: Type.NUMBER },
              batter: { type: Type.STRING },
              bowler: { type: Type.STRING }
            },
            required: ["score", "wickets", "overs", "batter", "bowler"]
          }
        }
      });

      const groundedData = JSON.parse(response.text || "{}");
      if (groundedData.score !== undefined) {
        // Check if batter changed to trigger new analysis
        const batterChanged = data.match_info.current_batter !== groundedData.batter;
        
        setData(prev => prev ? ({
          ...prev,
          match_info: {
            ...prev.match_info,
            current_score: groundedData.score,
            wickets_lost: groundedData.wickets,
            overs_completed: groundedData.overs,
            current_batter: groundedData.batter,
            current_bowler: groundedData.bowler
          }
        }) : null);

        if (batterChanged) {
          analyzeHistoricalMoments(groundedData.batter, data.analytics.status);
          generateOverPrediction({
            ...data.match_info,
            current_batter: groundedData.batter,
            current_bowler: groundedData.bowler
          }, data.analytics);
        }

        setGroundingStatus('synced');
        setIsGrounded(true);
        setIsRateLimited(false);
      }
    } catch (error: any) {
      console.error("Grounding error:", error);
      if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
        setIsRateLimited(true);
        setGroundingStatus('limited');
        // Retry after 5 minutes
        setTimeout(() => setIsRateLimited(false), 300000);
      } else {
        setGroundingStatus('idle');
      }
    }
  };

  const analyzeHistoricalMoments = async (player: string, situation: string) => {
    setAnalyzingVideo(true);
    try {
      const apiKey = customKey || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Describe how the player ${player} typically reacts when facing ${situation} in historical live cricket matches. Mention a specific famous match context if possible, highlighting his physiological response (focus, body language) and how he silences hostile crowds. Keep it professional and immersive, maximum 80 words.`
      });
      setGeminiAnalysis(response.text || null);
    } catch (error) {
      console.error("Gemini analysis error:", error);
      setGeminiAnalysis("The intelligence engine is currently recalibrating historical data.");
    } finally {
      setAnalyzingVideo(false);
    }
  };

  useEffect(() => {
    fetchData();
    testFirestoreConnection();

    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          user: data.user,
          text: data.text,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
        };
      });
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, []);

  // Grounded Score Refresh Interval (Real-time attempt)
  useEffect(() => {
    // Calling Gemini Search constantly every 1s is risky. 
    // We update every 60s to maintain grounding integrity and avoid 429 errors.
    const interval = setInterval(() => {
      fetchGroundedScore();
    }, 60000); 

    return () => clearInterval(interval);
  }, [data?.match_info?.match, isRateLimited]); 

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleJoinChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() && !isSigningIn) {
      setIsSigningIn(true);
      try {
        await ensureAuth();
        setHasJoined(true);
      } catch (error) {
        console.error("Join chat auth error:", error);
      } finally {
        setIsSigningIn(false);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && hasJoined) {
      try {
        await addDoc(collection(db, 'messages'), {
          user: userName,
          text: inputMessage.trim(),
          timestamp: serverTimestamp()
        });
        setInputMessage('');
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const match_info = data?.match_info;
  const analytics = data?.analytics;
  const youtube_search = data?.youtube_search;

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans p-6 md:p-8 selection:bg-accent-orange/30 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header - Persistent across modes */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 relative z-[100]">
          <div className="flex items-center gap-4 flex-wrap">
             <div className="flex flex-col">
                <div className="flex items-center gap-2">
                   <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Cricket Pulse</h1>
                   <div className="px-2 py-0.5 bg-accent-orange text-bg rounded text-[8px] font-bold uppercase tracking-wider">v2.0</div>
                </div>
                <p className="text-[10px] text-text-dim uppercase font-bold tracking-[0.3em] mt-1">Live Tactical Dashboard</p>
             </div>
             
             {/* Mode Switcher */}
             <div className="flex bg-surface border border-border rounded-lg p-1">
                <button 
                  onClick={() => setAppMode('tactical')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    appMode === 'tactical' ? 'bg-accent-orange text-bg shadow-sm' : 'text-text-dim hover:text-white'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  Tactical
                </button>
                <button 
                   onClick={() => setAppMode('fitness')}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    appMode === 'fitness' ? 'bg-accent-orange text-bg shadow-sm' : 'text-text-dim hover:text-white'
                  }`}
                >
                  <Dumbbell className="w-3 h-3" />
                  Fitness
                </button>
             </div>

             <AnimatePresence>
               {isGrounded && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full border ml-2 ${
                      groundingStatus === 'synced' ? 'bg-accent-green/10 border-accent-green/20' : 
                      groundingStatus === 'limited' ? 'bg-yellow-500/10 border-yellow-500/20' : 
                      'bg-slate-500/10 border-slate-500/20'
                    }`}
                  >
                    <Globe className={`w-3 h-3 ${
                      groundingStatus === 'synced' ? 'text-accent-green' : 
                      groundingStatus === 'limited' ? 'text-yellow-400' : 
                      'text-slate-400'
                    } ${groundingStatus === 'fetching' ? 'animate-spin' : 'animate-[spin_10s_linear_infinite]'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      groundingStatus === 'synced' ? 'text-accent-green' : 
                      groundingStatus === 'limited' ? 'text-yellow-400' : 
                      'text-slate-400'
                    }`}>
                      {groundingStatus === 'synced' ? 'Google Grounded' : 
                       groundingStatus === 'limited' ? 'Quota Limited' : 
                       'Simulation Sync'}
                    </span>
                  </motion.div>
               )}
             </AnimatePresence>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block">
              <div className="text-sm font-semibold truncate max-w-[200px]">{data?.match_info?.stadium || 'Global Acoustics Active'}</div>
              <div className="text-[9px] text-text-dim font-bold uppercase tracking-[0.1em]">Biomechanics Active Monitoring</div>
            </div>

            {/* Settings Trigger */}
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3 rounded-xl border transition-all ${
                  showSettings ? 'border-accent-orange bg-accent-orange text-bg' : 'bg-surface border-border text-white hover:border-accent-orange/40'
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-72 bg-[#0c0c16] border border-border shadow-3xl rounded-2xl z-[1000] overflow-hidden"
                  >
                    <div className="p-4 border-b border-border bg-white/5 flex items-center justify-between">
                       <span className="text-xs font-bold uppercase tracking-widest">Neural Configuration</span>
                       <button onClick={() => setShowSettings(false)}><X className="w-3 h-3 text-white/40 hover:text-white" /></button>
                    </div>
                    <div className="p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                             <Key className="w-3 h-3" />
                             Gemini API Key
                          </label>
                          <input 
                            type="password"
                            value={customKey}
                            onChange={(e) => {
                              setCustomKey(e.target.value);
                              localStorage.setItem('GEMINI_API_KEY', e.target.value);
                            }}
                            placeholder="sk-..."
                            autoComplete="off"
                            className="w-full bg-black/40 border border-border rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-accent-orange transition-all placeholder:text-white/10"
                          />
                          <p className="text-[9px] text-white/20 italic leading-tight">Key is stored locally in your browser to maintain neural persistence.</p>
                       </div>
                       <button 
                        onClick={() => {
                          localStorage.removeItem('GEMINI_API_KEY');
                          setCustomKey('');
                          window.location.reload();
                        }}
                        className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[10px] font-bold uppercase transition-all"
                       >
                        Purge Memory & Reset
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={fetchData}
              disabled={loading}
              className="p-3 bg-surface hover:bg-border border border-border rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-text-main ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Global Content Transition Layer */}
        <AnimatePresence mode="wait">
          {appMode === 'fitness' ? (
             <motion.div 
               key="fitness"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="min-h-[600px]"
             >
               <FitnessForge apiKey={customKey || process.env.GEMINI_API_KEY || ''} />
             </motion.div>
          ) : !data ? (
             <motion.div 
               key="loading"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="min-h-[400px] flex flex-col items-center justify-center text-center py-20"
             >
               {error ? (
                  <div className="max-w-md p-8 rounded-2xl bg-slate-900 border border-red-500/30 flex flex-col items-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Neural Link Failed</h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">{error}</p>
                    <button 
                      onClick={() => fetchData()}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Attempt Reconnection
                    </button>
                  </div>
               ) : (
                  <div className="flex flex-col items-center">
                     <Activity className="w-10 h-10 text-accent-orange animate-pulse mb-4" />
                     <div className="space-y-2 text-center">
                        <p className="text-slate-400 text-xs uppercase tracking-[0.2em] font-bold">Initializing Tactial Hub</p>
                        <p className="text-slate-600 text-[10px] animate-pulse">Syncing with Global AI Grounding...</p>
                     </div>
                  </div>
               )}
             </motion.div>
          ) : (
             <motion.div 
               key="tactical"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.02 }}
               className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start"
             >
               {/* Dashboard Column (Left) */}
               <div className="space-y-6 lg:sticky lg:top-8">

            {/* Live Crease Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between group hover:border-accent-orange/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0 border border-accent-orange/20">
                      <Zap className="w-6 h-6 text-accent-orange animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-accent-orange uppercase tracking-widest">Striker Now</span>
                         <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                      </div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter">{match_info.current_batter}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-dim uppercase font-bold">Batting Team</div>
                    <div className="text-sm font-bold text-text-main">{match_info.batting_team}</div>
                  </div>
               </div>

               <div className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between group hover:border-accent-red/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center shrink-0 border border-accent-red/20">
                      <Activity className="w-6 h-6 text-accent-red" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-accent-red uppercase tracking-widest">Bowler Now</span>
                         <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
                      </div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter">{match_info.current_bowler}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-dim uppercase font-bold">Bowling Team</div>
                    <div className="text-sm font-bold text-text-main">{match_info.bowling_team}</div>
                  </div>
               </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Scoreboard & Environment */}
              <div className="lg:col-span-4 space-y-6">
                <section className="bg-surface border border-border rounded-card p-6 border-l-4 border-l-accent-orange relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-[11px] uppercase tracking-widest text-text-dim font-bold">Current Match State</h2>
                    {groundingStatus === 'fetching' && (
                       <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-accent-orange font-bold uppercase animate-pulse">Syncing Score...</span>
                          <RefreshCw className="w-3 h-3 text-accent-orange animate-spin" />
                       </div>
                    )}
                  </div>
                  <div className="text-5xl font-mono font-bold tracking-tighter mb-1">{match_info.current_score} / {match_info.wickets_lost}</div>
                  <div className="text-sm text-text-dim font-medium mb-6 uppercase tracking-wider">{match_info.overs_completed} Ovs Completed</div>
                  
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <EnvLine label="Target Score" value={match_info.target} />
                    <EnvLine label="Required RR" value={analytics.rrr} color="text-accent-red" />
                    <EnvLine label="Current RR" value={(match_info.current_score / (match_info.overs_completed || 1)).toFixed(2)} />
                  </div>
                </section>

                <section className="bg-surface border border-border rounded-card p-6">
                  <h2 className="text-[11px] uppercase tracking-widest text-text-dim font-bold mb-4">Acoustic Insights (Gemini)</h2>
                  <AnimatePresence mode="wait">
                    {analyzingVideo ? (
                      <motion.div 
                        key="analyzing"
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center p-8 space-y-4"
                      >
                        <Sparkles className="w-6 h-6 text-accent-orange animate-spin" />
                        <span className="text-[9px] uppercase font-black text-text-dim animate-pulse">Scanning Archive...</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="analysis"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 bg-bg/50 border border-border rounded-xl"
                      >
                        <div className="flex items-center gap-2 mb-2">
                           <Sparkles className="w-3 h-3 text-accent-orange" />
                           <span className="text-[9px] font-bold uppercase text-accent-orange tracking-widest">Historical DNA</span>
                        </div>
                        <p className="text-xs text-text-main leading-relaxed italic">
                          {geminiAnalysis || "Synchronizing with historical pulse..."}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>

              {/* Pressure Meter (Center) */}
              <div className="lg:col-span-8">
                <section className="bg-surface border border-border rounded-card p-8 flex flex-col items-center justify-center relative overflow-hidden h-full min-h-[400px]">
                  <div className="absolute top-6 left-6 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-text-dim" />
                    <h2 className="text-[11px] uppercase tracking-widest text-text-dim font-bold">Neural Analytics Engine</h2>
                  </div>
                  
                  <div className="relative flex flex-col items-center justify-center scale-110">
                    <PressureGauge score={analytics.pressure_score} color="var(--color-accent-orange)" />
                    <div className="mt-4 uppercase font-extrabold tracking-[0.2em] text-lg text-text-main italic">Atmospheric Stress</div>
                  </div>
                  
                  <div className="mt-10 text-center max-w-lg">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={analytics.status}
                      className="text-accent-orange font-black uppercase text-lg italic tracking-widest"
                    >
                      {analytics.status}
                    </motion.div>
                    <p className="mt-4 text-text-dim text-sm italic leading-relaxed">
                      "Real-time sensor data indicates the crowd noise has reached a critical threshold, significantly impacting the batter's cognitive processing window."
                    </p>
                  </div>
                </section>
              </div>
            </div>

            {/* Duel Analysis: Batter vs Bowler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <DuelCard name={match_info.current_batter} role="Batter" reaction={analytics.reactions.batter} color="orange" />
               <DuelCard name={match_info.current_bowler} role="Bowler" reaction={analytics.reactions.bowler} color="red" />
            </div>

          </div>

          {/* Intelligence & Social Column (Right) */}
          <div className="space-y-6">
            
            {/* Over Prediction & Squad Hub Box */}
            <div className="grid grid-cols-1 gap-6">
               <section className="bg-surface border border-border rounded-card p-4 relative overflow-hidden group bg-gradient-to-br from-surface to-bg/40">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Zap className="w-12 h-12 text-accent-orange" />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-accent-orange" />
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-text-main">Neural Over Prediction</h2>
                  </div>
                  <div className="min-h-[60px] flex items-center bg-bg/20 p-4 rounded-xl border border-white/5">
                    {predicting ? (
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-4 h-4 text-accent-orange animate-spin" />
                        <span className="text-[10px] text-text-dim uppercase font-bold animate-pulse">Calculating probabilities...</span>
                      </div>
                    ) : (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-text-main leading-relaxed font-bold italic">
                        "{overPrediction || "Waiting for match momentum..."}"
                      </motion.p>
                    )}
                  </div>
               </section>

               <section className="bg-surface border border-border rounded-card p-6 shadow-xl">
                 <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                     <Users className="w-5 h-5 text-accent-red" />
                     <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Squad Intelligence Hub</h2>
                   </div>
                   <div className="px-3 py-1 bg-white/[0.03] rounded-full border border-white/5 text-[9px] font-black uppercase text-text-dim">
                     Neural Readiness: High
                   </div>
                 </div>

                 <div className="space-y-8 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
                    <div className="space-y-4">
                      <div className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-orange border-l-2 border-accent-orange pl-3">{match_info.batting_team} Players</div>
                      <div className="grid grid-cols-1 gap-2">
                        {(match_info.batting_squad || []).map(player => (
                          <PlayerIntelCard key={player} player={squadContext[player]} onAnalyze={() => { buildPlayerContext(player); }} />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-red border-l-2 border-accent-red pl-3">{match_info.bowling_team} Squad</div>
                      <div className="grid grid-cols-1 gap-2">
                        {(match_info.bowling_squad || []).map(player => (
                          <PlayerIntelCard key={player} player={squadContext[player]} onAnalyze={() => { buildPlayerContext(player); }} />
                        ))}
                      </div>
                    </div>
                 </div>
               </section>
            </div>

            {/* Chat Intelligence Section */}
            <section className="bg-surface border border-border rounded-card flex flex-col h-[550px] shadow-2xl relative overflow-hidden">
               <div className="p-5 border-b border-border bg-white/[0.02] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-accent-orange" />
                    <h2 className="text-sm font-bold uppercase tracking-widest">Global Pulse Chat</h2>
                  </div>
                  <div className="flex items-center gap-1.5 bg-accent-green/10 px-3 py-1 rounded-full border border-accent-green/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                    <span className="text-[8px] text-accent-green font-bold uppercase tracking-widest">Live State</span>
                  </div>
               </div>
               
               <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-border bg-bg/10">
                 {!hasJoined ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                       <div className="w-16 h-16 rounded-[1.5rem] bg-accent-orange/10 flex items-center justify-center border border-accent-orange/20">
                         <User className="w-8 h-8 text-accent-orange" />
                       </div>
                       <div className="space-y-2">
                         <h3 className="text-sm font-bold uppercase tracking-widest">Identify Yourself</h3>
                         <p className="text-[10px] text-text-dim uppercase font-semibold">Join to interact with fans and Gemini AI</p>
                       </div>
                       <form onSubmit={handleJoinChat} className="w-full space-y-3">
                         <input 
                           type="text" 
                           value={userName}
                           onChange={(e) => setUserName(e.target.value)}
                           placeholder="Enter Handle..."
                           className="w-full bg-bg border border-border rounded-xl py-4 px-4 text-center text-sm focus:outline-none focus:border-accent-orange transition-all"
                         />
                         <button 
                           disabled={isSigningIn}
                           className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                             isSigningIn 
                               ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                               : 'bg-accent-orange text-bg hover:bg-white active:scale-95'
                           }`}
                           type="submit"
                         >
                           {isSigningIn ? 'Syncing...' : 'Join Link'}
                         </button>
                       </form>
                    </div>
                 ) : (
                   <AnimatePresence initial={false}>
                      {messages.map((msg) => (
                        <motion.div 
                          key={msg.id}
                          initial={{ opacity: 0, x: msg.user === 'Gemini AI' ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex flex-col gap-1 ${msg.user === userName ? 'items-end' : 'items-start'}`}
                        >
                          <div className={`flex items-center gap-2 ${msg.user === userName ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-tighter ${msg.user === 'Gemini AI' ? 'text-accent-orange animate-pulse' : 'text-text-dim'}`}>
                               {msg.user === 'Gemini AI' ? 'Neural Analyst' : `@${msg.user}`}
                            </span>
                            <span className="text-[8px] text-text-dim/50 font-mono">
                               {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`max-w-[85%] p-3 rounded-2xl border text-sm leading-relaxed ${
                            msg.user === userName ? 'bg-accent-orange/10 border-accent-orange/30 rounded-tr-none text-right' : 
                            msg.user === 'Gemini AI' ? 'bg-[#1a1a2e] border-accent-orange/40 rounded-tl-none font-medium italic' : 
                            'bg-surface border-border rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                        </motion.div>
                      ))}
                      {aiResponding && (
                        <div className="flex items-center gap-3 text-accent-orange italic animate-pulse">
                           <RefreshCw className="w-3 h-3 animate-spin" />
                           <span className="text-[9px] font-black uppercase tracking-widest">Gemini is typing...</span>
                        </div>
                      )}
                   </AnimatePresence>
                 )}
               </div>

               {hasJoined && (
                 <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-bg/20 shrink-0">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Neural signal..."
                        className="w-full bg-bg border border-border rounded-xl py-4 px-4 pr-12 text-sm focus:outline-none focus:border-accent-orange transition-all placeholder:text-text-dim/40"
                      />
                      <button type="submit" className="absolute right-2 top-2 p-2 bg-accent-orange text-bg rounded-lg hover:bg-white transition-all active:scale-90">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                 </form>
               )}
            </section>
          </div>

        </motion.div>
      )}
    </AnimatePresence>

    {/* Global Footer */}
        <footer className="pt-4 flex items-center justify-center gap-4 text-text-dim text-[10px] font-bold uppercase tracking-[0.3em]">
          <Activity className="w-3 h-3 text-accent-orange" />
          Neural Sync: Enabled
          <div className="w-1.5 h-1.5 rounded-full bg-border" />
          Acoustic Fingerprint: Authenticated
        </footer>
      </div>
    </div>
  );
}

interface PlayerIntelCardProps {
  player: PlayerContext | undefined;
  onAnalyze: () => void;
}

const PlayerIntelCard: React.FC<PlayerIntelCardProps> = ({ player, onAnalyze }) => {
  if (!player) return null;

  return (
    <div className="bg-bg/30 border border-border p-3 rounded-xl group hover:border-accent-orange/30 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${player.status === 'ready' ? 'bg-accent-green/10 text-accent-green' : 'bg-white/5 text-text-dim'}`}>
            <User className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-tight text-text-main">{player.name}</h4>
            <div className="text-[9px] text-text-dim font-bold uppercase">{player.role}</div>
          </div>
        </div>
        {player.status === 'pending' && (
          <button 
            onClick={onAnalyze}
            className="p-1.5 hover:bg-accent-orange/20 rounded-lg text-accent-orange/40 hover:text-accent-orange transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}
        {player.status === 'loading' && (
           <RefreshCw className="w-3.5 h-3.5 text-accent-orange animate-spin" />
        )}
        {player.status === 'ready' && (
           <div className="flex items-center gap-2">
             <a 
              href={player.youtube_video} 
              target="_blank" 
              rel="noreferrer"
              className="p-1.5 hover:bg-accent-red/20 rounded-lg text-accent-red/40 hover:text-accent-red transition-all"
             >
                <Youtube className="w-3.5 h-3.5" />
             </a>
             <div className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_var(--color-accent-green)]" />
           </div>
        )}
      </div>
      
      {player.status === 'ready' && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-white/5"
        >
          <p className="text-[10px] text-text-dim leading-relaxed italic">
            "{player.historical_context}"
          </p>
        </motion.div>
      )}
    </div>
  );
}

function DuelCard({ name, role, reaction, color }: { name: string, role: string, reaction: string, color: 'orange' | 'red' }) {
  return (
    <section className="bg-surface border border-border rounded-card p-1">
      <div className="bg-bg/40 p-6 rounded-[calc(var(--radius-card)-4px)]">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color === 'orange' ? 'bg-accent-orange/10 text-accent-orange' : 'bg-accent-red/10 text-accent-red'}`}>
            {color === 'orange' ? <Zap className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-[10px] text-text-dim uppercase font-bold tracking-widest">{role} Analysis</div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter">{name}</h3>
          </div>
        </div>
        <div className={`p-5 rounded-xl border border-white/5 relative bg-bg/20`}>
          <div className={`text-[10px] uppercase font-bold mb-2 ${color === 'orange' ? 'text-accent-orange' : 'text-accent-red'}`}>Live Psychological Profiling</div>
          <p className="text-sm text-text-main leading-relaxed italic">{reaction}</p>
          <div className="absolute top-4 right-4 animate-pulse">
            <ShieldAlert className="w-3 h-3 text-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}

function EnvLine({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-text-dim text-xs font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-bold font-mono ${color || 'text-text-main'}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-5 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
        <div className={color}>{icon}</div>
      </div>
      <div className="text-2xl font-mono font-bold tracking-tighter">{value}</div>
    </div>
  );
}
