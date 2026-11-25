import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const isSwahili = language === 'sw';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={isSwahili ? 'Badilisha hadi Kiingereza (Switch to English)' : 'Badili kwenda Kiswahili (Switch to Kiswahili)'}
      aria-label="Switch Language / Badili Lugha"
      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
    >
      <Languages className="h-4 w-4 text-emerald-400" />
      <span className="font-mono text-[10px] font-bold tracking-wider">
        {isSwahili ? '🇰🇪 SWA' : '🇺🇸 ENG'}
      </span>
    </button>
  );
}
