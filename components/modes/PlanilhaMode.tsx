import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useBankroll } from '../../context/BankrollContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Table, RefreshCcw, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatBrlFromUsd, formatUsd } from '../../lib/currency';

type PlanRow = {
  bank: number;
  dailyGoal: number;
  entryValue: number;
};

type SyncStatus = 'idle' | 'saving' | 'error' | 'offline';

const defaultDailyPercent = 12;
const defaultEntries = 12;
const defaultCycles = 15;

const clampDecimal = (value: unknown, min: number, max: number, fallback: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const normalizeProgress = (raw: unknown, cycles: number, entries: number) => {
  const base = Array.isArray(raw) ? raw : [];
  return Array.from({ length: cycles }, (_, rowIndex) => {
    const row = Array.isArray(base[rowIndex]) ? base[rowIndex] : [];
    return Array.from({ length: entries }, (_, entryIndex) => Boolean(row[entryIndex]));
  });
};

const buildProgress = (rows: number, entries: number) => {
  return Array.from({ length: rows }, () => Array.from({ length: entries }, () => false));
};

const periodLabels = ['Manha', 'Tarde', 'Noite'];

export const PlanilhaMode: React.FC = () => {
  const { currentBalance, session, loading, addTransaction, usdToBrlRate } = useBankroll();
  const bankroll = Math.max(0, currentBalance);
  const [dailyPercent, setDailyPercent] = useState(defaultDailyPercent);
  const [entriesPerDay, setEntriesPerDay] = useState(defaultEntries);
  const [cycles, setCycles] = useState(defaultCycles);
  const [progress, setProgress] = useState<boolean[][]>(() => buildProgress(defaultCycles, defaultEntries));
  const [stateLoaded, setStateLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const errorToastRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    let isActive = true;

    const loadState = async () => {
      if (!session?.user?.id || !isSupabaseConfigured || !supabase) {
        if (isActive) {
          setSyncStatus('offline');
          setStateLoaded(true);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('planilha_state')
          .select('daily_percent, entries_per_day, cycles, progress')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const nextDaily = clampDecimal(data.daily_percent, 0, 100, defaultDailyPercent);
          const nextEntries = clampInt(data.entries_per_day, 1, 30, defaultEntries);
          const nextCycles = clampInt(data.cycles, 1, 60, defaultCycles);

          if (isActive) {
            setDailyPercent(nextDaily);
            setEntriesPerDay(nextEntries);
            setCycles(nextCycles);
            setProgress(normalizeProgress(data.progress, nextCycles, nextEntries));
          }
        }

        if (isActive) {
          setSyncStatus('idle');
          errorToastRef.current = false;
        }
      } catch (err) {
        console.error('Erro ao carregar planilha:', err);
        if (!errorToastRef.current) {
          toast.error('Falha ao carregar a planilha.');
          errorToastRef.current = true;
        }
        if (isActive) setSyncStatus('error');
      } finally {
        if (isActive) setStateLoaded(true);
      }
    };

    loadState();

    return () => {
      isActive = false;
    };
  }, [session?.user?.id, loading]);

  useEffect(() => {
    if (!stateLoaded) return;
    if (!session?.user?.id || !isSupabaseConfigured || !supabase) {
      setSyncStatus('offline');
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSyncStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          user_id: session.user.id,
          daily_percent: dailyPercent,
          entries_per_day: entriesPerDay,
          cycles,
          progress,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('planilha_state')
          .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;
        setSyncStatus('idle');
        errorToastRef.current = false;
      } catch (err) {
        console.error('Erro ao salvar planilha:', err);
        if (!errorToastRef.current) {
          toast.error('Falha ao salvar a planilha.');
          errorToastRef.current = true;
        }
        setSyncStatus('error');
      }
    }, 600);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dailyPercent, entriesPerDay, cycles, progress, session?.user?.id, stateLoaded]);

  useEffect(() => {
    setProgress((prev) => {
      return Array.from({ length: cycles }, (_, rowIndex) => {
        const row = prev[rowIndex] ?? [];
        return Array.from({ length: entriesPerDay }, (_, entryIndex) => row[entryIndex] ?? false);
      });
    });
  }, [cycles, entriesPerDay]);

  const periodCounts = useMemo(() => {
    const base = Math.floor(entriesPerDay / 3);
    const remainder = entriesPerDay % 3;
    return [
      base + (remainder > 0 ? 1 : 0),
      base + (remainder > 1 ? 1 : 0),
      base,
    ];
  }, [entriesPerDay]);

  const periodOffsets = useMemo(() => {
    return [0, periodCounts[0], periodCounts[0] + periodCounts[1]];
  }, [periodCounts]);

  const rows = useMemo(() => {
    const safeCycles = Math.max(1, cycles);
    const safeEntries = Math.max(1, entriesPerDay);
    const percent = Math.max(0, dailyPercent);
    const result: PlanRow[] = [];
    let bank = Math.max(0, bankroll);

    for (let i = 0; i < safeCycles; i += 1) {
      const dailyGoal = (bank * percent) / 100;
      const entryValue = dailyGoal / safeEntries;
      result.push({ bank, dailyGoal, entryValue });
      bank += dailyGoal;
    }

    return result;
  }, [bankroll, dailyPercent, entriesPerDay, cycles]);

  const finalBalance = useMemo(() => {
    if (rows.length === 0) return bankroll;
    const last = rows[rows.length - 1];
    return last.bank + last.dailyGoal;
  }, [rows, bankroll]);

  const formatCurrency = formatUsd;

  const formatPercent = (value: number) => {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  };

  const handlePercentChange = (value: string) => {
    const num = clampDecimal(value, 0, 100, 0);
    setDailyPercent(num);
  };

  const handleEntriesChange = (value: string) => {
    const num = clampInt(value, 1, 30, 1);
    setEntriesPerDay(num);
  };

  const handleCyclesChange = (value: string) => {
    const num = clampInt(value, 1, 60, 1);
    setCycles(num);
  };

  const toggleCell = (
    rowIndex: number,
    entryIndex: number,
    periodLabel: string,
    cellPosition: number
  ) => {
    const alreadyChecked = progress[rowIndex]?.[entryIndex] ?? false;
    const entryValue = rows[rowIndex]?.entryValue ?? 0;
    if (entryValue <= 0) {
      toast.error('Banca insuficiente para contabilizar esta vitoria.');
      return;
    }

    if (alreadyChecked) {
      addTransaction(
        'LOSS',
        entryValue,
        'PLANILHA',
        `Estorno planilha - Ciclo ${rowIndex + 1}, ${periodLabel}, entrada ${cellPosition}`
      );
    } else {
      addTransaction(
        'WIN',
        entryValue,
        'PLANILHA',
        `Vitoria planilha - Ciclo ${rowIndex + 1}, ${periodLabel}, entrada ${cellPosition}`
      );
    }

    setProgress((prev) => {
      const next = prev.map((row) => row.slice());
      if (!next[rowIndex]) return prev;
      next[rowIndex][entryIndex] = !alreadyChecked;
      return next;
    });
  };

  const resetProgress = () => {
    setProgress(buildProgress(cycles, entriesPerDay));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl text-white shadow-glow">
          <Table size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Modo Planilha</h2>
          <p className="text-sm font-medium text-sky-400">Ciclo diario com metas percentuais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-sky-500/20 bg-sky-500/5">
          <label className="text-xs font-bold text-sky-400 uppercase tracking-wide">Valor de banca</label>
          <div className="mt-3 text-3xl font-black text-white">
            {formatCurrency(bankroll)}
          </div>
          <div className="mt-1 text-sm font-semibold text-sky-200">
            {formatBrlFromUsd(bankroll, usdToBrlRate)}
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            Ajuste a banca em Ajustes para atualizar este valor.
          </div>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <label className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Resultado de operacoes</label>
          <div className="mt-3 text-3xl font-black text-emerald-300">
            {formatCurrency(finalBalance)}
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-200">
            {formatBrlFromUsd(finalBalance, usdToBrlRate)}
          </div>
          <div className="text-[10px] text-gray-500 mt-2">
            {cycles} ciclos com {formatPercent(dailyPercent)} ao dia
          </div>
        </Card>

        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide">% diaria</label>
              <div className="flex items-center mt-2">
                <input
                  type="number"
                  value={dailyPercent}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  onInput={(e) => {
                    if (e.currentTarget.value.length > 6) {
                      e.currentTarget.value = e.currentTarget.value.slice(0, 6);
                    }
                  }}
                  max="100"
                  className="w-full text-2xl font-bold bg-transparent border-b border-indigo-500/40 text-white outline-none py-1 focus:border-indigo-400 transition-colors"
                />
                <span className="text-lg text-indigo-300 ml-2 font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Qtd entrada</label>
              <div className="flex items-center mt-2">
                <input
                  type="number"
                  value={entriesPerDay}
                  onChange={(e) => handleEntriesChange(e.target.value)}
                  onInput={(e) => {
                    if (e.currentTarget.value.length > 2) {
                      e.currentTarget.value = e.currentTarget.value.slice(0, 2);
                    }
                  }}
                  min="1"
                  max="30"
                  className="w-full text-2xl font-bold bg-transparent border-b border-indigo-500/40 text-white outline-none py-1 focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Ciclos</label>
              <div className="flex items-center mt-2">
                <input
                  type="number"
                  value={cycles}
                  onChange={(e) => handleCyclesChange(e.target.value)}
                  onInput={(e) => {
                    if (e.currentTarget.value.length > 2) {
                      e.currentTarget.value = e.currentTarget.value.slice(0, 2);
                    }
                  }}
                  min="1"
                  max="60"
                  className="w-full text-2xl font-bold bg-transparent border-b border-indigo-500/40 text-white outline-none py-1 focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] text-gray-500">
              Entradas divididas por manha, tarde e noite.
              {syncStatus !== 'idle' && (
                <span className="ml-2 text-[10px] text-sky-400">
                  {syncStatus === 'saving' && 'Sincronizando...'}
                  {syncStatus === 'error' && 'Erro ao salvar'}
                  {syncStatus === 'offline' && 'Offline'}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={resetProgress}>
              <RefreshCcw size={12} /> Limpar marcacoes
            </Button>
          </div>
        </Card>
      </div>

      <div className="rounded-2xl border border-white/5 bg-dark-900/40 overflow-x-auto">
        <table className="min-w-[980px] w-full text-xs">
          <thead className="bg-black/30">
            <tr className="text-[10px] uppercase tracking-widest text-gray-400">
              <th className="px-3 py-3 text-left">No</th>
              <th className="px-3 py-3 text-left">Vlr da banca</th>
              <th className="px-3 py-3 text-left">% diaria</th>
              <th className="px-3 py-3 text-left">Meta do diario</th>
              <th className="px-3 py-3 text-left">Qtd entrada</th>
              <th className="px-3 py-3 text-left">Vlr da entrada</th>
              {periodLabels.map((label) => (
                <th key={label} className="px-3 py-3 text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-t border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-3 py-2 font-bold text-gray-300">{rowIndex + 1}</td>
                <td className="px-3 py-2 font-mono text-gray-200">
                  <div>{formatCurrency(row.bank)}</div>
                  <div className="text-[10px] text-gray-500">{formatBrlFromUsd(row.bank, usdToBrlRate)}</div>
                </td>
                <td className="px-3 py-2 font-mono text-gray-400">{formatPercent(dailyPercent)}</td>
                <td className="px-3 py-2 font-mono text-emerald-300">
                  <div>{formatCurrency(row.dailyGoal)}</div>
                  <div className="text-[10px] text-emerald-500/80">{formatBrlFromUsd(row.dailyGoal, usdToBrlRate)}</div>
                </td>
                <td className="px-3 py-2 font-mono text-gray-300">{entriesPerDay}</td>
                <td className="px-3 py-2 font-mono text-sky-300">
                  <div>{formatCurrency(row.entryValue)}</div>
                  <div className="text-[10px] text-sky-400/80">{formatBrlFromUsd(row.entryValue, usdToBrlRate)}</div>
                </td>
                {periodCounts.map((count, periodIndex) => (
                  <td key={`${rowIndex}-${periodIndex}`} className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {Array.from({ length: count }).map((_, cellIndex) => {
                        const entryIndex = periodOffsets[periodIndex] + cellIndex;
                        const active = progress[rowIndex]?.[entryIndex] ?? false;
                        return (
                          <button
                            key={`${rowIndex}-${periodIndex}-${entryIndex}`}
                            type="button"
                            aria-label={`Entrada ${rowIndex + 1} ${periodLabels[periodIndex]} ${cellIndex + 1}`}
                            aria-pressed={active}
                            onClick={() =>
                              toggleCell(
                                rowIndex,
                                entryIndex,
                                periodLabels[periodIndex],
                                cellIndex + 1
                              )
                            }
                            className={`h-3.5 w-3.5 rounded-[3px] border transition-colors ${
                              active
                                ? 'bg-emerald-400/80 border-emerald-400/80 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                                : 'bg-black/20 border-white/10 hover:border-white/30'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-dark-900/50 rounded-xl p-6 border border-white/5 border-l-4 border-l-sky-500">
        <div className="flex items-center gap-2 mb-4">
          <Info size={18} className="text-sky-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Como funciona o modo planilha?
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-400 leading-relaxed">
          <div>
            <strong className="text-gray-200 block mb-1">Meta diaria composta</strong>
            O sistema projeta o crescimento da banca aplicando a meta percentual ao final de cada ciclo.
            Cada linha representa um dia (ou ciclo), com a meta e o valor sugerido por entrada.
          </div>
          <div>
            <strong className="text-gray-200 block mb-1">Controle por periodos</strong>
            Use os quadrinhos de manha, tarde e noite para marcar entradas executadas. Isso ajuda a
            manter o ritmo e distribuir o risco ao longo do dia.
          </div>
        </div>
      </div>
    </div>
  );
};
