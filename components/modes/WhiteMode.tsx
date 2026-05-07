import React, { useState } from 'react';
import { useBankroll } from '../../context/BankrollContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ShieldCheck, TrendingUp, TrendingDown, CheckCircle, Info } from 'lucide-react';
import { formatBrlFromUsd, formatUsd } from '../../lib/currency';

export const WhiteMode: React.FC = () => {
  const { currentBalance, riskPercentage, addTransaction, usdToBrlRate } = useBankroll();
  const [payout, setPayout] = useState(84);
  
  const entryAmount = (currentBalance * riskPercentage) / 100;
  const potentialProfit = (entryAmount * payout) / 100;

  const handleWin = () => {
    addTransaction('WIN', potentialProfit, 'MODO_BRANCO', `Win @ ${payout}%`);
  };

  const handleLoss = () => {
    addTransaction('LOSS', entryAmount, 'MODO_BRANCO', `Loss -${riskPercentage}%`);
  };

  const handlePayoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = Number(e.target.value);
      if (val > 100) val = 100; // Limita a 100%
      setPayout(val);
  };

  const formatCurrency = formatUsd;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl text-black shadow-glow">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Modo Branco</h2>
          <p className="text-sm font-medium text-gold-400">Estratégia Conservadora</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lógica da Entrada */}
        <Card className="flex flex-col justify-center items-center text-center py-10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-gold-500/5 to-transparent pointer-events-none"></div>
          
          <span className="text-xs text-gold-500 uppercase tracking-[0.2em] font-bold mb-2">Entrada Sugerida</span>
          <span className="text-6xl font-black text-white drop-shadow-lg tracking-tighter group-hover:scale-105 transition-transform duration-300">
            {formatCurrency(entryAmount)}
          </span>
          <span className="text-base font-bold text-gold-300 mt-1">
            {formatBrlFromUsd(entryAmount, usdToBrlRate)}
          </span>
          <div className="text-[10px] text-gray-500 font-medium bg-white/5 px-3 py-1 rounded-full mt-4 border border-white/5">
            Baseado no risco de {riskPercentage}%
          </div>
        </Card>

        {/* Configurações e Previsão */}
        <Card className="flex flex-col justify-center space-y-6">
           <div>
            <label className="text-xs text-gold-500 font-bold uppercase tracking-wide">Payout da Corretora</label>
            <div className="flex items-center border-b border-gray-700 focus-within:border-gold-500 transition-colors mt-2">
                <input 
                  type="number" 
                  value={payout}
                  onChange={handlePayoutChange}
                  onInput={(e) => { if(e.currentTarget.value.length > 3) e.currentTarget.value = e.currentTarget.value.slice(0, 3) }}
                  max="100"
                  min="1"
                  className="w-full text-4xl font-bold bg-transparent text-white outline-none py-2 placeholder-gray-700"
                />
                <span className="text-2xl text-gray-500 font-bold">%</span>
            </div>
           </div>
           
           <div className="flex justify-between items-center bg-dark-950/50 p-4 rounded-xl border border-white/5 shadow-inner">
             <span className="text-sm text-gray-400 font-bold uppercase">Lucro Potencial</span>
             <div className="text-right">
              <div className="text-emerald-400 font-black text-2xl drop-shadow-sm">+{formatCurrency(potentialProfit)}</div>
              <div className="text-emerald-300 text-sm font-semibold">+{formatBrlFromUsd(potentialProfit, usdToBrlRate)}</div>
             </div>
           </div>
        </Card>
      </div>

      {/* Botões de Ação */}
      <div className="grid grid-cols-2 gap-6 mt-4">
        <Button 
          variant="success" 
          size="lg" 
          onClick={handleWin} 
          className="h-28 text-2xl relative overflow-hidden group border-none"
        >
          <div className="absolute inset-0 bg-emerald-400/10 group-hover:bg-emerald-400/20 transition-colors"></div>
          <div className="flex flex-col items-center z-10">
             <TrendingUp size={32} className="mb-2 group-hover:scale-110 transition-transform" />
             <span className="font-black tracking-widest">WIN</span>
          </div>
        </Button>
        
        <Button 
          variant="danger" 
          size="lg" 
          onClick={handleLoss} 
          className="h-28 text-2xl relative overflow-hidden group border-none"
        >
          <div className="absolute inset-0 bg-red-400/10 group-hover:bg-red-400/20 transition-colors"></div>
          <div className="flex flex-col items-center z-10">
             <TrendingDown size={32} className="mb-2 group-hover:scale-110 transition-transform" />
             <span className="font-black tracking-widest">LOSS</span>
          </div>
        </Button>
      </div>
      
      {/* Guia de Uso */}
      <div className="bg-dark-900/50 rounded-xl p-6 border border-white/5 mt-6">
         <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-gold-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Como funciona o Modo Branco?</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-400 leading-relaxed">
            <div>
                <strong className="text-gray-200 block mb-1">Estratégia Conservadora</strong>
                Este é o modo mais seguro de gerenciamento. Ele não utiliza Martingale (dobrar a entrada). A entrada é sempre calculada como uma porcentagem fixa (padrão 2%) da sua banca atual. Isso protege seu capital contra grandes sequências de perdas.
            </div>
            <div>
                <strong className="text-gray-200 block mb-1">Regras de Operação</strong>
                <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-emerald-400">WIN:</span> O lucro é somado à banca, aumentando ligeiramente a próxima entrada.</li>
                    <li><span className="text-red-400">LOSS:</span> O prejuízo é descontado, diminuindo a próxima entrada para proteger o que restou.</li>
                </ul>
            </div>
         </div>
      </div>
    </div>
  );
};
