import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react"; // Thêm icon X để đóng màn hình

const LOVE_MESSAGES = [
  "Em là ánh sáng trong cuộc đời anh 🌟",
  "Anh yêu em mãi mãi 💕",
  "Em làm trái tim anh rung động ❤️",
  "Cùng em, anh có thể vượt qua mọi thứ 🌹",
  "Em là điều kỳ diệu nhất anh từng gặp ✨",
  "Nụ cười của em làm anh tan chảy 😍",
  "Anh muốn nắm tay em đến cuối cuộc đời 💑",
  "Em là giấc mơ đẹp nhất của anh 🌙",
  "Yêu em hơn tất cả những vì sao 🌠",
  "Em là lý do anh mỉm cười mỗi sáng ☀️",
  "Trái tim anh chỉ đập vì em 💓",
  "Em là bài thơ đẹp nhất anh được đọc 📖",
  "Cùng em, mọi ngày đều là thiên đường 🌸",
  "Anh không thể tưởng tượng cuộc sống không có em 🥺",
  "Em đẹp hơn cả trăng sao 🌟",
  "Love you to the moon and back 🚀🌕",
  "Em là tất cả của anh 💝",
  "Mãi yêu em, em ơi! 🫶",
  "Em là hạnh phúc lớn nhất của anh 🎊",
  "Anh yêu cái cách em cười 😊",
];

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  emoji: string;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  duration: number;
  size: number;
  color: string;
}

interface Bubble {
  id: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
}

const PARTICLE_EMOJIS = ["🩷", "💕", "💖", "💗", "💓", "💝", "🌸", "✨", "🎀", "⭐", "💫", "🍭"];
const TEXT_COLORS = ["#ff6b9d", "#ff85a1", "#ff4d8b", "#e91e8c", "#ff9eb5", "#ffb3c6", "#fc8eac", "#ff69b4"];

function CuteHeart({ onClick, phase, heartScale }: {
  onClick: () => void;
  phase: string;
  heartScale: number;
}) {
  return (
    <motion.div
      onClick={onClick}
      style={{
        cursor: phase === "idle" ? "pointer" : "default",
        userSelect: "none",
        transformOrigin: "center bottom",
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: heartScale, opacity: 1 }}
      exit={{ scale: 3.5, opacity: 0, transition: { duration: 0.35 } }}
      whileHover={phase === "idle" ? { scale: 1.1 } : {}}
      transition={{ scale: { type: "spring", stiffness: 260, damping: 12 } }}
    >
      <svg width="220" height="230" viewBox="0 0 220 230" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="heartMain" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffcde0" />
            <stop offset="35%" stopColor="#ff8fb3" />
            <stop offset="75%" stopColor="#ff5c95" />
            <stop offset="100%" stopColor="#e8407a" />
          </radialGradient>
          <radialGradient id="heartHighlight" cx="38%" cy="28%" r="32%">
            <stop offset="0%" stopColor="#ffffff99" />
            <stop offset="100%" stopColor="#ffffff00" />
          </radialGradient>
          <radialGradient id="blushL" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffb3c8cc" />
            <stop offset="100%" stopColor="#ffb3c800" />
          </radialGradient>
          <filter id="softShadow" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#ff5c9588" />
          </filter>
          <filter id="outerGlow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <path
          d="M110 195 C65 160 14 126 14 72 C14 40 40 18 72 18 C89 18 103 27 110 39 C117 27 131 18 148 18 C180 18 206 40 206 72 C206 126 155 160 110 195Z"
          fill="#e8407a44"
          transform="translate(2, 6)"
          style={{ filter: "blur(8px)" }}
        />

        <path
          d="M110 195 C65 160 14 126 14 72 C14 40 40 18 72 18 C89 18 103 27 110 39 C117 27 131 18 148 18 C180 18 206 40 206 72 C206 126 155 160 110 195Z"
          fill="url(#heartMain)"
          filter="url(#softShadow)"
        />

        <path
          d="M110 195 C65 160 14 126 14 72 C14 40 40 18 72 18 C89 18 103 27 110 39 C117 27 131 18 148 18 C180 18 206 40 206 72 C206 126 155 160 110 195Z"
          fill="url(#heartHighlight)"
        />

        <ellipse cx="85" cy="95" rx="8" ry="9" fill="#5a2035" />
        <ellipse cx="135" cy="95" rx="8" ry="9" fill="#5a2035" />
        <circle cx="88" cy="91" r="3" fill="white" />
        <circle cx="138" cy="91" r="3" fill="white" />
        <circle cx="83" cy="98" r="1.5" fill="white" />
        <circle cx="133" cy="98" r="1.5" fill="white" />

        <path
          d="M95 118 Q110 132 125 118"
          stroke="#c94070"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        <ellipse cx="72" cy="115" rx="14" ry="9" fill="url(#blushL)" />
        <ellipse cx="148" cy="115" rx="14" ry="9" fill="url(#blushL)" />

        <text x="38" y="68" fontSize="14" fill="white" opacity="0.8">✨</text>
        <text x="170" y="72" fontSize="12" fill="white" opacity="0.7">✨</text>
        <text x="98" y="175" fontSize="11" fill="white" opacity="0.6">💫</text>

        <path
          d="M52 50 C49 45 43 46 43 51 C43 56 52 62 52 62 C52 62 61 56 61 51 C61 46 55 45 52 50Z"
          fill="#ffffffaa"
        />
        <path
          d="M168 50 C165 45 159 46 159 51 C159 56 168 62 168 62 C168 62 177 56 177 51 C177 46 171 45 168 50Z"
          fill="#ffffffaa"
        />
      </svg>
    </motion.div>
  );
}

