import { motion } from "framer-motion";
import type { Side } from "@/lib/bacbo-engine";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export function SignalOrb({ side, phaseStart, phaseEnd }: { side: Side; phaseStart: number; phaseEnd: number }) {
  const now = useNow(250);
  const isPlayer = side === "player";
  const left = Math.max(0, Math.min(1, (phaseEnd - now) / (phaseEnd - phaseStart)));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 180, damping: 20 }}
      className="glass flex flex-col items-center rounded-[1.75rem] px-6 py-9"
    >
      <div className="relative flex h-48 w-48 items-center justify-center">
        <motion.span
          className={cn("absolute inset-2 rounded-full blur-2xl", isPlayer ? "bg-player/60" : "bg-banker/60")}
          animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className={cn("absolute inset-0 rounded-full border", isPlayer ? "border-player-glow/40" : "border-banker-glow/40")}
          animate={{ scale: [1, 1.18], opacity: [0.7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          initial={{ scale: 0.2, rotate: -40 }}
          animate={{ scale: 1, rotate: 0, y: [0, -6, 0] }}
          transition={{ scale: { type: "spring", stiffness: 200, damping: 14 }, rotate: { duration: 0.6 }, y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
          className={cn("relative h-40 w-40 rounded-full", isPlayer ? "ball-player" : "ball-banker")}
        >
          <span className="absolute left-[20%] top-[12%] h-[24%] w-[38%] rounded-full bg-foreground/45 blur-[3px]" />
          <span className="absolute bottom-[14%] right-[22%] h-[10%] w-[18%] rounded-full bg-foreground/15 blur-[2px]" />
        </motion.div>
      </div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn("mt-6 font-display text-4xl font-extrabold tracking-[0.12em]", isPlayer ? "text-player-glow" : "text-banker-glow")}
      >
        {isPlayer ? "JOGADOR" : "CASA"}
      </motion.h2>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-linear", isPlayer ? "bg-player-glow" : "bg-banker-glow")}
          style={{ width: `${left * 100}%` }}
        />
      </div>
    </motion.div>
  );
}
