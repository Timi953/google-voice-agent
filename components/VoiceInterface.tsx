import React from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Visualizer } from './Visualizer';

export const VoiceInterface: React.FC = () => {
  const { isConnected, isConnecting, error, connect, disconnect, volume } = useGeminiLive();

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 text-center border-b border-slate-800/50">
          <h1 className="text-xl font-semibold text-white tracking-tight">Gemini Live</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time Native Audio</p>
        </div>

        {/* Status Indicator Area */}
        <div className="h-64 flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-900 to-slate-900/50">
           {/* Connection Status Text */}
           <div className={`absolute top-6 px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors duration-300 ${
             isConnected 
               ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
               : isConnecting 
                 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                 : 'bg-slate-800 text-slate-500 border border-slate-700'
           }`}>
             {isConnected ? 'LIVE SESSION' : isConnecting ? 'CONNECTING...' : 'DISCONNECTED'}
           </div>

           {/* Visualizer */}
           <div className="mt-8">
             <Visualizer isActive={isConnected} volume={volume} />
           </div>

           {/* Dynamic Status Message */}
           <p className="mt-8 text-slate-400 text-sm font-light">
             {error ? (
               <span className="text-red-400">{error}</span>
             ) : isConnected ? (
               "Listening..."
             ) : (
               "Tap microphone to start"
             )}
           </p>
        </div>

        {/* Controls */}
        <div className="p-8 pb-10 flex justify-center bg-slate-900">
          <button
            onClick={handleToggle}
            disabled={isConnecting}
            className={`
              relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900
              ${isConnected 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 focus:ring-red-500/50' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 focus:ring-indigo-500/50'}
              ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            aria-label={isConnected ? "End Session" : "Start Session"}
          >
            {/* Ripple effect rings when connected */}
            {isConnected && (
              <>
                <span className="absolute w-full h-full rounded-full border border-red-500/30 animate-[ping_2s_linear_infinite]" />
                <span className="absolute w-full h-full rounded-full border border-red-500/20 animate-[ping_2s_linear_infinite_1s]" />
              </>
            )}

            {/* Icon */}
            {isConnected ? (
              // Stop/Square Icon
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-8 h-8">
                <path rounded-md="true" d="M6 6h12v12H6z" />
              </svg>
            ) : (
              // Mic Icon
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-900/50 text-center">
             <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
               Powered by Gemini 2.5
             </p>
        </div>

      </div>
    </div>
  );
};