// 🌟 NHẬN THÊM HÀM onClose ĐỂ ĐÓNG MÀN HÌNH
export function SecretLoveAnimation({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"idle" | "beating" | "exploding" | "messages">("idle");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [heartScale, setHeartScale] = useState(1);
  const [bubbles] = useState<Bubble[]>(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 95 + 2,
      size: 6 + Math.random() * 18,
      delay: Math.random() * 6,
      duration: 5 + Math.random() * 5,
    }))
  );

  const textIdRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const particleActive = useRef(false);

  const spawnFloatingText = useCallback(() => {
    const id = textIdRef.current++;
    const msg = LOVE_MESSAGES[id % LOVE_MESSAGES.length];
    const newText: FloatingText = {
      id,
      text: msg,
      x: Math.random() * 72 + 4,
      duration: 6 + Math.random() * 4,
      size: 0.85 + Math.random() * 0.55,
      color: TEXT_COLORS[Math.floor(Math.random() * TEXT_COLORS.length)],
    };
    setFloatingTexts(prev => [...prev.slice(-30), newText]);
  }, []);

  const explodeHeart = useCallback(() => {
    setPhase("exploding");
    const newParticles: Particle[] = Array.from({ length: 90 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 9;
      return {
        id: i,
        x: 50,
        y: 45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 14 + Math.random() * 20,
        emoji: PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)],
      };
    });
    setParticles(newParticles);
    particleActive.current = true;
    setTimeout(() => {
      setPhase("messages");
      spawnFloatingText();
    }, 900);
  }, [spawnFloatingText]);

  const startBeating = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("beating");
    let count = 0;
    const beat = () => {
      setHeartScale(s => (s === 1 ? 1.28 : 1));
      count++;
      if (count >= 6) {
        clearInterval(intervalRef.current!);
        setTimeout(explodeHeart, 200);
      }
    };
    intervalRef.current = setInterval(beat, 280);
  }, [phase, explodeHeart]);

  useEffect(() => {
    if (phase === "messages") {
      const id = setInterval(spawnFloatingText, 750);
      return () => clearInterval(id);
    }
  }, [phase, spawnFloatingText]);

  useEffect(() => {
    if (!particleActive.current || particles.length === 0) return;
    const animate = () => {
      setParticles(prev => {
        const next = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * 0.85,
            y: p.y + p.vy * 0.85,
            vy: p.vy + 0.18,
            vx: p.vx * 0.98,
          }))
          .filter(p => p.y < 118 && p.x > -8 && p.x < 108);
        if (next.length === 0) particleActive.current = false;
        return next;
      });
      if (particleActive.current) animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [particles.length]);

  const reset = () => {
    setPhase("idle");
    setParticles([]);
    setFloatingTexts([]);
    setHeartScale(1);
    particleActive.current = false;
    textIdRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    cancelAnimationFrame(animFrameRef.current);
  };

  return (
    // 🌟 ĐÃ THÊM CLASS fixed inset-0 z-[9999] ĐỂ CHE TOÀN BỘ MÀN HÌNH TRANG CHỦ
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] w-full min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #ffe0f0 0%, #ffc2d4 25%, #ffb3c6 50%, #ffd6e7 75%, #fff0f6 100%)",
        fontFamily: "'Dancing Script', cursive",
      }}
    >
      {/* 🌟 NÚT ĐÓNG (QUAY LẠI TRANG CHỦ) */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-[10000] p-3 bg-white/40 hover:bg-white/80 rounded-full backdrop-blur-md transition-all shadow-md"
      >
        <X className="w-6 h-6 text-pink-500" />
      </button>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { w: 340, h: 220, x: -60, y: -60, op: 0.35 },
          { w: 280, h: 180, x: "60%", y: -40, op: 0.3 },
          { w: 320, h: 200, x: -40, y: "60%", op: 0.28 },
          { w: 260, h: 170, x: "65%", y: "65%", op: 0.32 },
        ].map((b, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: b.w,
              height: b.h,
              left: b.x,
              top: b.y,
              background: "radial-gradient(circle, #fff0f8 0%, #ffd6e7 60%, transparent 100%)",
              opacity: b.op,
              filter: "blur(30px)",
            }}
          />
        ))}
      </div>

      {bubbles.map(b => (
        <motion.div
          key={b.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${b.x}%`,
            width: b.size,
            height: b.size,
            background: "radial-gradient(circle at 35% 30%, #ffffff99, #ffb3c622)",
            border: "1px solid #ffb3c655",
            boxShadow: "inset 0 0 6px #ffffff44",
          }}
          animate={{ y: [0, -500], opacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: b.duration, repeat: Infinity, delay: b.delay, ease: "easeIn" }}
        />
      ))}

      {[...Array(14)].map((_, i) => (
        <motion.div
          key={`deco-${i}`}
          className="absolute pointer-events-none select-none"
          style={{ left: `${(i * 7.3 + 1) % 100}%`, zIndex: 5, fontSize: "1.1rem", opacity: 0.7 }}
          animate={{
            y: ["-8vh", "108vh"],
            x: [0, (i % 2 === 0 ? 1 : -1) * 28],
            rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
            opacity: [0, 0.6, 0.6, 0],
          }}
          transition={{ duration: 7 + (i % 5) * 1.4, repeat: Infinity, delay: i * 0.9, ease: "linear" }}
        >
          {["🌸", "🩷", "💮", "🌺", "🎀", "💗", "✨"][i % 7]}
        </motion.div>
      ))}

      <motion.h1
        className="relative z-10 text-center mb-4 px-4"
        style={{
          fontFamily: "'Great Vibes', cursive",
          color: "#c4497a",
          textShadow: "0 2px 8px #ffb3c688, 0 0 30px #ff85a144",
          fontSize: "clamp(2rem, 6vw, 3.8rem)",
        }}
        initial={{ opacity: 0, y: -28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      >
        Anh Muốn Nói Với Em...
      </motion.h1>

      <AnimatePresence>
        {phase === "idle" && (
          <motion.p
            className="relative z-10 text-center mb-8 px-6"
            style={{
              fontFamily: "'Dancing Script', cursive",
              color: "#e0607e",
              fontSize: "clamp(1rem, 2.6vw, 1.3rem)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.7, duration: 1 }}
          >
            Chạm vào trái tim để khám phá bí mật 🩷
          </motion.p>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex items-center justify-center" style={{ width: 280, height: 280 }}>
        <AnimatePresence>
          {phase !== "exploding" && (
            <>
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 300,
                  height: 300,
                  background: "radial-gradient(circle, #ffb3c655 0%, #ff85a122 50%, transparent 75%)",
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 420,
                  height: 420,
                  background: "radial-gradient(circle, #ffc2d433 0%, transparent 65%)",
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              />
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== "exploding" && (
            <CuteHeart
              key="cute-heart"
              onClick={startBeating}
              phase={phase}
              heartScale={heartScale}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute select-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: p.size,
              transform: "translate(-50%,-50%)",
              zIndex: 20,
              lineHeight: 1,
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {floatingTexts.map(ft => (
            <motion.div
              key={ft.id}
              className="absolute whitespace-nowrap select-none"
              style={{
                left: `${ft.x}%`,
                bottom: 0,
                fontFamily: "'Dancing Script', cursive",
                fontSize: `clamp(0.9rem, ${ft.size * 1.6}vw, ${ft.size * 2}rem)`,
                color: ft.color,
                textShadow: `0 1px 6px ${ft.color}88, 0 0 18px ${ft.color}44`,
                zIndex: 15,
                fontWeight: 700,
              }}
              initial={{ y: "15vh", opacity: 0 }}
              animate={{ y: "-125vh", opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                y: { duration: ft.duration, ease: "linear" },
                opacity: { duration: ft.duration, times: [0, 0.07, 0.9, 1] },
              }}
            >
              {ft.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "messages" && (
          <motion.div
            className="relative z-20 text-center mt-4 px-6 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 28, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.1, duration: 1.1, ease: "easeOut" }}
          >
            <motion.div
              className="rounded-3xl px-8 py-4"
              style={{
                background: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(12px)",
                border: "2px solid #ffb3c6aa",
                boxShadow: "0 4px 30px #ffb3c655",
              }}
            >
              <motion.p
                style={{
                  fontFamily: "'Great Vibes', cursive",
                  color: "#c4497a",
                  fontSize: "clamp(1.7rem, 5vw, 3.2rem)",
                  textShadow: "0 2px 10px #ffb3c688",
                }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                🩷 Anh Yêu Em 🩷
              </motion.p>
            </motion.div>

            <motion.button
              onClick={reset}
              className="px-8 py-2.5 rounded-full"
              style={{
                fontFamily: "'Dancing Script', cursive",
                color: "#c4497a",
                background: "rgba(255,255,255,0.75)",
                border: "2px solid #ffb3c6",
                cursor: "pointer",
                fontSize: "1.05rem",
                boxShadow: "0 2px 12px #ffb3c655",
              }}
              whileHover={{ scale: 1.06, background: "rgba(255,255,255,0.95)" }}
              whileTap={{ scale: 0.95 }}
            >
              ✨ Xem lại lần nữa
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}