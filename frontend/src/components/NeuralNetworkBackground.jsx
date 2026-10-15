import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import './NeuralNetworkBackground.css';

/**
 * Astra AI — Neural Network Animated Background
 * High-performance, seamless canvas neural network mesh with continuous fluid motion,
 * dynamic connections, depth layering, intelligence anchor nodes, and subtle data pulses.
 */
export default function NeuralNetworkBackground() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { activeMode } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId = null;
    let width = 0;
    let height = 0;
    let time = 0;
    let isTabVisible = true;

    // Check prefers-reduced-motion
    const mediaQueryMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = mediaQueryMotion.matches;
    const handleMotionChange = (e) => {
      prefersReducedMotion = e.matches;
    };
    mediaQueryMotion.addEventListener('change', handleMotionChange);

    // Mouse coordinates for gentle interactive proximity response
    const mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };
    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // Track tab visibility to pause animation when hidden
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && !animId) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Color definitions based on Astra AI Palette
    // Electric blue: #2563EB, Neon cyan: #06B6D4, Aurora purple: #7C3AED, Primary glow: #38BDF8
    const COLOR_ELECTRIC_BLUE = { r: 37, g: 99, b: 235 };
    const COLOR_NEON_CYAN = { r: 6, g: 182, b: 212 };
    const COLOR_AURORA_PURPLE = { r: 124, g: 58, b: 237 };
    const COLOR_PRIMARY_GLOW = { r: 56, g: 189, b: 248 };

    // Particles and Pulses
    let particles = [];
    let pulses = [];

    // Resize handler with High-DPI support
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      initParticles();
    };

    // Determine particle count based on screen size
    const getParticleCount = () => {
      if (width < 640) return 38;      // Mobile
      if (width < 1024) return 62;     // Tablet
      return 92;                       // Desktop
    };

    const initParticles = () => {
      const count = getParticleCount();
      particles = [];
      pulses = [];

      for (let i = 0; i < count; i++) {
        // Intelligence anchor nodes (approx 8% of total particles)
        const isAnchor = i % 12 === 0;
        // Secondary purple accent nodes (approx 14% of total particles)
        const isPurple = !isAnchor && i % 7 === 0;

        // Depth layer: 0 (deep background) to 1 (crisp foreground)
        const depth = isAnchor ? 0.95 : 0.35 + Math.random() * 0.65;

        // Radii: regular particles 1.2-2.5px, anchors 4.2-5.4px
        const baseRadius = isAnchor 
          ? 4.5 + Math.random() * 0.9 
          : 1.2 + depth * 1.5;

        // Base color assignment
        let baseColor = COLOR_ELECTRIC_BLUE;
        let glowColor = COLOR_PRIMARY_GLOW;
        if (isAnchor) {
          baseColor = COLOR_NEON_CYAN;
          glowColor = COLOR_NEON_CYAN;
        } else if (isPurple) {
          baseColor = COLOR_AURORA_PURPLE;
          glowColor = COLOR_AURORA_PURPLE;
        }

        // Velocity: smooth fluid drift
        const speed = (isAnchor ? 0.22 : 0.25 + depth * 0.38) * (prefersReducedMotion ? 0.15 : 1.0);
        const angle = Math.random() * Math.PI * 2;

        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          speed,
          angle,
          wanderSeed: Math.random() * 1000,
          depth,
          radius: baseRadius,
          baseRadius,
          isAnchor,
          baseColor,
          glowColor,
          alpha: isAnchor ? 0.95 : 0.35 + depth * 0.45,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          pulsePhase: Math.random() * Math.PI * 2,
          connections: []
        });
      }
    };

    // Helper: spawn data packet pulse across connected particles
    const maybeSpawnPulse = (p1, p2) => {
      if (pulses.length >= 8 || prefersReducedMotion) return;
      if (Math.random() < 0.015) {
        pulses.push({
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          progress: 0,
          speed: 0.018 + Math.random() * 0.016,
          color: p1.isAnchor || p2.isAnchor ? COLOR_NEON_CYAN : COLOR_PRIMARY_GLOW
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();

    // Main continuous animation loop
    const render = (now) => {
      if (!isTabVisible) {
        animId = null;
        return;
      }

      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      time += delta;

      // Smooth mouse follow
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.1;
        mouse.y += (mouse.targetY - mouse.y) * 0.1;
      }

      ctx.clearRect(0, 0, width, height);

      const isLightMode = activeMode === 'light';
      const maxDistance = width < 640 ? 115 : 142;
      const maxDistSq = maxDistance * maxDistance;
      const margin = 35;

      // 1. Update particle positions with organic fluid drift & screen edge wrapping
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.connections = [];

        // Continuous fluid organic steering (sine wave directional wander)
        if (!prefersReducedMotion) {
          p.angle += Math.sin(time * 0.4 + p.wanderSeed) * 0.007;
          p.vx = Math.cos(p.angle) * p.speed;
          p.vy = Math.sin(p.angle) * p.speed;
        }

        // Gentle interactive mouse proximity repulsion
        if (mouse.active) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mDistSq = mdx * mdx + mdy * mdy;
          const mouseRadius = 130;
          if (mDistSq < mouseRadius * mouseRadius && mDistSq > 1) {
            const mDist = Math.sqrt(mDistSq);
            const force = (1 - mDist / mouseRadius) * 0.65;
            p.x += (mdx / mDist) * force * 1.8;
            p.y += (mdy / mDist) * force * 1.8;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Seamless Edge Wrapping without abrupt jumps
        if (p.x < -margin) p.x = width + margin;
        if (p.x > width + margin) p.x = -margin;
        if (p.y < -margin) p.y = height + margin;
        if (p.y > height + margin) p.y = -margin;
      }

      // 2. Draw connecting lines with dynamic distance fading & streak prevention
      ctx.lineWidth = isLightMode ? 0.8 : 0.9;

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];

          // Cap connections per node to keep network crisp & avoid clumping
          if (p1.connections.length >= 4 && p2.connections.length >= 4) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;

          // SEAMLESS EDGE WRAP CHECK:
          // Strictly ignore any particles that are wrapping across opposite edges of the canvas.
          // This completely prevents long horizontal/vertical streaks across the screen!
          if (Math.abs(dx) > maxDistance || Math.abs(dy) > maxDistance) continue;

          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            p1.connections.push(p2);
            p2.connections.push(p1);

            // Distance-based smooth alpha fade
            const distRatio = 1 - dist / maxDistance;
            const lineAlpha = distRatio * Math.min(p1.alpha, p2.alpha) * (isLightMode ? 0.28 : 0.42);

            // Line color blend: Electric Blue with cyan accents for anchor connections
            let strokeColor;
            if (p1.isAnchor || p2.isAnchor) {
              strokeColor = `rgba(${COLOR_NEON_CYAN.r}, ${COLOR_NEON_CYAN.g}, ${COLOR_NEON_CYAN.b}, ${lineAlpha * 1.15})`;
            } else if (p1.baseColor === COLOR_AURORA_PURPLE || p2.baseColor === COLOR_AURORA_PURPLE) {
              strokeColor = `rgba(${COLOR_AURORA_PURPLE.r}, ${COLOR_AURORA_PURPLE.g}, ${COLOR_AURORA_PURPLE.b}, ${lineAlpha * 0.8})`;
            } else {
              strokeColor = `rgba(${COLOR_ELECTRIC_BLUE.r}, ${COLOR_ELECTRIC_BLUE.g}, ${COLOR_ELECTRIC_BLUE.b}, ${lineAlpha})`;
            }

            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Random chance to spawn a traveling digital signal pulse
            maybeSpawnPulse(p1, p2);
          }
        }
      }

      // 3. Render digital data pulses traveling along lines
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.progress += pulse.speed;

        if (pulse.progress >= 1) {
          pulses.splice(i, 1);
          continue;
        }

        const px = pulse.x1 + (pulse.x2 - pulse.x1) * pulse.progress;
        const py = pulse.y1 + (pulse.y2 - pulse.y1) * pulse.progress;
        const pulseAlpha = Math.sin(pulse.progress * Math.PI) * (isLightMode ? 0.6 : 0.95);

        ctx.fillStyle = `rgba(${pulse.color.r}, ${pulse.color.g}, ${pulse.color.b}, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Render particles with glowing halos & intelligence anchor nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const pulseVal = Math.sin(time * 2 + p.pulsePhase) * 0.5 + 0.5;
        const currentAlpha = Math.max(0.15, p.alpha * (0.8 + pulseVal * 0.35) * (isLightMode ? 0.65 : 1.0));
        const currentRadius = p.radius * (0.92 + pulseVal * 0.16);

        // A. Digital Intelligence Anchor Nodes (Luminous bloom & outer aura)
        if (p.isAnchor) {
          // Soft outer glowing corona
          const auraGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentRadius * 3.5);
          auraGrad.addColorStop(0, `rgba(${COLOR_NEON_CYAN.r}, ${COLOR_NEON_CYAN.g}, ${COLOR_NEON_CYAN.b}, ${currentAlpha * 0.7})`);
          auraGrad.addColorStop(0.45, `rgba(${COLOR_PRIMARY_GLOW.r}, ${COLOR_PRIMARY_GLOW.g}, ${COLOR_PRIMARY_GLOW.b}, ${currentAlpha * 0.28})`);
          auraGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius * 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Anchor Core
          ctx.fillStyle = `rgba(240, 249, 255, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius * 0.85, 0, Math.PI * 2);
          ctx.fill();

          // Outer crisp ring
          ctx.strokeStyle = `rgba(${COLOR_NEON_CYAN.r}, ${COLOR_NEON_CYAN.g}, ${COLOR_NEON_CYAN.b}, ${currentAlpha * 0.85})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        } 
        // B. Regular & Accent Neural Particles
        else {
          // Soft subtle particle halo
          if (p.depth > 0.65) {
            ctx.fillStyle = `rgba(${p.glowColor.r}, ${p.glowColor.g}, ${p.glowColor.b}, ${currentAlpha * 0.35})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Particle Core
          ctx.fillStyle = `rgba(${p.baseColor.r}, ${p.baseColor.g}, ${p.baseColor.b}, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Comprehensive resource cleanup
    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      mediaQueryMotion.removeEventListener('change', handleMotionChange);
    };
  }, [activeMode]);

  return (
    <div 
      ref={containerRef}
      className={`neural-network-container ${activeMode === 'light' ? 'light-mode' : ''}`}
      aria-hidden="true"
    >
      {/* Underlying CSS Aurora Gradient Layer */}
      <div className="neural-aurora-layer">
        <div className="aurora-base" />
        <div className="aurora-glow aurora-blue" />
        <div className="aurora-glow aurora-purple" />
        <div className="aurora-glow aurora-cyan" />
        <div className="neural-vignette" />
      </div>

      {/* Transparent Canvas for Moving Neural Particles & Connecting Mesh */}
      <canvas ref={canvasRef} className="neural-canvas" />
    </div>
  );
}
