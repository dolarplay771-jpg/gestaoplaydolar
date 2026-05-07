import React, { useState } from 'react';
import { useBankroll } from '../../context/BankrollContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Target, RotateCcw, CheckCircle, Info } from 'lucide-react';
import { formatBrlFromUsd, formatUsd } from '../../lib/currency';

export const DollarMode: React.FC = () => {
  const { addTransaction, usdToBrlRate } = useBankroll();
  
  const [target, setTarget] = useState(10); // Meta de lucro por ciclo
  const [payout, setPayout] = useState(84);
  const [cycleProfit, setCycleProfit] = useState(0);
  
  // Lógica: Entrada necessária para atingir a meta restante do ciclo
  // Se perder, o cycleProfit fica negativo, aumentando a meta restante.
  const remainingTarget = target - cycleProfit;
  
  // Cálculo: Para ganhar X (remainingTarget) com Payout Y:
  // Lucro = Entrada * (Payout/100)
  // Entrada = Lucro / (Payout/100)
  const suggestedEntry = remainingTarget > 0 ? (remainingTarget / (payout / 100)) : 0;
  
  // Lucro real desta operação se der win
  const potentialProfit = (suggestedEntry * payout) / 100;

  const handleWin = () => {
    // Adiciona transação e atualiza lucro do ciclo
    addTransaction('WIN', potentialProfit, 'MODO_DOLAR', `Ciclo: Busca $${target}`);
    setCycleProfit(prev => prev + potentialProfit);
  };

  const handleLoss = () => {
    addTransaction('LOSS', suggestedEntry, 'MODO_DOLAR', 'Ciclo Loss (Recalculando)');
    // Subtrai o valor perdido do lucro do ciclo (ficando negativo ou diminuindo o lucro)
    setCycleProfit(prev => prev - suggestedEntry);
  };

  const resetCycle = () => {
    setCycleProfit(0);
  };

  const isTargetMet = cycleProfit >= target - 0.05; // Margem de erro pequena para arredondamento

  const handlePayoutChange = (val: string) => {
    let num = Number(val);
    if (num > 100) num = 100;
    setPayout(num);
  };

  const formatCurrency = formatUsd;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl text-black shadow-glow">
          <Target size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Modo Dólar Game</h2>
          <p className="text-sm font-medium text-amber-500">Metas Cíclicas</p>
        </div>
      </div>

      {/* Inputs de Configuração */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <label className="text-xs font-bold text-amber-500 uppercase tracking-wide">Meta do Ciclo ($)</label>
          <div className="flex items-center mt-2">
             <span className="text-xl text-amber-500 mr-2 font-bold">$</span>
             <input 
                type="number" 
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                onInput={(e) => { if(e.currentTarget.value.length > 7) e.currentTarget.value = e.currentTarget.value.slice(0, 7) }}
                className="w-full text-3xl font-bold bg-transparent border-b border-amber-500/50 text-white outline-none py-1 focus:border-amber-400 transition-colors"
              />
          </div>
        </Card>
        <Card>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payout (%)</label>
           <div className="flex items-center mt-2">
             <input 
                type="number" 
                value={payout}
                onChange={(e) => handlePayoutChange(e.target.value)}
                onInput={(e) => { if(e.currentTarget.value.length > 3) e.currentTarget.value = e.currentTarget.value.slice(0, 3) }}
                max="100"
                className="w-full text-3xl font-bold bg-transparent border-b border-gray-700 text-white outline-none py-1 focus:border-amber-500 transition-colors"
              />
             <span className="text-xl text-gray-500 ml-2 font-bold">%</span>
          </div>
        </Card>
      </div>

      {/* Display Principal */}
      <div className="bg-dark-900 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden border border-white/5 group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-dark-950 to-dark-950"></div>
        
        {isTargetMet ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 backdrop-blur-md animate-fade-in">
                <div className="bg-green-500/20 p-4 rounded-full mb-4 ring-1 ring-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                    <CheckCircle size={48} className="text-green-500" />
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter mb-1">META ATINGIDA!</h3>
                <p className="text-gray-400 mb-1 font-mono text-sm">Lucro do ciclo: <span className="text-green-400">{formatCurrency(cycleProfit)}</span></p>
                <p className="text-green-300 mb-6 font-mono text-xs">{formatBrlFromUsd(cycleProfit, usdToBrlRate)}</p>
                <Button variant="outline" onClick={resetCycle} className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500">
                    <RotateCcw size={18} /> Iniciar Novo Ciclo
                </Button>
             </div>
        ) : null}

        <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    Progresso: <span className="text-white">{formatCurrency(cycleProfit)}</span> / {formatCurrency(target)}
                </div>
                {!isTargetMet && remainingTarget > target && (
                    <div className="text-[10px] text-amber-500 font-bold uppercase tracking-widest animate-pulse">
                        Modo Recuperação
                    </div>
                )}
            </div>
            
            <span className="text-amber-500/80 uppercase text-xs font-bold tracking-[0.3em]">Entrada Necessária</span>
            <div className="text-7xl font-black mt-4 text-white tracking-tighter drop-shadow-2xl">
            {formatCurrency(suggestedEntry > 0 ? suggestedEntry : 0)}
            </div>
            <div className="text-lg font-semibold text-amber-300 mt-1">
              {formatBrlFromUsd(suggestedEntry > 0 ? suggestedEntry : 0, usdToBrlRate)}
            </div>
            <div className="text-xs text-gray-600 mt-4 font-medium max-w-xs mx-auto">
                Se der LOSS, o sistema recalculará a próxima entrada para buscar os mesmos {formatCurrency(target)} de lucro.
            </div>
        </div>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-6">
        <Button 
            variant="success" 
            size="lg" 
            onClick={handleWin} 
            disabled={isTargetMet}
            className="h-24 text-2xl font-black tracking-widest border-none relative overflow-hidden shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/20 to-transparent pointer-events-none"></div>
          WIN
        </Button>
        <Button 
            variant="danger" 
            size="lg" 
            onClick={handleLoss}
            disabled={isTargetMet} 
            className="h-24 text-2xl font-black tracking-widest border-none relative overflow-hidden shadow-[0_10px_30px_rgba(239,68,68,0.2)]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-red-600/20 to-transparent pointer-events-none"></div>
          LOSS
        </Button>
      </div>

       {/* Guia de Uso Padronizado */}
       <div className="bg-dark-900/50 rounded-xl p-6 border border-white/5 mt-6 border-l-4 border-l-amber-500">
         <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-amber-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Como funciona o Dólar Game?</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-400 leading-relaxed">
            <div>
                <strong className="text-gray-200 block mb-1">Meta Fixa por Ciclo</strong>
                Neste modo, o foco não é o valor da entrada, mas sim a meta de lucro (ex: $10). O sistema calcula automaticamente quanto você precisa operar para atingir essa meta, considerando o Payout da corretora.
            </div>
            <div>
                <strong className="text-gray-200 block mb-1">Recuperação Automática</strong>
                Se você perder (LOSS), o valor perdido é somado à meta do ciclo. A próxima entrada será calculada para recuperar o prejuízo anterior E ainda atingir a meta original de lucro. Cuidado: em sequências ruins, o valor da entrada sobe rápido.
            </div>
         </div>
      </div>
    </div>
  );
};
