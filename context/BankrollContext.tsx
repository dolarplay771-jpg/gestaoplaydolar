import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BankrollContextType, BankrollState, Transaction, TransactionType } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const defaultState: BankrollState = {
  currentBalance: 0,
  initialBalance: 0,
  transactions: [],
  theme: 'dark',
  riskPercentage: 2,
  subscriptionExpiry: null,
  isAdmin: false,
};

const roundCurrency = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

interface ExtendedContextType extends BankrollContextType {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const BankrollContext = createContext<ExtendedContextType | undefined>(undefined);

export const BankrollProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BankrollState>(defaultState);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [usdToBrlRate, setUsdToBrlRate] = useState(5.0);
  const [usdToBrlUpdatedAt, setUsdToBrlUpdatedAt] = useState<number | null>(null);

  // Computed property
  const isSubscribed = React.useMemo(() => {
    if (state.isAdmin) return true;
    if (!state.subscriptionExpiry) return false;
    return Date.now() < state.subscriptionExpiry;
  }, [state.subscriptionExpiry, state.isAdmin]);

  useEffect(() => {
    let isActive = true;

    const fetchUsdToBrlRate = async () => {
      try {
        const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        if (!response.ok) return;

        const data = await response.json();
        const nextRate = Number(data?.USDBRL?.bid);
        if (!Number.isFinite(nextRate) || nextRate <= 0) return;

        if (isActive) {
          setUsdToBrlRate(nextRate);
          setUsdToBrlUpdatedAt(Date.now());
        }
      } catch {
        // Mantem taxa anterior em caso de falha de rede.
      }
    };

    fetchUsdToBrlRate();
    const interval = setInterval(fetchUsdToBrlRate, 10 * 60 * 1000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  // 1. Auth Listener
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
        console.warn('Supabase não configurado.');
        setLoading(false);
        return;
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchData(session.user.id, session.user.email);
        else setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao conectar com Supabase:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData(session.user.id, session.user.email);
      else {
        setState(defaultState);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;

    const channel = supabase
      .channel(`profiles:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`
        },
        (payload) => {
          const updated = (payload as any)?.new;
          if (!updated) return;
          setState(prev => ({
            ...prev,
            subscriptionExpiry: Number(updated.subscription_expiry || 0),
            isAdmin: Boolean(updated.is_admin)
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // 2. Fetch Data
  const fetchData = async (userId: string, userEmail?: string) => {
    if (!supabase) {
      console.error('Supabase não configurado.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code === 'PGRST205') {
          console.error("TABELAS NÃO ENCONTRADAS. Execute o script db_setup.sql.");
          setLoading(false);
          return;
      }

      if (!profile && !profileError) {
         await new Promise(r => setTimeout(r, 1000));
         const retry = await supabase.from('profiles').select('*').eq('id', userId).single();
         profile = retry.data;
      }

      if (profile && userEmail && profile.email !== userEmail) {
          await supabase.from('profiles').update({ email: userEmail }).eq('id', userId);
          profile.email = userEmail;
      }

      // LIMITAÇÃO AQUI: Busca apenas os últimos 50 registros
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (profile) {
        const mappedTransactions: Transaction[] = (transactions || []).map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: roundCurrency(Number(t.amount || 0)),
            balanceAfter: roundCurrency(Number(t.balance_after || 0)),
            timestamp: t.timestamp,
            mode: t.mode,
            note: t.note
        }));

        setState({
          currentBalance: roundCurrency(Number(profile.current_balance || 0)),
          initialBalance: roundCurrency(Number(profile.initial_balance || 0)),
          riskPercentage: Number(profile.risk_percentage),
          theme: 'dark',
          transactions: mappedTransactions,
          subscriptionExpiry: Number(profile.subscription_expiry || 0),
          isAdmin: Boolean(profile.is_admin)
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const renewSubscription = async () => {
      if (!session || !supabase) return;
      const now = Date.now();
      const days30 = 30 * 24 * 60 * 60 * 1000;
      const currentExp = state.subscriptionExpiry && state.subscriptionExpiry > now 
        ? state.subscriptionExpiry 
        : now;
      const newExpiry = currentExp + days30;

      try {
          const { error } = await supabase
            .from('profiles')
            .update({ subscription_expiry: newExpiry })
            .eq('id', session.user.id);
          if (error) throw error;
          setState(prev => ({ ...prev, subscriptionExpiry: newExpiry }));
      } catch (error) {
          console.error("Erro ao renovar assinatura", error);
      }
  };

  const setInitialBalance = async (amount: number) => {
    if (!session || !supabase) return;
    try {
      const normalizedAmount = roundCurrency(amount);
      // Atualiza no banco PRIMEIRO
      const { error } = await supabase
        .from('profiles')
        .update({ initial_balance: normalizedAmount, current_balance: normalizedAmount })
        .eq('id', session.user.id);

      if (error) throw error;

      // Se sucesso, atualiza estado local
      setState(prev => ({
        ...prev,
        initialBalance: normalizedAmount,
        currentBalance: normalizedAmount
      }));
      
    } catch (e: any) {
      console.error("Erro ao definir banca:", e);
      throw e; // Repassa o erro para o componente tratar
    }
  };

  const addTransaction = async (type: TransactionType, amount: number, mode: string, note?: string) => {
    if (!session || !supabase) return;

    const normalizedAmount = roundCurrency(Number.isFinite(amount) ? amount : 0);
    let newBalance = state.currentBalance;
    if (type === 'WIN' || type === 'DEPOSIT') newBalance = roundCurrency(newBalance + normalizedAmount);
    else if (type === 'LOSS') newBalance = roundCurrency(newBalance - normalizedAmount);

    const timestamp = Date.now();
    const newTx = {
      user_id: session.user.id,
      type,
      amount: normalizedAmount,
      balance_after: newBalance,
      timestamp,
      mode,
      note
    };

    const optimisticTx: Transaction = {
        id: Date.now().toString(),
        type,
        amount: normalizedAmount,
        balanceAfter: newBalance,
        timestamp,
        mode,
        note
    };

    setState(prev => ({
      ...prev,
      currentBalance: newBalance,
      // Mantém apenas os últimos 50 no estado local para consistência visual
      transactions: [optimisticTx, ...prev.transactions].slice(0, 50)
    }));

    try {
      const { error: txError } = await supabase.from('transactions').insert([newTx]);
      
      if (txError) throw txError;

      const { error: profError } = await supabase
        .from('profiles')
        .update({ current_balance: newBalance })
        .eq('id', session.user.id);
      
      if (profError) throw profError;

    } catch (error: any) {
      console.error('Erro ao salvar transação:', error);
      if (error.code === 'PGRST205' || error.message?.includes('find the table')) {
          toast.error("Banco de dados não configurado. Execute db_setup.sql.");
      } else {
          toast.error('Falha ao salvar operação. Tentando sincronizar novamente.');
      }
      setTimeout(() => {
          fetchData(session.user.id, session.user.email);
      }, 1000);
    }
  };

  const resetBankroll = async () => {
    if (!session || !supabase) return;
    
    const confirmReset = window.confirm(
        'ATENÇÃO: Você tem certeza?\n\nIsso apagará PERMANENTEMENTE todo o histórico, redefinirá sua banca para ZERO e o risco para 2%.\n\nEssa ação não pode ser desfeita.'
    );
    
    if (!confirmReset) return;

    try {
        setLoading(true);
        
        // 1. Deletar Transações
        const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('user_id', session.user.id);
        
        if (deleteError) {
            console.error("Erro ao deletar transações:", deleteError);
            throw new Error(`Erro ao apagar histórico: ${deleteError.message}`);
        }
        
        // 2. Resetar Perfil (Banca 0, Risco 2%)
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
              current_balance: 0, 
              initial_balance: 0,
              risk_percentage: 2.0 
          })
          .eq('id', session.user.id);

        if (updateError) {
             console.error("Erro ao resetar saldo:", updateError);
             throw new Error(`Erro ao restaurar saldo: ${updateError.message}`);
        }

        // 3. Atualizar Estado Local
        setState(prev => ({
            ...prev,
            currentBalance: 0,
            initialBalance: 0,
            riskPercentage: 2.0,
            transactions: [] 
        }));
        
        toast.success("Banca resetada com sucesso! Histórico limpo e valores zerados.");

    } catch (error: any) {
        console.error("Erro no reset:", error);
        toast.error(`Falha ao resetar: ${error.message || 'Verifique policies e conexão.'}`);
    } finally {
        setLoading(false);
    }
  };

  const toggleTheme = () => console.log("Dark Mode Only");

  const setRiskPercentage = async (risk: number) => {
    if (!session || !supabase) return;
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ risk_percentage: risk })
            .eq('id', session.user.id);
        
        if (error) throw error;
        
        setState(prev => ({ ...prev, riskPercentage: risk }));
    } catch (e) {
        console.error(e);
        throw e;
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const convertUsdToBrl = (usd: number) => {
    return roundCurrency((Number(usd) || 0) * usdToBrlRate);
  };

  return (
    <BankrollContext.Provider value={{
      ...state,
      session,
      loading,
      setInitialBalance,
      addTransaction,
      resetBankroll,
      toggleTheme,
      setRiskPercentage,
      renewSubscription,
      isSubscribed,
      signOut,
      usdToBrlRate,
      usdToBrlUpdatedAt,
      convertUsdToBrl
    }}>
      {children}
    </BankrollContext.Provider>
  );
};

export const useBankroll = () => {
  const context = useContext(BankrollContext);
  if (context === undefined) {
    throw new Error('useBankroll must be used within a BankrollProvider');
  }
  return context;
};

