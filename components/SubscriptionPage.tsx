import React, { useState, useEffect } from 'react';
import { useBankroll } from '../context/BankrollContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Dashboard } from './Dashboard';
import { Loader2, CreditCard, Lock, LogOut } from 'lucide-react';

export const SubscriptionPage: React.FC = () => {
  const { session, signOut } = useBankroll();
  const [processing, setProcessing] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [returning, setReturning] = useState(false);
  const paidStatuses = new Set(['PAID', 'ACTIVE', 'APPROVED', 'COMPLETED', 'CONFIRMED', 'RECEIVED']);

  const checkPaymentStatus = async (): Promise<boolean> => {
    if (!session || checkingPayment) return false;
    setCheckingPayment(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase nao configurado.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase nao configurado.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? session?.access_token;
      if (!accessToken) {
        throw new Error('Sessao invalida. Faca login novamente.');
      }

      let billingId = '';
      try {
        billingId = localStorage.getItem('abacate_last_billing_id') || '';
      } catch {
        // ignore
      }

      const checkUrl = `${supabaseUrl}/functions/v1/abacate-check?apikey=${encodeURIComponent(supabaseAnonKey)}`;
      const response = await fetch(checkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey
        },
        body: JSON.stringify({
          billingId,
          token: accessToken
        })
      });

      const raw = await response.text();
      let data: any = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { message: raw };
        }
      }

      if (!response.ok) {
        return false;
      }

      const status = (data?.status || '').toString().toUpperCase();
      if (paidStatuses.has(status)) {
        window.history.replaceState({}, '', window.location.pathname);
        window.location.href = window.location.origin;
        return true;
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
    } finally {
      setCheckingPayment(false);
    }
    return false;
  };

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success' || payment === 'return') {
      setReturning(true);
      let attempts = 0;
      const maxAttempts = 8;

      const runCheck = async () => {
        attempts += 1;
        const paid = await checkPaymentStatus();
        if (paid || attempts >= maxAttempts) {
          clearInterval(interval);
          setReturning(false);
        }
      };

      runCheck();
      const interval = setInterval(runCheck, 4000);

      return () => clearInterval(interval);
    }
  }, [session]);

  const handlePayment = async () => {
    if (!session) return;
    setProcessing(true);

    try {
      console.log('Iniciando transacao Abacate Pay...');

      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase nao configurado.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase nao configurado.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? session?.access_token;
      if (!accessToken) {
        throw new Error('Sessao invalida. Faca login novamente.');
      }

      const checkoutUrl = `${supabaseUrl}/functions/v1/abacate-checkout?apikey=${encodeURIComponent(supabaseAnonKey)}`;
      const origin = window.location.origin;
      const response = await fetch(checkoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey
        },
        body: JSON.stringify({
          plan: 'pro',
          token: accessToken,
          returnUrl: `${origin}/?payment=return`,
          completionUrl: `${origin}/?payment=success`
        })
      });

      const raw = await response.text();
      let data: any = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { message: raw };
        }
      }

      if (!response.ok) {
        let message = data?.error || data?.message || `Erro ao iniciar pagamento (${response.status}).`;
        if (data?.details) {
          try {
            message = `${message} ${JSON.stringify(data.details)}`;
          } catch {
            message = `${message} ${String(data.details)}`;
          }
        }
        throw new Error(message);
      }

      const billingId = data?.checkoutId || data?.billingId || data?.id || '';
      if (billingId) {
        try {
          localStorage.setItem('abacate_last_billing_id', billingId);
        } catch {
          // Ignore storage failures.
        }
      }

      const paymentUrl =
        data?.url ||
        data?.checkoutUrl ||
        data?.paymentUrl ||
        (data?.checkoutId || data?.billingId
          ? `https://app.abacatepay.com/pay/${data?.checkoutId || data?.billingId}`
          : '');

      if (!paymentUrl) {
        throw new Error('URL de pagamento nao retornada.');
      }

      window.location.href = paymentUrl;
      setProcessing(false);
    } catch (error: any) {
      console.error('Erro no checkout:', error);
      alert(error?.message || 'Erro ao iniciar pagamento. Tente novamente.');
      setProcessing(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-dark-950 overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full w-full scale-[1.03] blur-[10px] opacity-25">
          <div className="h-full w-full p-8">
            <Dashboard />
          </div>
        </div>
        <div className="absolute inset-0 bg-dark-950/70"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="absolute top-6 right-6">
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            <LogOut size={18} /> Sair da conta
          </button>
        </div>

        <Card className="w-full max-w-md bg-dark-900/90 border border-white/10 p-8 text-center shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-300">
            <Lock size={12} /> Acesso bloqueado
          </div>

          <h1 className="mt-4 text-2xl font-bold text-white">Ativar acesso</h1>
          <p className="mt-2 text-sm text-gray-400">Assinatura mensal via Abacate Pay no cartao.</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Libera 30 dias de acesso automatico
          </div>

          <div className="mt-6 flex items-end justify-center gap-1 text-white">
            <span className="text-xl font-bold">R$</span>
            <span className="text-5xl font-black tracking-tighter">19</span>
            <span className="text-lg font-bold">,99</span>
          </div>

          <Button
            onClick={handlePayment}
            disabled={processing}
            className="mt-8 w-full h-14 text-base text-white border-none shadow-[0_0_30px_rgba(130,179,58,0.4)] bg-gradient-to-r from-[#82B33A] to-[#6A9A2B] hover:shadow-[0_0_30px_rgba(130,179,58,0.5)]"
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin" /> Abrindo checkout...
              </>
            ) : (
              <>
                <CreditCard size={18} /> ASSINAR AGORA
              </>
            )}
          </Button>

          <p className="mt-3 text-xs text-gray-500">
            Apos a confirmacao do checkout o acesso e liberado automaticamente.
          </p>
          {returning && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-400">
              <Loader2 className="animate-spin" size={14} /> Validando pagamento...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
