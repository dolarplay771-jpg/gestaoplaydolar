import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ArrowLeft, CheckCircle2, AlertCircle, KeyRound, Loader2, Lock } from 'lucide-react';
import { Logo } from './ui/Logo';

interface PasswordResetProps {
  onBack?: () => void;
  onComplete?: () => void;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({ onBack, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setReady(false);
      setErrorMsg('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      return;
    }

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!data.session) {
          setReady(false);
          setErrorMsg('Link inválido ou expirado. Solicite uma nova recuperação.');
          return;
        }
        setReady(true);
      })
      .catch(() => {
        setReady(false);
        setErrorMsg('Não foi possível validar o link. Tente novamente.');
      });
  }, []);

  const clearUrl = () => {
    const cleanPath = window.location.pathname + window.location.search;
    if (window.location.hash) {
      window.history.replaceState({}, document.title, cleanPath);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase não configurado.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setSuccessMsg('Senha atualizada! Faça login novamente.');
      setNewPassword('');
      setConfirmPassword('');
      clearUrl();
      await supabase.auth.signOut();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-dark-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-medium text-sm"
        >
          <ArrowLeft size={18} /> Voltar
        </button>
      )}

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-10 flex flex-col items-center">
          <Logo className="scale-125 mb-4" />
          <p className="text-gray-500 text-sm tracking-wide uppercase font-medium mt-2">Redefinir Senha</p>
        </div>

        <Card className="backdrop-blur-xl bg-dark-900/80 border-white/10 shadow-2xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-200 font-medium leading-tight">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-emerald-200 font-medium leading-tight">{successMsg}</p>
            </div>
          )}

          {ready === null ? (
            <div className="py-8 flex items-center justify-center text-gray-500">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => {
                      setErrorMsg(null);
                      setNewPassword(e.target.value);
                    }}
                    maxLength={32}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                    required
                    minLength={6}
                    disabled={!ready}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => {
                      setErrorMsg(null);
                      setConfirmPassword(e.target.value);
                    }}
                    maxLength={32}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                    required
                    minLength={6}
                    disabled={!ready}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full py-4 text-lg shadow-glow font-bold" disabled={loading || !ready}>
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <KeyRound size={20} /> Atualizar Senha
                  </>
                )}
              </Button>
            </form>
          )}

          {successMsg && onComplete && (
            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <Button variant="outline" onClick={onComplete} className="w-full">
                Voltar ao Login
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
