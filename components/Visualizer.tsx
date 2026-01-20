import React from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  // Create a few bars for a simple visualizer
  const bars = Array.from({ length: 5 });

  return (
    <div className="flex items-center justify-center gap-1.5 h-12 w-full">
      {bars.map((_, i) => {
        // Calculate a dynamic height based on volume and index to create a wave effect
        // Base height is small, volume adds to it.
        // We use a sine wave offset for idle animation if active but quiet.
        
        const isCenter = i === 2;
        const isInner = i === 1 || i === 3;
        
        let heightScale = 0.2; // Default idle
        
        if (isActive) {
           // If talking (volume high), react strongly
           // If just connected but quiet, pulsate gently
           const dynamicBoost = volume * 2.5; // Amplify volume input
           
           if (isCenter) heightScale = 0.3 + dynamicBoost;
           else if (isInner) heightScale = 0.25 + (dynamicBoost * 0.7);
           else heightScale = 0.2 + (dynamicBoost * 0.4);
        }

        // Clamp height
        heightScale = Math.min(1.0, Math.max(0.1, heightScale));

        return (
          <div
            key={i}
            className={`w-3 rounded-full transition-all duration-75 ${
              isActive ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-slate-700'
            }`}
            style={{
              height: `${heightScale * 100}%`,
              opacity: isActive ? 1 : 0.5
            }}
          />
        );
      })}
    </div>
  );
};