import { Flame } from "lucide-react";

interface StreakBadgeProps {
  days: number;
}

const StreakBadge = ({ days }: StreakBadgeProps) => (
  <div className="flex items-center gap-1.5 bg-[hsl(var(--dark-card))] rounded-full px-3 py-1.5">
    <Flame className="w-4 h-4 text-streak" />
    <span className="text-sm font-bold text-streak">{days}</span>
  </div>
);

export default StreakBadge;
