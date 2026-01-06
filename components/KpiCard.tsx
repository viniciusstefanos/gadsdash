
import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string | number;
  percentage?: number;
  suffix?: string;
  prefix?: string;
  accentColor?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, percentage, prefix = '', suffix = '', accentColor = '#2563eb' }) => {
  const isPositive = percentage && percentage > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-[48px] flex flex-col justify-between hover:border-zinc-600 transition-all group overflow-hidden relative min-h-[220px]">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
        <div className="w-24 h-24 rounded-full blur-3xl" style={{ backgroundColor: accentColor }} />
      </div>
      
      <div>
        <p className="text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase">{label}</p>
        <h3 className="text-5xl font-black mt-4 text-white italic tracking-tighter">
          {prefix}{value}{suffix}
        </h3>
      </div>

      {percentage !== undefined && (
        <div className="mt-8 flex items-center space-x-3">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(percentage).toFixed(1)}%
          </div>
          <span className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest">vs ciclo anterior</span>
        </div>
      )}
    </div>
  );
};

export default KpiCard;
