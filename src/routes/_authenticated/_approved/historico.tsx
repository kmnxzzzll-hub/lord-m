import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { History } from "lucide-react";
import { Ball } from "@/components/bacbo/Ball";
import { useRobot } from "@/lib/robot-context";

export const Route = createFileRoute("/_authenticated/_approved/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — Bac Bo Live" },
      { name: "description", content: "As cores dos últimos sinais gerados pelo robô Bac Bo Live nesta sessão." },
      { property: "og:title", content: "Histórico — Bac Bo Live" },
      { property: "og:description", content: "Últimos sinais gerados nesta sessão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { sessionSignals } = useRobot();

  return (
    <div>
      <header className="flex items-center gap-3 pb-5 pt-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/70">
          <History className="h-5 w-5 text-player-glow" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="text-xs text-muted-foreground">Sinais desta sessão · {sessionSignals.length}</p>
        </div>
      </header>

      {sessionSignals.length === 0 ? (
        <div className="glass rounded-[1.75rem] p-8 text-center">
          <p className="font-display text-lg font-bold">Nenhum sinal nesta sessão</p>
          <p className="mt-1 text-sm text-muted-foreground">As cores aparecem aqui assim que o robô gerar os sinais.</p>
        </div>
      ) : (
        <div className="glass rounded-[1.75rem] p-5">
          <ul className="grid grid-cols-6 gap-3">
            {sessionSignals.map((s, i) => (
              <motion.li
                key={s.key}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.025, 0.6), type: "spring", stiffness: 260, damping: 18 }}
                className="flex justify-center"
              >
                <Ball kind={s.side} label={s.side === "player" ? "J" : "C"} size={40} />
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
