import React from 'react';
import { useBankroll } from '../context/BankrollContext';
import { Card } from './ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';
import { formatBrlFromUsd, formatUsd } from '../lib/currency';

export const Dashboard: React.FC = () => {
  const { currentBalance, initialBalance, transactions, usdToBrlRate } = useBankroll();

  const totalProfit = currentBalance - initialBalance;
  const isProfit = totalProfit >= 0;
  
  // Como o transactions já vem limitado a 50 pelo Context/DB, usamos ele diretamente
  const wins = transactions.filter(t => t.type === 'WIN').length;
  const losses = transactions.filter(t => t.type === 'LOSS').length;
  const totalOps = wins + losses;
  const winRate = totalOps > 0 ? ((wins / totalOps) * 100).toFixed(1) : '0.0';

  // Helper de formatação
  const formatCurrency = formatUsd;

  // Prepare chart data 
  // Transactions are stored Newest -> Oldest in context
  // reverse() puts them in Chronological order (Oldest -> Newest) for the chart
  const chartData = [...transactions].reverse().map((t, index) => ({
    name: index + 1,
    balance: t.balanceAfter,
    timestamp: t.timestamp
  }));
  
  // Ensure we always have a starting point or the current state if empty
  if (chartData.length === 0) {
      chartData.push({ name: 0, balance: initialBalance, timestamp: Date.now() });
  } else {
       // Se tiver transações, adicionamos o estado inicial apenas se a lista for pequena
       // Se tiver 50 (o limite), o gráfico mostra a evolução recente, sem "saltar" do zero
       if (transactions.length < 50) {
           chartData.unshift({ name: 0, balance: initialBalance, timestamp: Date.now() });
       }
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Balance Card - Gold Gradient */}
        <div className="bg-gold-gradient rounded-2xl p-6 shadow-glow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
          
          <div className="flex items-center gap-2 opacity-80 mb-2 text-dark-950 font-bold uppercase tracking-wider text-xs">
            <DollarSign size={16} />
            <span>Banca Atual</span>
          </div>
          <div className="text-4xl font-black tracking-tighter text-dark-950 drop-shadow-sm">
            {formatCurrency(currentBalance)}
          </div>
          <div className="text-sm font-bold text-dark-900/80">
            {formatBrlFromUsd(currentBalance, usdToBrlRate)}
          </div>
          <div className="mt-4 flex items-center gap-2 text-dark-900/60 text-xs font-bold">
            <div className="w-2 h-2 bg-dark-950 rounded-full animate-pulse"></div>
            Atualizado em tempo real
          </div>
        </div>

        <Card>
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Activity size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Lucro Total</span>
          </div>
          <div className={`text-3xl font-bold tracking-tight ${isProfit ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{formatCurrency(Math.abs(totalProfit)).replace('$', '$')}
          </div>
          <div className={`text-sm font-semibold ${isProfit ? 'text-emerald-300' : 'text-red-300'}`}>
            {isProfit ? '+' : ''}{formatBrlFromUsd(Math.abs(totalProfit), usdToBrlRate)}
          </div>
          <div className="text-xs text-gray-500 mt-2 font-medium">
             {initialBalance > 0 ? ((totalProfit / initialBalance) * 100).toFixed(2) : '0.00'}% de retorno sobre o inicial
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrendingUp size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Win Rate (Últimas 50)</span>
          </div>
          <div className="text-3xl font-bold text-gold-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]">
            {winRate}%
          </div>
          <div className="flex gap-3 text-xs mt-2 font-medium">
            <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {wins} Wins</span>
            <span className="text-red-500 bg-red-500/10 px-2 py-0.5 rounded flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> {losses} Losses</span>
          </div>
        </Card>
      </div>

      <Card className="h-80 p-6 border-white/5">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1 h-4 bg-gold-500 rounded-full"></div>
                Evolução (Últimas 50 Ops)
            </h3>
        </div>
        
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1C1C1C" opacity={0.6} />
            <XAxis dataKey="name" hide />
            <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={(v) => formatCurrency(Number(v))} 
                stroke="#444" 
                fontSize={10} 
                tickLine={false}
                axisLine={false}
            />
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'rgba(18, 18, 18, 0.9)', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    backdropFilter: 'blur(8px)',
                    color: '#D4AF37',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    borderRadius: '12px'
                }}
                itemStyle={{ color: '#fff', fontWeight: '600' }}
                formatter={(value: number) => [`${formatCurrency(value)} | ${formatBrlFromUsd(value, usdToBrlRate)}`, '']}
                labelFormatter={() => ''}
                cursor={{ stroke: '#333', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#D4AF37" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorBalance)" 
                activeDot={{ r: 6, fill: '#F3E2B5', stroke: '#D4AF37', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      
      <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-xs font-bold text-gold-500 uppercase tracking-widest">Histórico Recente</h3>
             <span className="text-[10px] text-gray-600 uppercase font-bold tracking-wider">Últimas 50 operações</span>
          </div>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {transactions.map(t => (
                <div key={t.id} className="group flex items-center justify-between bg-dark-800/40 p-4 rounded-xl border border-white/5 hover:border-gold-500/20 hover:bg-dark-800/80 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg shadow-inner ${t.type === 'WIN' ? 'bg-emerald-500/10 text-emerald-500' : t.type === 'LOSS' ? 'bg-red-500/10 text-red-500' : 'bg-gray-800 text-gray-400'}`}>
                            {t.type === 'WIN' ? <TrendingUp size={18}/> : t.type === 'LOSS' ? <TrendingDown size={18}/> : <Activity size={18}/>}
                        </div>
                        <div>
                            <div className="font-bold text-sm text-gray-200">{t.mode}</div>
                            <div className="text-xs text-gray-500 font-medium">{t.note || t.type}</div>
                        </div>
                    </div>
                    <div className={`font-mono font-bold text-lg text-right ${t.type === 'WIN' ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]' : t.type === 'LOSS' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.3)]' : 'text-gray-500'}`}>
                        <div>{t.type === 'WIN' ? '+' : t.type === 'LOSS' ? '-' : ''}{formatCurrency(t.amount).replace('$', '')}</div>
                        <div className="text-xs text-gray-400">{t.type === 'WIN' ? '+' : t.type === 'LOSS' ? '-' : ''}{formatBrlFromUsd(t.amount, usdToBrlRate)}</div>
                    </div>
                </div>
            ))}
          </div>
          
          {transactions.length === 0 && (
              <div className="text-center text-gray-600 py-10 text-sm border border-dashed border-gray-800 rounded-xl bg-dark-800/20">
                  Nenhuma operação registrada ainda.
              </div>
          )}
      </div>
    </div>
  );
};
