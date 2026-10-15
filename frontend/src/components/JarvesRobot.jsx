import React, { useState, useEffect, useRef } from 'react';

export default function JarvesRobot({ state = 'idle', cursorPosition = { x: 0.5, y: 0.5 }, isActive = true }) {
  const [headTransform, setHeadTransform] = useState({ rotX: 0, rotY: 0, eyeX: 0, eyeY: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const containerRef = useRef(null);
  const targetTransformRef = useRef({ rotX: 0, rotY: 0, eyeX: 0, eyeY: 0 });
  const currentTransformRef = useRef({ rotX: 0, rotY: 0, eyeX: 0, eyeY: 0 });

  // Blinking timer effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 4500 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Smooth Cursor Tracking (Lerp)
  useEffect(() => {
    // Check if mobile device
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      targetTransformRef.current = { rotX: 0, rotY: 0, eyeX: 0, eyeY: 0 };
      return;
    }

    if (cursorPosition) {
      // Calculate normalized delta from center (x: -1 to 1, y: -1 to 1)
      const deltaX = (cursorPosition.x - 0.5) * 2;
      const deltaY = (cursorPosition.y - 0.5) * 2;

      // Limit max head tilt & eye offset for natural realistic movement
      targetTransformRef.current = {
        rotY: deltaX * 18, // max 18 deg horizontal turn
        rotX: -deltaY * 12, // max 12 deg vertical tilt
        eyeX: deltaX * 9,   // max 9px eye tracking
        eyeY: deltaY * 6    // max 6px eye tracking
      };
    }
  }, [cursorPosition]);

  // RequestAnimationFrame Lerp Animation Loop
  useEffect(() => {
    let animId;
    const lerp = (start, end, factor) => start + (end - start) * factor;

    const animate = () => {
      const target = targetTransformRef.current;
      const current = currentTransformRef.current;

      current.rotX = lerp(current.rotX, target.rotX, 0.08);
      current.rotY = lerp(current.rotY, target.rotY, 0.08);
      current.eyeX = lerp(current.eyeX, target.eyeX, 0.08);
      current.eyeY = lerp(current.eyeY, target.eyeY, 0.08);

      setHeadTransform({
        rotX: current.rotX,
        rotY: current.rotY,
        eyeX: current.eyeX,
        eyeY: current.eyeY
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const normalizedState = (state || 'idle').toLowerCase();

  const getStateDetails = () => {
    switch (normalizedState) {
      case 'listening':
        return {
          label: 'Listening...',
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          eyeColor: '#06B6D4',
          coreColor: '#06B6D4',
          glowShadow: 'drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]'
        };
      case 'thinking':
        return {
          label: 'ASTRA is thinking...',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          eyeColor: '#7C3AED',
          coreColor: '#7C3AED',
          glowShadow: 'drop-shadow-[0_0_25px_rgba(124,58,237,0.7)]'
        };
      case 'speaking':
        return {
          label: 'ASTRA is responding...',
          badgeBg: 'bg-blue-500/20 text-cyan-300 border-blue-500/40',
          eyeColor: '#2563EB',
          coreColor: '#06B6D4',
          glowShadow: 'drop-shadow-[0_0_25px_rgba(37,99,235,0.7)]'
        };
      case 'idle':
      default:
        return {
          label: "Hi, I'm ASTRA",
          badgeBg: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
          eyeColor: '#06B6D4',
          coreColor: '#7C3AED',
          glowShadow: 'drop-shadow-[0_0_15px_rgba(124,58,237,0.4)]'
        };
    }
  };

  const details = getStateDetails();

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center relative select-none">
      {/* Listening Sound Wave Ripple Auras */}
      {normalizedState === 'listening' && (
        <div className="absolute w-80 h-80 rounded-full border border-cyan-500/30 animate-ping pointer-events-none" />
      )}
      {normalizedState === 'listening' && (
        <div className="absolute w-96 h-96 rounded-full border border-purple-500/20 animate-pulse pointer-events-none" />
      )}

      {/* Thinking Halo Ring */}
      {normalizedState === 'thinking' && (
        <div className="absolute w-72 h-72 rounded-full border-2 border-dashed border-cyan-400/50 animate-spin-slow pointer-events-none" />
      )}

      {/* Floating Robot Body Wrap */}
      <div 
        className={`relative z-10 transition-transform duration-500 animate-robot-float ${details.glowShadow}`}
        style={{
          transform: `perspective(1000px) rotateY(${headTransform.rotY}deg) rotateX(${headTransform.rotX}deg)`
        }}
      >
        <svg
          width="280"
          height="340"
          viewBox="0 0 280 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-56 h-72 sm:w-64 sm:h-80 drop-shadow-2xl"
        >
          <defs>
            {/* Ceramic Metallic Gradients */}
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            <linearGradient id="faceVisor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B132B" />
              <stop offset="50%" stopColor="#1C2541" />
              <stop offset="100%" stopColor="#050816" />
            </linearGradient>

            <linearGradient id="accentPurpleBlue" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>

            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={details.eyeColor} stopOpacity="1" />
              <stop offset="70%" stopColor={details.eyeColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Shoulders & Upper Body Shell */}
          <path
            d="M 60 250 C 60 215, 90 200, 140 200 C 190 200, 220 215, 220 250 L 235 310 Q 140 330 45 310 Z"
            fill="url(#bodyGradient)"
            stroke="#94A3B8"
            strokeWidth="1.5"
          />

          {/* Chest Plate Metallic Trim */}
          <path
            d="M 90 230 Q 140 245 190 230 L 180 280 Q 140 295 100 280 Z"
            fill="#0F172A"
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Core AI Power Arc Reactor */}
          <circle cx="140" cy="255" r="16" fill="#0B132B" stroke="url(#accentPurpleBlue)" strokeWidth="2" />
          <circle
            cx="140"
            cy="255"
            r="10"
            fill={details.coreColor}
            className={normalizedState === 'speaking' ? 'animate-pulse' : ''}
          />
          <circle cx="140" cy="255" r="5" fill="#FFFFFF" opacity="0.9" />

          {/* Neck Support */}
          <rect x="124" y="170" width="32" height="35" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <line x1="128" y1="180" x2="152" y2="180" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

          {/* HEAD ASSEMBLY GROUP */}
          <g transform={`translate(${headTransform.eyeX * 0.4}, ${headTransform.eyeY * 0.4})`}>
            {/* Sleek Outer Ceramic Helmet */}
            <path
              d="M 65 100 C 65 40, 100 20, 140 20 C 180 20, 215 40, 215 100 C 215 150, 185 180, 140 180 C 95 180, 65 150, 65 100 Z"
              fill="url(#bodyGradient)"
              stroke="#CBD5E1"
              strokeWidth="2"
            />

            {/* Side Ear Accent Light Pods */}
            <rect x="53" y="85" width="14" height="30" rx="4" fill="#0F172A" stroke="#7C3AED" strokeWidth="1.5" />
            <rect x="213" y="85" width="14" height="30" rx="4" fill="#0F172A" stroke="#06B6D4" strokeWidth="1.5" />
            <circle cx="60" cy="100" r="3" fill="#7C3AED" className="animate-pulse" />
            <circle cx="220" cy="100" r="3" fill="#06B6D4" className="animate-pulse" />

            {/* Dark Curved Digital Face Visor */}
            <path
              d="M 78 92 C 78 52, 105 38, 140 38 C 175 38, 202 52, 202 92 C 202 135, 175 162, 140 162 C 105 162, 78 135, 78 92 Z"
              fill="url(#faceVisor)"
              stroke="#334155"
              strokeWidth="1.5"
            />

            {/* Visor Specular Glass Reflection Streak */}
            <path
              d="M 90 55 Q 140 45 180 60"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.15"
            />

            {/* DIGITAL EXPRESSIVE EYES GROUP */}
            <g transform={`translate(${headTransform.eyeX}, ${headTransform.eyeY})`}>
              {isBlinking ? (
                /* Blinking state */
                <>
                  <line x1="102" y1="95" x2="124" y2="95" stroke={details.eyeColor} strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="156" y1="95" x2="178" y2="95" stroke={details.eyeColor} strokeWidth="3.5" strokeLinecap="round" />
                </>
              ) : (
                /* Active Digital Eyes */
                <>
                  {/* Left Digital Eye */}
                  <ellipse cx="113" cy="95" rx="13" ry="11" fill="url(#eyeGlow)" />
                  <rect x="103" y="87" width="20" height="16" rx="8" fill={details.eyeColor} opacity="0.95" />
                  <circle cx="111" cy="92" r="4" fill="#FFFFFF" />
                  <circle cx="117" cy="96" r="1.5" fill="#FFFFFF" opacity="0.8" />

                  {/* Right Digital Eye */}
                  <ellipse cx="167" cy="95" rx="13" ry="11" fill="url(#eyeGlow)" />
                  <rect x="157" y="87" width="20" height="16" rx="8" fill={details.eyeColor} opacity="0.95" />
                  <circle cx="165" cy="92" r="4" fill="#FFFFFF" />
                  <circle cx="171" cy="96" r="1.5" fill="#FFFFFF" opacity="0.8" />
                </>
              )}

              {/* THINKING STATE: Rotating orbit ring in visor */}
              {normalizedState === 'thinking' && (
                <g className="animate-spin-slow" style={{ transformOrigin: '140px 95px' }}>
                  <circle cx="140" cy="95" r="38" stroke="#06B6D4" strokeWidth="1.5" strokeDasharray="6 8" fill="none" />
                </g>
              )}

              {/* SPEAKING STATE: Subtle LED Audio Mouth Spectrum */}
              {normalizedState === 'speaking' && (
                <g transform="translate(122, 130)" className="flex items-center justify-center gap-1">
                  <rect x="0" y="0" width="4" height="6" rx="2" fill="#06B6D4" className="animate-bounce" />
                  <rect x="8" y="-3" width="4" height="12" rx="2" fill="#7C3AED" className="animate-bounce delay-75" />
                  <rect x="16" y="-6" width="4" height="16" rx="2" fill="#2563EB" className="animate-bounce delay-150" />
                  <rect x="24" y="-3" width="4" height="12" rx="2" fill="#06B6D4" className="animate-bounce delay-100" />
                  <rect x="32" y="0" width="4" height="6" rx="2" fill="#7C3AED" className="animate-bounce" />
                </g>
              )}

              {/* IDLE / LISTENING Minimal Mouth Line */}
              {normalizedState !== 'speaking' && (
                <path
                  d="M 128 132 Q 140 137 152 132"
                  stroke={details.eyeColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.75"
                />
              )}
            </g>
          </g>
        </svg>
      </div>

      {/* Ground Floating Reflection Oval */}
      <div className="w-48 h-4 rounded-full bg-cyan-500/20 blur-md mt-1 animate-pulse" />

      {/* State Badge Pill */}
      <div className={`mt-4 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur-md ${details.badgeBg}`}>
        {details.label}
      </div>
    </div>
  );
}
