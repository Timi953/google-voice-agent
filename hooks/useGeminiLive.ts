import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, b64Decode, decodeAudioToBuffer } from '../utils/audio-utils';

export interface UseGeminiLiveReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  volume: number; // For visualization 0-1
}

export const useGeminiLive = (): UseGeminiLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  // Audio Contexts and Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // State for playback management
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null); // To hold the active session object

  // Animation frame for volume visualization
  const rafIdRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    // Stop all audio sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();

    // Close microphone processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    
    // Close audio contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Close session if possible (wrapper cleanup)
    if (sessionRef.current) {
        // session.close() is available on the session object in the latest SDK
        try {
            sessionRef.current.close();
        } catch(e) {
            console.warn("Error closing session", e);
        }
        sessionRef.current = null;
    }

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    setIsConnected(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY is missing in environment variables.");
      }

      // Initialize Audio Contexts
      // Input: 16kHz for speech recognition optimization
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Output: 24kHz for high quality voice output
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Setup Output Pipeline
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);
      
      // Setup Analyser for visualization (connected to output for speaking, can also attach to input)
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      outputNodeRef.current.connect(analyserRef.current);

      // Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = 'gemini-2.5-flash-native-audio-preview-12-2025';

      // Connect to Live API
      const sessionPromise = ai.live.connect({
        model,
        callbacks: {
          onopen: async () => {
            console.log('Gemini Live Session Opened');
            setIsConnected(true);
            setIsConnecting(false);

            // Start Microphone Stream
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              if (!inputAudioContextRef.current) return;

              inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
              
              // Use ScriptProcessor for raw PCM access (bufferSize, inputChannels, outputChannels)
              // Note: AudioWorklet is preferred in modern web, but ScriptProcessor is used in the official examples for simplicity with `ai.live`.
              processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              
              processorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                
                // Send to Gemini
                sessionPromise.then(session => {
                   sessionRef.current = session;
                   session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              inputSourceRef.current.connect(processorRef.current);
              processorRef.current.connect(inputAudioContextRef.current.destination);

            } catch (err) {
              console.error("Microphone error:", err);
              setError("Failed to access microphone.");
              cleanup();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              
              // Sync playback time
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = decodeAudioToBuffer(
                b64Decode(base64Audio),
                ctx
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNodeRef.current);
              
              source.addEventListener('ended', () => {
                activeSourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              activeSourcesRef.current.add(source);
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              console.log('Interrupted by user');
              activeSourcesRef.current.forEach(src => {
                try { src.stop(); } catch(e) {}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Gemini Live Session Closed');
            cleanup();
          },
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
            setError("Connection error occurred.");
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: 'You are a helpful, witty, and concise voice assistant.',
        }
      });
      
      // Start visualization loop
      const updateVolume = () => {
        if (analyserRef.current && isConnected) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setVolume(average / 255); // Normalize to 0-1
        }
        rafIdRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initialize.");
      setIsConnecting(false);
      cleanup();
    }
  }, [isConnected, isConnecting, cleanup]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect: cleanup,
    volume
  };
};