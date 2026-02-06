import React, { useRef, useEffect, useCallback } from 'react';

interface AssistantOrbProps {
  state: 'idle' | 'greeting' | 'listening' | 'processing' | 'speaking' | 'vision_file' | 'vision_processing' | 'vision_asr';
}

const AssistantOrb: React.FC<AssistantOrbProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Simple wave animation - minimal GPU usage
  const drawWaves = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.35;
    
    // Determine color and wave intensity based on state
    let baseColor: string;
    let waveIntensity: number;
    
    switch (state) {
      case 'listening':
      case 'vision_asr':
        baseColor = '48, 255, 167'; // Green
        waveIntensity = 8; // More wavy when listening
        break;
      case 'speaking':
      case 'greeting':
        baseColor = '200, 200, 200'; // Dull white
        waveIntensity = 4;
        break;
      case 'processing':
      case 'vision_processing':
        baseColor = '150, 150, 255'; // Light purple
        waveIntensity = 6;
        break;
      case 'vision_file':
        baseColor = '100, 200, 255'; // Light blue
        waveIntensity = 5;
        break;
      default: // idle
        baseColor = '48, 255, 167'; // Green
        waveIntensity = 2; // Subtle wavy at idle
    }
    
    // Draw subtle wavy orb outline
    ctx.beginPath();
    const points = 60; // Number of points around the circle
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      
      // Simple sine wave distortion
      const wave1 = Math.sin(angle * 3 + time * 2) * waveIntensity;
      const wave2 = Math.sin(angle * 5 - time * 1.5) * (waveIntensity * 0.5);
      const radius = baseRadius + wave1 + wave2;
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    
    // Fill with semi-transparent color
    ctx.fillStyle = `rgba(${baseColor}, 0.15)`;
    ctx.fill();
    
    // Stroke with slightly more opaque color
    ctx.strokeStyle = `rgba(${baseColor}, 0.4)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add a subtle inner glow (simple circle, no blur)
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor}, 0.08)`;
    ctx.fill();
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let startTime = Date.now();
    let frameCount = 0;
    
    // Limit to 30fps to save GPU
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      
      // Throttle to target FPS
      if (elapsed >= frameCount * frameInterval) {
        const time = elapsed * 0.001;
        drawWaves(ctx, canvas.width, canvas.height, time);
        frameCount++;
      }
      
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [drawWaves]);

  // Get scale based on state
  const getScale = () => {
    switch (state) {
      case 'listening':
      case 'vision_asr':
        return 'scale-110';
      case 'speaking':
        return 'scale-110';
      case 'processing':
      case 'greeting':
      case 'vision_processing':
        return 'scale-105';
      case 'vision_file':
        return 'scale-110';
      default:
        return '';
    }
  };

  return (
    <div 
      className={`relative transition-transform duration-500 z-50 ${getScale()}`}
      style={{ width: '208px', height: '208px' }}
    >
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};

export default AssistantOrb;
