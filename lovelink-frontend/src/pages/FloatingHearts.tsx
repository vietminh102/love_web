import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

export function FloatingHearts() {
  const [hearts, setHearts] = useState<Array<{ id: number; left: number; duration: number; delay: number; size: number }>>([]);

  useEffect(() => {
    // Generate initial hearts
    const generateHeart = (id: number) => ({
      id,
      left: Math.random() * 100, // percentage
      duration: 10 + Math.random() * 15, // seconds
      delay: Math.random() * 5,
      size: 16 + Math.random() * 24, // px
    });

    const initialHearts = Array.from({ length: 20 }, (_, i) => generateHeart(i));
    setHearts(initialHearts);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          className="absolute -bottom-12.5"
          style={{ left: `${heart.left}%` }}
          initial={{ y: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: -window.innerHeight - 100,
            opacity: [0, 0.5, 0.8, 0],
            rotate: [0, Math.random() > 0.5 ? 360 : -360],
          }}
          transition={{
            duration: heart.duration,
            delay: heart.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Heart
            className="text-pink-300 fill-pink-300"
            style={{ width: heart.size, height: heart.size, opacity: 0.3 }}
          />
        </motion.div>
      ))}
    </div>
  );
}