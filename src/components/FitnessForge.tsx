import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  Calendar, 
  Ruler, 
  Weight, 
  User, 
  Camera, 
  Upload, 
  Zap, 
  ArrowRight,
  Target,
  Sparkles,
  Activity,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface UserProfile {
  name: string;
  dob: string;
  height: string;
  weight: string;
  activityLevel: 'sedentary' | 'moderate' | 'active' | 'athlete';
  idealPlayer: string;
  photo?: string; // base64
}

const IDEAL_PLAYERS = [
  { name: "Virat Kohli", trait: "Engine & Agility", profile: "Lean, high stamina, explosive power" },
  { name: "Ben Stokes", trait: "Raw Power & Durability", profile: "Muscular, high intensity, long-session stamina" },
  { name: "Rashid Khan", trait: "Core & Flexibility", profile: "Elasticity, core stability, wrist strength" },
  { name: "Pat Cummins", trait: "Biomechanical Precision", profile: "Balanced, strong lower body, rhythm" },
  { name: "MS Dhoni", trait: "Neural Reflex & Strength", profile: "Explosive reflexes, lower body stability" }
];

export const FitnessForge: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    dob: '',
    height: '',
    weight: '',
    activityLevel: 'moderate',
    idealPlayer: IDEAL_PLAYERS[0].name
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreview(base64);
        setProfile(prev => ({ ...prev, photo: base64.split(',')[1] }));
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePlan = async () => {
    if (!profile.name || !profile.height || !profile.weight) return;
    setAnalyzing(true);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      
      const prompt = `Act as an elite sports scientist and biomechanics expert. I want to transform my body to match the fitness profile of ${profile.idealPlayer}.
      
      My Profile:
      - Name: ${profile.name}
      - DOB: ${profile.dob}
      - Height: ${profile.height} cm
      - Weight: ${profile.weight} kg
      - Activity Level: ${profile.activityLevel}
      
      Compare my current metrics to the ideal physical profile of ${profile.idealPlayer}.
      Provide:
      1. A custom 12-week transformation plan (Nutrition + Training focus).
      2. Specific biomechanical areas to improve (e.g., core stability for Rashid Khan style, or explosive agility for Kohli).
      3. A "Forge Score" (0-100) on how close my current body type is to the goal.
      4. Detailed advice on injury prevention for a cricket-focused lifestyle.
      
      Keep the tone encouraging, technical, and immersive. Format as markdown with clear headers.`;

      const contents: any[] = [{ text: prompt }];
      if (profile.photo) {
        contents.push({
          inlineData: {
            data: profile.photo,
            mimeType: "image/jpeg"
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: contents }
      });
      
      setResult(response.text || "No analysis available.");
    } catch (error) {
      console.error("Forge error:", error);
      setResult("## Error initializing Neural Forge\nPlease check your API key and network connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-[#e0e0e0] font-sans selection:bg-accent-orange/30">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-white/5">
                  <User className="w-4 h-4 text-accent-orange" />
                  <span className="text-xs font-bold uppercase tracking-wider">Candidate Profile</span>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent-orange transition-all placeholder:text-white/10"
                      value={profile.name}
                      onChange={e => setProfile({...profile, name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">DOB</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input 
                          type="date" 
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-orange transition-all text-white/60"
                          value={profile.dob}
                          onChange={e => setProfile({...profile, dob: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Gender</label>
                      <select className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent-orange transition-all text-white/60 appearance-none">
                        <option>Male</option>
                        <option>Female</option>
                        <option>Non-binary</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Height (cm)</label>
                      <div className="relative">
                        <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input 
                          type="number" 
                          placeholder="180"
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-orange transition-all placeholder:text-white/10"
                          value={profile.height}
                          onChange={e => setProfile({...profile, height: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Weight (kg)</label>
                      <div className="relative">
                        <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input 
                          type="number" 
                          placeholder="75"
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-orange transition-all placeholder:text-white/10"
                          value={profile.weight}
                          onChange={e => setProfile({...profile, weight: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4 text-accent-orange" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Biometric Scan</span>
                </div>
                
                <div 
                  className="group relative border-2 border-dashed border-white/10 rounded-2xl h-48 flex flex-col items-center justify-center transition-all hover:border-accent-orange/40 bg-black/20"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {preview ? (
                    <img src={preview} alt="Scan preview" className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-60 grayscale group-hover:grayscale-0 transition-all" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-white/20 group-hover:text-accent-orange transition-all">
                      <Upload className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Upload Front View</span>
                    </div>
                  )}
                </div>
                <input id="photo-upload" type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </section>
            </div>

            <div className="space-y-6">
              <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-white/5">
                  <Target className="w-4 h-4 text-accent-orange" />
                  <span className="text-xs font-bold uppercase tracking-wider">Evolutionary Target</span>
                </div>
                
                <div className="p-4 space-y-3">
                  {IDEAL_PLAYERS.map((player) => (
                    <button
                      key={player.name}
                      onClick={() => setProfile({...profile, idealPlayer: player.name})}
                      className={`group w-full p-4 rounded-xl border text-left transition-all ${
                        profile.idealPlayer === player.name 
                          ? 'bg-accent-orange/10 border-accent-orange/40' 
                          : 'bg-black/20 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-black uppercase tracking-tight ${profile.idealPlayer === player.name ? 'text-accent-orange' : 'text-white'}`}>
                          {player.name}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{player.trait}</p>
                    </button>
                  ))}
                </div>
              </section>

              <button
                disabled={analyzing}
                onClick={generatePlan}
                className={`w-full py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-3 overflow-hidden group relative ${
                  analyzing 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-accent-orange text-black hover:scale-[1.02] shadow-[0_20px_40px_rgba(249,115,22,0.2)]'
                }`}
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 fill-current" />
                    Execute Forge
                  </>
                )}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {result && (
              <motion.section
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-3xl"
              >
                <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                   <div className="flex items-center gap-3 text-accent-orange font-black uppercase italic tracking-tighter">
                      <ShieldCheck className="w-5 h-5" />
                      Transformation Protocol
                   </div>
                </div>
                <div className="p-8 lg:p-12 whitespace-pre-wrap font-sans leading-relaxed text-sm text-white/70">
                  {result}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
