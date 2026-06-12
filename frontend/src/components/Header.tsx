import { useState, useEffect } from "react";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const p2 = (n: number) => String(n).padStart(2, "0");

export function Header() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const clock = `${now.getFullYear()}.${p2(now.getMonth() + 1)}.${p2(now.getDate())} (${DAYS[now.getDay()]}) ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;

  return (
    <header className="flex items-center gap-4 px-6 py-3 bg-navy-900 border-b border-navy-700">
      <div className="flex items-center gap-3">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="15" stroke="#00d4ff" strokeWidth="1.5" />
          <path d="M16 4 L20 16 L16 28 L12 16 Z" fill="#00d4ff" opacity="0.8" />
          <circle cx="16" cy="16" r="3" fill="#00d4ff" />
          <path d="M4 16 H28" stroke="#00d4ff" strokeWidth="0.8" opacity="0.4" />
        </svg>
        <div>
          <h1 className="text-lg font-bold tracking-widest text-white leading-none">
            DRIFT
          </h1>
          <p className="text-[10px] text-slate-400 tracking-wide leading-none mt-0.5">
            해양 수색구조 의사결정 지원 시스템
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          시스템 정상
        </span>
        <span className="text-slate-600">|</span>
        <span className="font-mono tabular-nums">{clock}</span>
        <span className="text-slate-600">|</span>
        <span className="bg-navy-800 border border-navy-600 rounded px-2 py-0.5 text-cyan-400">
          MVP v0.1
        </span>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-lg px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="leading-none">
            <p className="text-[10px] text-slate-500 mb-0.5">KCG 상황실</p>
            <p className="text-xs text-slate-300 font-medium">운영자</p>
          </div>
        </div>
      </div>
    </header>
  );
}
