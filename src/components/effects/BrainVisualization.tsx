import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface BrainVisualizationProps {
  isThinking?: boolean;
  intensity?: "low" | "medium" | "high";
}

export const BrainVisualization = ({ isThinking = true, intensity = "high" }: BrainVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 300;
    canvas.height = 300;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let animationFrameId: number;
    let time = 0;

    const intensityMap = { low: 0.5, medium: 0.75, high: 1 };
    const speed = intensityMap[intensity];

    const drawBrain = () => {
      // Clear canvas
      ctx.fillStyle = "rgba(15, 23, 42, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.03 * speed;

      // Draw neural network nodes
      const nodes = [];
      const nodeCount = 20;

      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const radius = 60 + Math.sin(time + i * 0.3) * 30;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        nodes.push({ x, y, angle, i });
      }

      // Draw synapses (connections)
      ctx.strokeStyle = `rgba(0, 191, 255, ${0.3 + Math.sin(time) * 0.2})`;
      ctx.lineWidth = 1;

      for (let i = 0; i < nodes.length; i++) {
        const node1 = nodes[i];
        const node2 = nodes[(i + 1) % nodes.length];

        ctx.beginPath();
        ctx.moveTo(node1.x, node1.y);
        ctx.lineTo(node2.x, node2.y);
        ctx.stroke();

        // Connect to center occasionally
        if (i % 3 === 0) {
          ctx.strokeStyle = `rgba(147, 51, 234, ${0.2 + Math.cos(time + i) * 0.15})`;
          ctx.beginPath();
          ctx.moveTo(node1.x, node1.y);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
        }
      }

      // Draw glowing nodes
      for (const node of nodes) {
        const pulseSize = 3 + Math.sin(time + node.i * 0.5) * 2;
        const glow = 8 + Math.sin(time + node.i * 0.3) * 4;

        // Outer glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glow);
        gradient.addColorStop(0, `rgba(0, 191, 255, ${0.4 + Math.sin(time + node.i) * 0.2})`);
        gradient.addColorStop(1, `rgba(0, 191, 255, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glow, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright node
        ctx.fillStyle = `hsl(190, 100%, ${60 + Math.sin(time + node.i * 0.7) * 15}%)`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw center core
      const coreGlow = 40 + Math.sin(time * 0.5) * 20;
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreGlow);
      coreGradient.addColorStop(0, `rgba(147, 51, 234, ${0.3 + Math.sin(time) * 0.2})`);
      coreGradient.addColorStop(0.5, `rgba(147, 51, 234, 0.1)`);
      coreGradient.addColorStop(1, "rgba(147, 51, 234, 0)");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreGlow, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.fillStyle = `hsl(210, 100%, ${50 + Math.sin(time * 0.8) * 20}%)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8 + Math.sin(time * 1.5) * 3, 0, Math.PI * 2);
      ctx.fill();

      if (isThinking) {
        animationFrameId = requestAnimationFrame(drawBrain);
      }
    };

    drawBrain();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isThinking, intensity]);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-w-[300px] filter drop-shadow-[0_0_20px_hsl(190_100%_50%/0.3)]"
      />

      {/* Text below brain */}
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-4 text-center"
      >
        <p className="text-sm font-semibold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
          Aurora myśli…
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Analizuje Twoją prośbę i przygotowuje odpowiedź
        </p>
      </motion.div>

      {/* Floating particles around brain */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400"
          animate={{
            x: [0, Math.cos((i / 6) * Math.PI * 2) * 80],
            y: [0, Math.sin((i / 6) * Math.PI * 2) * 80],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
          }}
          style={{
            filter: "drop-shadow(0 0 6px hsl(190 100% 50% / 0.8))",
          }}
        />
      ))}
    </div>
  );
};
