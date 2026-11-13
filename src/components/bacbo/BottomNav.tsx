import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, History, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/robos", label: "Robôs", icon: Bot },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/perfil", label: "Perfil", icon: UserRound },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-md px-4 pb-safe">
        <div className="glass flex items-center justify-around rounded-[1.6rem] bg-background/70 px-2 py-2">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link key={to} to={to} className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-2xl bg-foreground/[0.07] ring-1 ring-foreground/10"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon className={cn("relative h-5 w-5 transition-colors", active ? "text-foreground" : "text-muted-foreground")} />
                <span className={cn("relative text-[11px] font-semibold transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
