import type { AppTab } from "@/store/incidentStore";

interface Tab {
  id: AppTab;
  label: string;
  sublabel: string;
  icon: string;
}

const TABS: Tab[] = [
  {
    id: "incident",
    label: "실시간 조난 대응",
    sublabel: "Incident Response",
    icon: "🚨",
  },
  {
    id: "briefing",
    label: "AI 작전 브리핑",
    sublabel: "Operational Briefing",
    icon: "📋",
  },
  {
    id: "risk",
    label: "선제 위험 예측",
    sublabel: "Proactive Risk",
    icon: "⚠️",
  },
];

interface TabBarProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="flex border-b border-navy-700 bg-navy-900">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              "relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors",
              "hover:text-cyan-300 focus:outline-none",
              isActive
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-navy-800"
                : "text-slate-400 border-b-2 border-transparent",
            ].join(" ")}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="flex flex-col items-start">
              <span className="leading-tight">{tab.label}</span>
              <span className="text-[10px] opacity-60 leading-tight">{tab.sublabel}</span>
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400/0 via-cyan-400 to-cyan-400/0" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
