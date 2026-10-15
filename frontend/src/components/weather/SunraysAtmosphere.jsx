import React from 'react';

export default function SunraysAtmosphere({ isFullScreen = false }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-1000 ease-in-out">
      {/* Golden Warm Ambient Sky Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-950/20 via-yellow-900/10 to-amber-500/15 mix-blend-screen" />

      {/* Primary Radiant Sun Core */}
      <div className="absolute -top-12 -right-12 sm:top-2 sm:right-8 w-72 h-72 rounded-full bg-gradient-to-br from-yellow-100 via-amber-300 to-amber-500 blur-2xl opacity-60 animate-sun-corona" />

      {/* Giant Shimmering Sun Halo */}
      <div className="absolute -top-32 -right-32 sm:-top-20 sm:-right-10 w-[500px] h-[500px] rounded-full bg-amber-400/20 blur-3xl animate-sunray-pulse" />

      {/* Rotating Volumetric Sunrays Beam 1 */}
      <div 
        className="absolute top-0 right-0 w-[800px] h-[800px] -translate-y-1/3 translate-x-1/3 origin-center animate-sunray-rotate opacity-40 mix-blend-screen"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg 20deg, rgba(253, 224, 71, 0.25) 25deg 35deg, transparent 40deg 60deg, rgba(251, 191, 36, 0.28) 65deg 78deg, transparent 85deg 110deg, rgba(252, 211, 77, 0.22) 115deg 128deg, transparent 135deg 180deg, rgba(251, 191, 36, 0.25) 185deg 198deg, transparent 205deg 240deg, rgba(254, 240, 138, 0.3) 245deg 258deg, transparent 265deg 360deg)'
        }}
      />

      {/* Counter Rotating Secondary Sunrays Beam */}
      <div 
        className="absolute top-0 right-0 w-[950px] h-[950px] -translate-y-1/3 translate-x-1/3 origin-center animate-sunray-rotate-reverse opacity-30 mix-blend-screen"
        style={{
          background: 'conic-gradient(from 45deg, transparent 0deg 30deg, rgba(254, 243, 199, 0.2) 35deg 48deg, transparent 55deg 90deg, rgba(251, 191, 36, 0.18) 95deg 108deg, transparent 115deg 170deg, rgba(253, 230, 138, 0.22) 175deg 188deg, transparent 195deg 270deg, rgba(251, 191, 36, 0.18) 275deg 290deg, transparent 300deg 360deg)'
        }}
      />

      {/* Lens Flare Ring 1 */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full border border-amber-300/20 bg-amber-400/5 blur-sm" />

      {/* Lens Flare Ring 2 */}
      <div className="absolute top-1/2 right-1/2 w-48 h-48 rounded-full border border-yellow-300/15 bg-gradient-to-r from-yellow-300/5 to-cyan-300/5 blur-md" />

      {/* Warm Golden Hour Light Wash at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
    </div>
  );
}
