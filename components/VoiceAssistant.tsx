
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Blob, LiveServerMessage } from '@google/genai';
import { User, ScheduleEvent } from '../types.ts';
import { DAYS, formatTime } from '../constants.tsx';

// Helper functions for Manual Base64 as per guidelines
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface VoiceAssistantProps {
  users: User[];
  events: ScheduleEvent[];
  onClose: () => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ users, events, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Prepare schedule context for the AI
  const scheduleContext = events
    .filter(e => users.find(u => u.id === e.userId)?.active)
    .map(e => ({
      who: users.find(u => u.id === e.userId)?.name,
      day: DAYS[e.day],
      at: formatTime(e.startTime),
      title: e.title
    }));

  const systemInstruction = `
    You are the SyncCircle Voice Assistant. You help friend groups coordinate their schedules.
    The current active users are: ${users.filter(u => u.active).map(u => u.name).join(', ')}.
    Current busy events: ${JSON.stringify(scheduleContext)}.
    
    Guidelines:
    1. Be concise, friendly, and helpful.
    2. Answer questions about who is free or busy.
    3. Suggest meeting times based on gaps in the schedule.
    4. Speak naturally, as if you are a member of the friend group.
  `;

  useEffect(() => {
    const initVoice = async () => {
      // Ensure API key is present
      if (!process.env.API_KEY) {
        setError("API Key is missing.");
        setStatus('error');
        return;
      }

      try {
        // Create a new GoogleGenAI instance using named parameter and process.env.API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setStatus('listening');
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) {
                  int16[i] = inputData[i] * 32768;
                }
                
                const pcmBlob: Blob = {
                  data: encode(new Uint8Array(int16.buffer)),
                  mimeType: 'audio/pcm;rate=16000',
                };

                // Trigger sendRealtimeInput only after sessionPromise resolves
                sessionPromise.then(s => {
                  s.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio) {
                setStatus('speaking');
                
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  outputCtx,
                  24000,
                  1
                );

                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                
                // Gapless playback tracking using nextStartTime
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setStatus('listening');
                };
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onerror: (e) => {
              console.error(e);
              setError("Assistant connection failed.");
              setStatus('error');
            },
            onclose: () => onClose()
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
            }
          }
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error(err);
        setError("Microphone access denied or connection failed.");
        setStatus('error');
      }
    };

    initVoice();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      sessionRef.current?.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="max-w-md w-full text-center space-y-12">
        <div className="relative">
          <div className={`w-40 h-40 mx-auto rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center transition-all duration-500 ${status === 'speaking' ? 'scale-110 shadow-[0_0_80px_rgba(99,102,241,0.4)]' : 'scale-100'}`}>
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-2xl transition-all ${status === 'listening' ? 'animate-pulse' : ''}`}>
               {status === 'connecting' ? (
                 <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
               )}
            </div>
            
            {status === 'listening' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-indigo-500/20 animate-ping" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
            {status === 'connecting' && 'Opening Channel...'}
            {status === 'listening' && 'Listening...'}
            {status === 'speaking' && 'Speaking...'}
            {status === 'error' && 'Something went wrong'}
          </h2>
          <p className="text-indigo-200/60 font-medium text-sm px-8">
            {status === 'listening' && "Ask me anything about the group's schedule. I'm listening to your voice live."}
            {status === 'error' && error}
          </p>
        </div>

        <button 
          onClick={onClose}
          className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
        >
          Close Assistant
        </button>
      </div>
    </div>
  );
};

export default VoiceAssistant;
