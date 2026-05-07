import React, { useState } from 'react';
import { useBankroll } from '../../context/BankrollContext';
import { Card } from '../ui/Card';
import { Palette, AlertTriangle, Flame, Info } from 'lucide-react';
import { formatBrlFromUsd, formatUsd } from '../../lib/currency';

export const ColorMode: React.FC = () => {
  const { currentBalance, addTransaction, usdToBrlRate } = useBankroll();
  const [baseAmount, setBaseAmount] = useState(10);
  const [payout, setPayout] = useState(84);
  
  const [martingaleLevel, setMartingaleLevel] = useState(0);
  const [history, setHistory] = useState<('green'|'red')[]>([]);

  const currentEntry = baseAmount * Math.pow(2, martingaleLevel);
  const potentialProfit = (currentEntry * payout) / 100;

  const handleOp = (result: 'WIN' | 'LOSS', color: 'Verde' | 'Vermelho') => {
      if (result === 'WIN') {
          addTransaction('WIN', potentialProfit, 'MODO_CORES', `Sequência ${color} (Nível ${martingaleLevel})`);
          setMartingaleLevel(0);
          setHistory(prev => (['green', ...prev] as ('green'|'red')[]).slice(0, 12));
      } else {
          addTransaction('LOSS', currentEntry, 'MODO_CORES', `Sequência ${color} (Nível ${martingaleLevel})`);
          setMartingaleLevel(prev => prev + 1);
          setHistory(prev => (['red', ...prev] as ('green'|'red')[]).slice(0, 12));
      }
  };

  const handlePayoutChange = (val: string) => {
    let num = Number(val);
    if (num > 100) num = 100;
    setPayout(num);
  };

  const formatCurrency = formatUsd;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl text-white shadow-[0_0_20px_rgba(236,72,153,0.3)]">
          <Palette size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Modo Cores</h2>
          <p className="text-sm font-medium text-pink-500">Sistema Martingale Visual</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
            <label className="text-xs font-bold text-gray-500 uppercase">Entrada Base</label>
            <div className="flex items-center mt-1">
                <span className="text-gray-400 mr-2 text-lg font-bold">$</span>
                <input 
                    type="number" 
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(Number(e.target.value))}
                    onInput={(e) => { if(e.currentTarget.value.length > 7) e.currentTarget.value = e.currentTarget.value.slice(0, 7) }}
                    className="w-full font-bold text-2xl bg-transparent border-b border-gray-700 focus:border-pink-500 outline-none transition-colors"
                />
            </div>
        </Card>
        <Card>
            <label className="text-xs font-bold text-gray-500 uppercase">Payout %</label>
            <div className="flex items-center mt-1">
                <input 
                    type="number" 
                    value={payout}
                    onChange={(e) => handlePayoutChange(e.target.value)}
                    onInput={(e) => { if(e.currentTarget.value.length > 3) e.currentTarget.value = e.currentTarget.value.slice(0, 3) }}
                    max="100"
                    className="w-full font-bold text-2xl bg-transparent border-b border-gray-700 focus:border-pink-500 outline-none transition-colors"
                />
                <span className="text-gray-400 ml-2 text-lg font-bold">%</span>
            </div>
        </Card>
      </div>

      <div className="bg-dark-900 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden border border-white/5">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/50 via-dark-950 to-dark-950"></div>
         
         {martingaleLevel > 0 && (
             <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-bl-xl animate-pulse shadow-lg shadow-red-900/50 z-10 flex items-center gap-2">
                 <Flame size={12} /> Recuperação: {martingaleLevel + 1}ª Mão
             </div>
         )}
         
         <div className="relative z-10">
            <span className="text-gray-500 text-xs uppercase font-bold tracking-[0.3em]">Valor da Operação</span>
            <div className={`text-6xl font-black my-4 tracking-tighter drop-shadow-2xl ${martingaleLevel > 0 ? 'text-red-500' : 'text-white'}`}>
                {formatCurrency(currentEntry)}
            </div>
            <div className="text-base font-semibold text-pink-300 -mt-2 mb-2">
                {formatBrlFromUsd(currentEntry, usdToBrlRate)}
            </div>
            <div className="text-xs text-gray-500 font-medium">
                {martingaleLevel === 0 ? 'Entrada padrão segura' : `Valor multiplicado (${Math.pow(2, martingaleLevel)}x) para recuperar perdas.`}
            </div>
         </div>
      </div>

      {/* Botões Visuais Glossy */}
      <div className="grid grid-cols-2 gap-6 h-48">
        <button 
            onClick={() => handleOp('WIN', 'Verde')}
            className="group relative bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 active:scale-95 text-white rounded-3xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center transition-all duration-300 border-t border-white/20"
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-3xl pointer-events-none"></div>
            <span className="text-5xl font-black drop-shadow-md mb-2">WIN</span>
            <span className="text-emerald-100 font-bold uppercase tracking-widest text-xs bg-black/20 px-3 py-1 rounded-full">Verde</span>
        </button>
        
        <button 
            onClick={() => handleOp('LOSS', 'Vermelho')}
            className="group relative bg-gradient-to-b from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 active:scale-95 text-white rounded-3xl shadow-[0_10px_30px_rgba(225,29,72,0.3)] flex flex-col items-center justify-center transition-all duration-300 border-t border-white/20"
        >
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-3xl pointer-events-none"></div>
            <span className="text-5xl font-black drop-shadow-md mb-2">LOSS</span>
            <span className="text-rose-100 font-bold uppercase tracking-widest text-xs bg-black/20 px-3 py-1 rounded-full">Vermelho</span>
        </button>
      </div>

      {/* History Strip */}
      <div className="flex gap-3 justify-center py-4 bg-dark-900/50 rounded-2xl border border-white/5">
        {history.length === 0 && <span className="text-xs text-gray-600 uppercase font-bold">Sem histórico recente</span>}
        {history.map((h, i) => (
            <div key={i} className={`w-4 h-4 rounded-full ${h === 'green' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'} ring-2 ring-dark-900`}></div>
        ))}
      </div>

      {/* Guia de Uso */}
      <div className="bg-dark-900/50 rounded-xl p-6 border border-white/5 mt-6 border-l-4 border-l-pink-500">
         <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-pink-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Como funciona o Modo Cores?</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-400 leading-relaxed">
            <div>
                <strong className="text-gray-200 block mb-1">Sistema Martingale (Gale)</strong>
                Este modo automatiza o cálculo de recuperação. Quando você sofre um LOSS, o sistema automaticamente <strong>multiplica a próxima entrada por 2</strong> (2x, 4x, 8x...). O objetivo é que, ao vencer, você recupere todas as perdas anteriores e ainda tenha um pequeno lucro.
            </div>
            <div>
                <strong className="text-red-400 block mb-1 flex items-center gap-1"><AlertTriangle size={10}/> Risco Elevado</strong>
                <p>O valor da entrada cresce exponencialmente. Esteja ciente do limite da sua banca. Uma sequência longa de perdas pode zerar seu capital rapidamente. Use com moderação.</p>
            </div>
         </div>
      </div>
    </div>
  );
};
