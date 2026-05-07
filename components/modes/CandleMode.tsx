import React, { useState } from 'react';
import { useBankroll } from '../../context/BankrollContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CandlestickChart, TrendingUp, TrendingDown, RefreshCcw, Info } from 'lucide-react';
import { formatBrlFromUsd, formatUsd } from '../../lib/currency';

export const CandleMode: React.FC = () => {
  const { currentBalance, riskPercentage, addTransaction, usdToBrlRate } = useBankroll();
  const [payout, setPayout] = useState(84);
  const [multiplier, setMultiplier] = useState(1.0);

  const baseEntry = (currentBalance * riskPercentage) / 100;
  const currentEntry = baseEntry * multiplier;
  const potentialProfit = (currentEntry * payout) / 100;

  const handleWin = () => {
    addTransaction('WIN', potentialProfit, 'MODO_VELAS', `Adaptativo (x${multiplier.toFixed(1)})`);
    // WIN -> Aumenta levemente para aproveitar a tendência (Soros suave)
    setMultiplier(prev => Math.min(prev * 1.2, 5.0)); 
  };

  const handleLoss = () => {
    addTransaction('LOSS', currentEntry, 'MODO_VELAS', `Adaptativo (x${multiplier.toFixed(1)})`);
    // LOSS -> Diminui para proteger capital
    setMultiplier(prev => Math.max(prev * 0.8, 0.5)); 
  };

  const resetAdaptive = () => {
      setMultiplier(1.0);
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
        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white shadow-glow">
          <CandlestickChart size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Modo Velas</h2>
          <p className="text-sm font-medium text-purple-400">Gestão Inteligente Adaptativa</p>
        </div>
      </div>

      {/* Settings */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
         <Card className="flex-1 flex items-center justify-between border-purple-500/20 bg-purple-500/5">
             <div>
                <span className="text-xs font-bold uppercase text-purple-400 tracking-wider">Fator de Aceleração</span>
                <div className="text-3xl font-black text-white mt-1">x{multiplier.toFixed(2)}</div>
             </div>
             <Button variant="ghost" size="sm" onClick={resetAdaptive} className="text-purple-300 hover:text-white hover:bg-purple-500/20">
                <RefreshCcw size={16} className="mr-2" /> Reiniciar Fator
             </Button>
         </Card>
         <Card className="w-full md:w-1/3">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payout %</label>
            <div className="flex items-center mt-1">
                <input 
                    type="number" 
                    value={payout}
                    onChange={(e) => handlePayoutChange(e.target.value)}
                    onInput={(e) => { if(e.currentTarget.value.length > 3) e.currentTarget.value = e.currentTarget.value.slice(0, 3) }}
                    max="100"
                    className="w-full bg-transparent text-3xl font-bold text-white border-b border-gray-700 focus:border-purple-500 outline-none transition-colors" 
                />
            </div>
         </Card>
      </div>

      {/* Main Display */}
      <div className="bg-dark-900 rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden border-t-4 border-t-purple-500 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none"></div>
        
        <span className="text-purple-400 uppercase tracking-[0.3em] text-xs font-bold mb-4 relative z-10">Próxima Entrada</span>
        <div className="text-7xl font-black text-white tracking-tighter relative z-10 drop-shadow-xl">
            {formatCurrency(currentEntry)}
        </div>
        <div className="text-lg font-semibold text-purple-300 relative z-10 mt-1">
            {formatBrlFromUsd(currentEntry, usdToBrlRate)}
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-3 relative z-10">
            {multiplier > 1.0 && (
                <div className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-emerald-500/20">
                    <TrendingUp size={14}/> Mercado Favorável
                </div>
            )}
            {multiplier < 1.0 && (
                <div className="bg-orange-500/10 text-orange-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-orange-500/20">
                    <TrendingDown size={14}/> Modo Defensivo
                </div>
            )}
            {multiplier === 1.0 && (
                <div className="bg-gray-800 text-gray-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/5">
                    Neutro
                </div>
            )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-6">
        <Button 
            variant="success" 
            size="lg" 
            onClick={handleWin} 
            className="h-24 text-xl flex-col border-none shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
        >
          <TrendingUp size={28} className="mb-1" />
          <span className="font-black tracking-widest">WIN</span>
        </Button>
        <Button 
            variant="danger" 
            size="lg" 
            onClick={handleLoss} 
            className="h-24 text-xl flex-col border-none shadow-[0_10px_30px_rgba(239,68,68,0.2)]"
        >
           <TrendingDown size={28} className="mb-1" />
           <span className="font-black tracking-widest">LOSS</span>
        </Button>
      </div>

       {/* Guia de Uso Padronizado */}
       <div className="bg-dark-900/50 rounded-xl p-6 border border-white/5 mt-6 border-l-4 border-l-purple-500">
         <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-purple-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Como funciona o Modo Velas?</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-400 leading-relaxed">
            <div>
                <strong className="text-gray-200 block mb-1">Gestão Inteligente (Soros/Inverso)</strong>
                Diferente do Martingale, este modo não tenta recuperar tudo de uma vez. Ele "surfa" a tendência. Se você ganha, ele aumenta levemente a mão (+20%) para aproveitar a boa fase. Se perde, ele reduz a mão (-20%) para proteger o capital.
            </div>
            <div>
                <strong className="text-gray-200 block mb-1">Fator Multiplicador</strong>
                O sistema mantém um "Fator Atual" (ex: x1.2). 
                <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li><span className="text-emerald-400">WIN:</span> Aumenta a agressividade (lucro potencial maior).</li>
                    <li><span className="text-red-400">LOSS:</span> Aumenta a defesa (reduz valor para proteger banca).</li>
                </ul>
                Ideal para quem busca consistência a longo prazo.
            </div>
         </div>
      </div>
    </div>
  );
};
