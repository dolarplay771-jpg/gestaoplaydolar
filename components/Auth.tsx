import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Mail, Lock, Loader2, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { Logo } from './ui/Logo';

interface AuthProps {
    onBack?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RECOVERY'>('REGISTER');
  
  // Novos estados para feedback visual
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');

  const onlyDigits = (value: string) => value.replace(/\D/g, '');

  const formatPhone = (digits: string) => {
    const cleaned = onlyDigits(digits).slice(0, 13);
    let countryPrefix = '';
    let local = cleaned;

    if (cleaned.startsWith('55')) {
      countryPrefix = '+55 ';
      local = cleaned.slice(2);
    }

    if (local.length <= 2) return `${countryPrefix}${local}`.trim();
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);

    if (rest.length <= 4) return `${countryPrefix}(${ddd}) ${rest}`.trim();
    if (rest.length <= 8) return `${countryPrefix}(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`.trim();
    return `${countryPrefix}(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`.trim();
  };

  const formatTaxId = (digits: string) => {
    const cleaned = onlyDigits(digits).slice(0, 14);

    if (cleaned.length <= 11) {
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
      if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }

    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
    if (cleaned.length <= 12) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
    }
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    
    if (!isSupabaseConfigured || !supabase) {
        setErrorMsg("Erro de Configuração: Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
        return;
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const isEmailAlreadyRegistered = (msg: string, code?: string) => {
      const lowered = msg.toLowerCase();
      return (
        code === 'user_already_exists' ||
        code === 'email_address_already_registered' ||
        lowered.includes('already registered') ||
        lowered.includes('already exists') ||
        lowered.includes('registered') && lowered.includes('already')
      );
    };

    setLoading(true);
    try {
      if (mode === 'RECOVERY') {
        // --- RECUPERAÇÃO DE SENHA ---
        const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
            redirectTo: window.location.origin, 
        });
        if (error) throw error;
        setSuccessMsg('Email de recuperação enviado! Verifique sua caixa de entrada e spam.');
        
      } else if (mode === 'REGISTER') {
        if (password !== confirmPassword) {
          setErrorMsg('As senhas não coincidem.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }

        const name = fullName.replace(/\s+/g, ' ').trim();
        const phoneDigits = onlyDigits(phone);
        const taxDigits = onlyDigits(taxId);
        const localPhone = phoneDigits.startsWith('55') ? phoneDigits.slice(2) : phoneDigits;
        const cellphone = phoneDigits.startsWith('55') ? `+${phoneDigits}` : `+55${localPhone}`;

        if (!name) {
          setErrorMsg('Informe seu nome completo.');
          setLoading(false);
          return;
        }
        if (localPhone.length < 10 || localPhone.length > 11) {
          setErrorMsg('Informe um celular valido com DDD.');
          setLoading(false);
          return;
        }
        if (taxDigits.length !== 11 && taxDigits.length !== 14) {
          setErrorMsg('Informe um CPF ou CNPJ valido.');
          setLoading(false);
          return;
        }

        const { data: emailTaken, error: emailCheckError } = await supabase.rpc('is_email_taken', { p_email: sanitizedEmail });
        if (emailCheckError) {
            setErrorMsg('Nao foi possivel validar o e-mail. Verifique se o db_setup.sql foi aplicado.');
            return;
        }
        if (emailTaken) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: sanitizedEmail,
              password,
            });
            if (signInError) {
              setErrorMsg('Ja existe uma conta com esse e-mail. Faca login com a senha correta.');
              return;
            }
            const { error: updateError } = await supabase.auth.updateUser({
              data: {
                full_name: name,
                phone: cellphone,
                tax_id: taxDigits,
              },
            });
            if (updateError) {
              setErrorMsg('Conta existente. Nao foi possivel atualizar os dados agora.');
              return;
            }
            setSuccessMsg('Conta existente. Dados atualizados e acesso liberado.');
            return;
        }

        // --- REGISTRO ---
        const { data, error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password,
          options: {
            data: {
              full_name: name,
              phone: cellphone,
              tax_id: taxDigits,
            },
          },
        });
        
        if (error) throw error;

        const identities = data.user?.identities ?? [];
        if (data.user && identities.length === 0) {
            setErrorMsg('Já existe uma conta com esse e-mail. Por favor, faça login.');
            return;
        }

        // Se data.user existe mas data.session é null, o email precisa de confirmação.
        // Para evitar confusão com e-mail já existente, tratamos identidades vazias como "já cadastrado".
        if (data.user && !data.session) {
            setSuccessMsg('Conta criada! Enviamos um link de confirmação para o seu email. Verifique a caixa de Spam.');
            setMode('LOGIN'); 
        } else if (data.session) {
             setSuccessMsg('Cadastro realizado! Entrando...');
        }

      } else {
        // --- LOGIN ---
        const { error } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error("Auth Error Full:", error);
      
      let msg = error.message;
      const code = error.code; // Supabase error code

      // Tratamento de erros específicos conforme pedido
      if (mode === 'REGISTER') {
          if (isEmailAlreadyRegistered(msg, code)) {
              msg = "Já existe uma conta com esse e-mail. Por favor, faça login.";
          }
      }

      if (mode === 'LOGIN') {
          if (msg.includes("Invalid login credentials")) {
              msg = "E-mail ou senha incorretos.";
          } else if (msg.includes("Email not confirmed")) {
              msg = "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
          }
      }

      // Erros genéricos de segurança
      if (msg.includes("Password should be at least")) {
          msg = "A senha deve ter pelo menos 6 caracteres.";
      } else if (msg.includes("rate limit") || code === "429") {
          msg = "Muitas tentativas. Aguarde alguns segundos.";
      }

      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
      switch(mode) {
          case 'LOGIN': return 'Acesso ao Sistema';
          case 'REGISTER': return 'Criar Nova Conta';
          case 'RECOVERY': return 'Recuperar Senha';
      }
  };

  const getButtonText = () => {
      if (loading) return '';
      switch(mode) {
          case 'LOGIN': return 'Acessar Dashboard';
          case 'REGISTER': return 'Criar Conta';
          case 'RECOVERY': return 'Enviar Link de Recuperação';
      }
  };

  return (
    <div className="min-h-screen w-full bg-dark-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        
        {onBack && (
            <button 
                onClick={onBack}
                className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-medium text-sm"
            >
                <ArrowLeft size={18} /> Voltar ao Início
            </button>
        )}
        
        <div className="w-full max-w-md relative z-10 animate-fade-in pt-10 sm:pt-0">
            <div className="text-center mb-12 flex flex-col items-center">
                <Logo className="scale-125 mb-6" />
                <p className="text-gray-500 text-sm tracking-wide uppercase font-medium mt-1">{getTitle()}</p>
            </div>

            <Card className="backdrop-blur-xl bg-dark-900/80 border-white/10 shadow-2xl">
                
                {/* ÁREA DE FEEDBACK DE ERRO/SUCESSO */}
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

                <form onSubmit={handleAuth} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => {
                                    setErrorMsg(null);
                                    setEmail(e.target.value);
                                }}
                                maxLength={64}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    {mode === 'REGISTER' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Nome completo</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Seu nome completo"
                                    value={fullName}
                                    onChange={(e) => {
                                        setErrorMsg(null);
                                        setFullName(e.target.value);
                                    }}
                                    maxLength={80}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {mode === 'REGISTER' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Celular</label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    placeholder="+55 11 99999-9999"
                                    value={formatPhone(phone)}
                                    onChange={(e) => {
                                        setErrorMsg(null);
                                        setPhone(onlyDigits(e.target.value));
                                    }}
                                    maxLength={20}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {mode === 'REGISTER' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">CPF/CNPJ</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="123.456.789-00"
                                    value={formatTaxId(taxId)}
                                    onChange={(e) => {
                                        setErrorMsg(null);
                                        setTaxId(onlyDigits(e.target.value));
                                    }}
                                    maxLength={20}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {mode !== 'RECOVERY' && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Senha</label>
                                {mode === 'LOGIN' && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setMode('RECOVERY');
                                            setErrorMsg(null);
                                            setSuccessMsg(null);
                                        }}
                                        className="text-[10px] text-gray-500 hover:text-gold-400 transition-colors uppercase font-bold tracking-wider"
                                    >
                                        Esqueci a senha
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => {
                                        setErrorMsg(null);
                                        setPassword(e.target.value);
                                    }}
                                    maxLength={32}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    )}

                    {mode === 'REGISTER' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gold-500 uppercase tracking-wide">Confirmar Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setErrorMsg(null);
                                        setConfirmPassword(e.target.value);
                                    }}
                                    maxLength={32}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    )}

                    <Button type="submit" className="w-full py-4 text-lg shadow-glow font-bold" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <>
                                {getButtonText()}
                                {mode === 'RECOVERY' ? <KeyRound size={20} /> : <ArrowRight size={20} />}
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/5 text-center space-y-3">
                    {mode === 'LOGIN' ? (
                        <button 
                            onClick={() => {
                                setMode('REGISTER');
                                setErrorMsg(null);
                                setSuccessMsg(null);
                                setConfirmPassword('');
                                setFullName('');
                                setPhone('');
                                setTaxId('');
                            }}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Não tem uma conta? <span className="text-gold-400 font-bold underline decoration-gold-400/30">Cadastre-se</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => {
                                setMode('LOGIN');
                                setErrorMsg(null);
                                setSuccessMsg(null);
                                setConfirmPassword('');
                                setFullName('');
                                setPhone('');
                                setTaxId('');
                            }}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Já possui conta? <span className="text-gold-400 font-bold underline decoration-gold-400/30">Faça Login</span>
                        </button>
                    )}
                </div>
            </Card>
        </div>
    </div>
  );
};


