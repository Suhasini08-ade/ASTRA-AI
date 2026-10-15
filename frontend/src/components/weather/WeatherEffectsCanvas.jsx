import React, { useEffect, useRef } from 'react';

export default function WeatherEffectsCanvas({ season = 'sunny', intensity = 'normal', className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Multiplier based on intensity
    const mult = intensity === 'gentle' ? 0.6 : intensity === 'high' ? 1.4 : 1.0;

    // --- EFFECT DATA & PARTICLES ---
    let particles = [];
    let splashes = [];
    let lightningState = { active: false, timer: 0, nextFlash: 180 + Math.random() * 240, bolts: [], flashAlpha: 0 };
    let sunAngle = 0;
    let time = 0;

    // Helper: Leaf Path
    const drawLeaf = (ctx, size, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.8, -size * 0.5, size * 0.8, size * 0.5, 0, size);
      ctx.bezierCurveTo(-size * 0.8, size * 0.5, -size * 0.8, -size * 0.5, 0, -size);
      ctx.fill();

      // Leaf center stem line
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = Math.max(0.7, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size * 1.15);
      ctx.stroke();
    };

    // Helper: Sakura Petal Path
    const drawSakuraPetal = (ctx, size, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.6, -size * 0.7, size * 0.7, size * 0.4, 0, size);
      ctx.bezierCurveTo(-size * 0.7, size * 0.4, -size * 0.6, -size * 0.7, 0, -size);
      ctx.fill();

      // Subtle petal heart notch at top
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.arc(0, -size * 0.2, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
    };

    // Helper: Snowflake Crystal
    const drawSnowflake = (ctx, radius, opacity) => {
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.lineWidth = 1;

      if (radius > 3.2) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          ctx.moveTo(0, 0);
          ctx.lineTo(x, y);

          // Small branch
          const bx = Math.cos(angle) * (radius * 0.6);
          const by = Math.sin(angle) * (radius * 0.6);
          const branchAngle1 = angle + Math.PI / 4;
          const branchAngle2 = angle - Math.PI / 4;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(branchAngle1) * (radius * 0.35), by + Math.sin(branchAngle1) * (radius * 0.35));
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(branchAngle2) * (radius * 0.35), by + Math.sin(branchAngle2) * (radius * 0.35));
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Helper: Lightning Bolt Generator
    const createLightningBolt = (startX, startY) => {
      const segments = [];
      let curX = startX;
      let curY = startY;
      const targetY = height * 0.85;

      while (curY < targetY) {
        const nextX = curX + (Math.random() - 0.5) * 45;
        const nextY = curY + 15 + Math.random() * 25;
        segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

        // Branch chance
        if (Math.random() < 0.28 && segments.length < 24) {
          let bX = nextX;
          let bY = nextY;
          for (let b = 0; b < 3; b++) {
            const nbX = bX + (Math.random() - 0.5) * 35;
            const nbY = bY + 12 + Math.random() * 18;
            segments.push({ x1: bX, y1: bY, x2: nbX, y2: nbY, isBranch: true });
            bX = nbX;
            bY = nbY;
          }
        }
        curX = nextX;
        curY = nextY;
      }
      return segments;
    };

    // Initialize particles based on current season
    const initParticles = () => {
      particles = [];
      splashes = [];

      if (season === 'rain' || season === 'thunderstorm') {
        const count = Math.floor((season === 'thunderstorm' ? 140 : 95) * mult);
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * (width + 100) - 50,
            y: Math.random() * height,
            length: 18 + Math.random() * 20,
            speed: (season === 'thunderstorm' ? 18 : 13) + Math.random() * 10,
            slant: -2.8 - Math.random() * 2.2,
            opacity: 0.25 + Math.random() * 0.5,
            width: 1 + Math.random() * 1.2
          });
        }
      } else if (season === 'sunny') {
        // Shimmering warm sun particles & bokeh
        const count = Math.floor(55 * mult);
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 2 + Math.random() * 6.5,
            baseRadius: 2 + Math.random() * 6.5,
            speedY: 0.25 + Math.random() * 0.65,
            speedX: (Math.random() - 0.5) * 0.4,
            pulseOffset: Math.random() * Math.PI * 2,
            opacity: 0.25 + Math.random() * 0.55,
            hue: 38 + Math.random() * 18 // Warm gold/amber/sunflower yellow
          });
        }
      } else if (season === 'snow') {
        const count = Math.floor(100 * mult);
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 1.5 + Math.random() * 4,
            speed: 0.7 + Math.random() * 1.8,
            swing: 0.8 + Math.random() * 1.5,
            swingAngle: Math.random() * Math.PI * 2,
            swingSpeed: 0.015 + Math.random() * 0.03,
            opacity: 0.35 + Math.random() * 0.6
          });
        }
      } else if (season === 'autumn') {
        const count = Math.floor(40 * mult);
        const colors = ['#ea580c', '#f59e0b', '#dc2626', '#b45309', '#fbbf24', '#c2410c'];
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * (width + 60) - 30,
            y: Math.random() * height,
            size: 9 + Math.random() * 11,
            speedY: 1.2 + Math.random() * 2.2,
            speedX: -1.0 - Math.random() * 1.8,
            angleX: Math.random() * Math.PI * 2,
            angleY: Math.random() * Math.PI * 2,
            rotSpeedX: 0.02 + Math.random() * 0.04,
            rotSpeedY: 0.015 + Math.random() * 0.035,
            rotZ: Math.random() * Math.PI * 2,
            rotSpeedZ: (Math.random() - 0.5) * 0.04,
            color: colors[Math.floor(Math.random() * colors.length)],
            wobble: Math.random() * Math.PI * 2
          });
        }
      } else if (season === 'spring') {
        const count = Math.floor(55 * mult);
        const petals = ['#fbcfe8', '#f472b6', '#fda4af', '#f9a8d4', '#fce7f3'];
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * (width + 50),
            y: Math.random() * height,
            size: 7 + Math.random() * 7,
            speedY: 0.9 + Math.random() * 1.5,
            speedX: -0.6 - Math.random() * 1.2,
            angleX: Math.random() * Math.PI * 2,
            rotSpeedX: 0.018 + Math.random() * 0.03,
            rotZ: Math.random() * Math.PI * 2,
            rotSpeedZ: (Math.random() - 0.5) * 0.03,
            color: petals[Math.floor(Math.random() * petals.length)],
            wobble: Math.random() * Math.PI * 2
          });
        }
      } else if (season === 'cloudy') {
        const count = Math.floor(9 * mult);
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: (height * 0.1) + Math.random() * (height * 0.6),
            radius: 70 + Math.random() * 110,
            speedX: 0.15 + Math.random() * 0.35,
            opacity: 0.06 + Math.random() * 0.1
          });
        }
      }
    };

    initParticles();

    // --- MAIN RENDER LOOP ---
    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // 1. SUNNY: Sunrays on screen & golden bokeh
      if (season === 'sunny') {
        sunAngle += 0.0015;

        // Position of the sun in upper right / top center
        const sunX = width * 0.82;
        const sunY = height * 0.08;

        // Draw dynamic rotating volumetric sunbeams
        const rayCount = 18;
        const maxRadius = Math.max(width, height) * 1.6;

        ctx.save();
        ctx.translate(sunX, sunY);

        // Core sun glow
        const sunGlow = ctx.createRadialGradient(0, 0, 15, 0, 0, 180);
        sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        sunGlow.addColorStop(0.3, 'rgba(251, 191, 36, 0.22)');
        sunGlow.addColorStop(0.7, 'rgba(245, 158, 11, 0.08)');
        sunGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 180, 0, Math.PI * 2);
        ctx.fill();

        // Volumetric Sunrays
        ctx.rotate(sunAngle);
        for (let i = 0; i < rayCount; i++) {
          const angle1 = (i * Math.PI * 2) / rayCount;
          const angle2 = angle1 + (Math.PI * 2) / (rayCount * 2.8);
          const rayPulse = 0.5 + 0.5 * Math.sin(time * 1.5 + i);
          const rayAlpha = (0.04 + rayPulse * 0.05) * mult;

          const rayGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, maxRadius);
          rayGrad.addColorStop(0, `rgba(253, 224, 71, ${rayAlpha * 1.5})`);
          rayGrad.addColorStop(0.35, `rgba(251, 191, 36, ${rayAlpha})`);
          rayGrad.addColorStop(0.8, `rgba(245, 158, 11, ${rayAlpha * 0.3})`);
          rayGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, maxRadius, angle1, angle2);
          ctx.closePath();
          ctx.fill();
        }

        // Second counter-rotating softer ray layer
        ctx.rotate(-sunAngle * 1.8);
        for (let j = 0; j < 12; j++) {
          const angle1 = (j * Math.PI * 2) / 12;
          const angle2 = angle1 + (Math.PI * 2) / 36;
          const rayAlpha = 0.035 * mult;

          ctx.fillStyle = `rgba(254, 240, 138, ${rayAlpha})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, maxRadius, angle1, angle2);
          ctx.closePath();
          ctx.fill();
        }

        // Lens flare artifacts along axis
        const flareDist = [0.35, 0.65, 0.95];
        const flareSizes = [18, 38, 26];
        const flareAlphas = [0.12, 0.07, 0.09];
        flareDist.forEach((dist, idx) => {
          const fx = -sunX * dist * 0.8;
          const fy = (height - sunY) * dist * 0.7;
          ctx.beginPath();
          ctx.arc(fx, fy, flareSizes[idx], 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${flareAlphas[idx]})`;
          ctx.fill();
        });

        ctx.restore();

        // Shimmering Bokeh / Light Dust Particles
        particles.forEach(p => {
          p.y -= p.speedY;
          p.x += p.speedX + Math.sin(time + p.pulseOffset) * 0.25;
          const pulse = 0.7 + 0.3 * Math.sin(time * 2 + p.pulseOffset);
          const r = p.baseRadius * pulse;

          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          grad.addColorStop(0, `hsla(${p.hue}, 95%, 75%, ${p.opacity * pulse})`);
          grad.addColorStop(0.6, `hsla(${p.hue}, 90%, 60%, ${p.opacity * 0.4 * pulse})`);
          grad.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 2. RAIN & THUNDERSTORM: Slanted Rain, Ripples & Lightning
      else if (season === 'rain' || season === 'thunderstorm') {
        // Raindrops
        ctx.strokeStyle = season === 'thunderstorm' ? 'rgba(186, 230, 253, 0.65)' : 'rgba(147, 197, 253, 0.55)';
        ctx.lineCap = 'round';

        particles.forEach(drop => {
          ctx.lineWidth = drop.width;
          ctx.strokeStyle = `rgba(186, 230, 253, ${drop.opacity})`;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + drop.slant, drop.y + drop.length);
          ctx.stroke();

          drop.x += drop.slant * 0.9;
          drop.y += drop.speed;

          // Hit ground / bottom edge
          if (drop.y > height - 10) {
            // Spawn ripple splash
            if (Math.random() < 0.45 && splashes.length < 50) {
              splashes.push({
                x: drop.x,
                y: height - 6 - Math.random() * 8,
                r: 1,
                maxR: 6 + Math.random() * 9,
                alpha: 0.6,
                growth: 0.6 + Math.random() * 0.5
              });
            }
            drop.y = -drop.length - Math.random() * 40;
            drop.x = Math.random() * (width + 120) - 40;
          }
        });

        // Splashes / Ripples
        for (let i = splashes.length - 1; i >= 0; i--) {
          const s = splashes[i];
          s.r += s.growth;
          s.alpha *= 0.88;

          ctx.strokeStyle = `rgba(186, 230, 253, ${s.alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, s.r, s.r * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();

          if (s.alpha < 0.05 || s.r > s.maxR) {
            splashes.splice(i, 1);
          }
        }

        // Lightning logic for Thunderstorm
        if (season === 'thunderstorm') {
          lightningState.timer++;
          if (lightningState.timer > lightningState.nextFlash) {
            lightningState.active = true;
            lightningState.timer = 0;
            lightningState.nextFlash = 220 + Math.random() * 320;
            lightningState.flashAlpha = 0.85;
            lightningState.bolts = [createLightningBolt(width * 0.2 + Math.random() * (width * 0.6), 0)];
          }

          if (lightningState.flashAlpha > 0.01) {
            // Flash sky fill
            ctx.fillStyle = `rgba(224, 242, 254, ${lightningState.flashAlpha * 0.45})`;
            ctx.fillRect(0, 0, width, height);

            // Draw lightning bolt
            ctx.save();
            ctx.shadowColor = 'rgba(147, 197, 253, 0.9)';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, lightningState.flashAlpha * 1.5)})`;
            ctx.lineWidth = 2.5;

            lightningState.bolts.forEach(bolt => {
              bolt.forEach(seg => {
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
                ctx.stroke();
              });
            });
            ctx.restore();

            lightningState.flashAlpha *= 0.88;
          }
        }
      }

      // 3. SNOW: Gently Drifting Snowflakes
      else if (season === 'snow') {
        particles.forEach(flake => {
          flake.swingAngle += flake.swingSpeed;
          flake.x += Math.sin(flake.swingAngle) * flake.swing;
          flake.y += flake.speed;

          if (flake.y > height + 10) {
            flake.y = -10;
            flake.x = Math.random() * width;
          }
          if (flake.x > width + 10) flake.x = -10;
          if (flake.x < -10) flake.x = width + 10;

          ctx.save();
          ctx.translate(flake.x, flake.y);
          drawSnowflake(ctx, flake.radius, flake.opacity);
          ctx.restore();
        });
      }

      // 4. AUTUMN: Swirling Autumn Leaves
      else if (season === 'autumn') {
        particles.forEach(leaf => {
          leaf.angleX += leaf.rotSpeedX;
          leaf.angleY += leaf.rotSpeedY;
          leaf.rotZ += leaf.rotSpeedZ;
          leaf.wobble += 0.03;

          leaf.y += leaf.speedY;
          leaf.x += leaf.speedX + Math.sin(leaf.wobble) * 1.2;

          if (leaf.y > height + 25) {
            leaf.y = -25;
            leaf.x = Math.random() * (width + 60) - 20;
          }
          if (leaf.x < -40) {
            leaf.x = width + 30;
          }

          ctx.save();
          ctx.translate(leaf.x, leaf.y);
          ctx.rotate(leaf.rotZ);
          // 3D tumble transformation
          ctx.scale(Math.cos(leaf.angleX), Math.cos(leaf.angleY));
          drawLeaf(ctx, leaf.size, leaf.color);
          ctx.restore();
        });
      }

      // 5. SPRING: Fluttering Sakura Petals
      else if (season === 'spring') {
        particles.forEach(petal => {
          petal.angleX += petal.rotSpeedX;
          petal.rotZ += petal.rotSpeedZ;
          petal.wobble += 0.025;

          petal.y += petal.speedY;
          petal.x += petal.speedX + Math.sin(petal.wobble) * 1.1;

          if (petal.y > height + 20) {
            petal.y = -20;
            petal.x = Math.random() * (width + 50);
          }
          if (petal.x < -30) petal.x = width + 20;

          ctx.save();
          ctx.translate(petal.x, petal.y);
          ctx.rotate(petal.rotZ);
          ctx.scale(Math.cos(petal.angleX), 1);
          drawSakuraPetal(ctx, petal.size, petal.color);
          ctx.restore();
        });
      }

      // 6. CLOUDY: Volumetric Mist & Clouds
      else if (season === 'cloudy') {
        particles.forEach(cloud => {
          cloud.x += cloud.speedX;
          if (cloud.x - cloud.radius > width) {
            cloud.x = -cloud.radius;
            cloud.y = height * 0.1 + Math.random() * (height * 0.6);
          }

          const grad = ctx.createRadialGradient(cloud.x, cloud.y, cloud.radius * 0.1, cloud.x, cloud.y, cloud.radius);
          grad.addColorStop(0, `rgba(226, 232, 240, ${cloud.opacity})`);
          grad.addColorStop(0.5, `rgba(203, 213, 225, ${cloud.opacity * 0.6})`);
          grad.addColorStop(1, 'rgba(203, 213, 225, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [season, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${className}`}
    />
  );
}
