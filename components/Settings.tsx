import React, { useState, useEffect } from 'react';
import { useBankroll } from '../context/BankrollContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Save, Trash2, Sliders, HelpCircle, Cloud, ShieldCheck, Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBrlFromUsd } from '../lib/currency';

export const Settings: React.FC = () => {
  const { 
    currentBalance, 
    riskPercentage, 
    setInitialBalance, 
    setRiskPercentage, 
    resetBankroll,
    session,
    loading,
    usdToBrlRate
  } = useBankroll();

  // Estados locais como Strings para manipulação da máscara
  const [localBalance, setLocalBalance] = useState('');
  const [localRisk, setLocalRisk] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Função auxiliar para formatar valor numérico para string de moeda (ex: 1234.56 -> 1,234.56)
  const formatToCurrencyString = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Sincroniza o estado local com o contexto
  useEffect(() => {
    if (!loading) {
        setLocalBalance(formatToCurrencyString(currentBalance));
        setLocalRisk(riskPercentage.toString());
    }
  }, [currentBalance, riskPercentage, loading]);

  // --- MÁSCARA PARA BANCA (Moeda) ---
  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Remove tudo que não for dígito (0-9)
    let value = e.target.value.replace(/\D/g, "");
    
    // 2. Evita números absurdamente grandes (limite de 12 dígitos)
    if (value.length > 12) value = value.slice(0, 12);

    // 3. Se estiver vazio, define como zero
    if (value === "") value = "0";

    // 4. Converte para número e divide por 100 para tratar os centavos
    const numberValue = Number(value) / 100;

    // 5. Formata de volta para string com vírgulas e pontos
    setLocalBalance(formatToCurrencyString(numberValue));
  };

  // --- MÁSCARA PARA RISCO (Porcentagem: 0 a 100) ---
  const handleRiskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // 1. Permite apenas números e ponto
    // Regex: Remove tudo que não for 0-9 ou .
    value = value.replace(/[^0-9.]/g, '');

    // 2. Impede múltiplos pontos (ex: 2.5.5)
    const dots = value.match(/\./g);
    if (dots && dots.length > 1) {
         const parts = value.split('.');
         // Reconstrói mantendo apenas o primeiro ponto
         value = parts[0] + '.' + parts.slice(1).join('');
    }

    // 3. Validação de Limite (Max 100)
    if (value !== '' && value !== '.') {
         const numValue = parseFloat(value);
         
         if (!isNaN(numValue)) {
             if (numValue > 100) {
                 value = '100';
             }
         }
    }

    setLocalRisk(value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        // Parse Risco
        let risk = Number(localRisk);
        if (isNaN(risk)) risk = 2.0;
        if (risk > 100) risk = 100;
        if (risk < 0.1) risk = 0.1; // Mínimo seguro
        
        // Parse Banca: Remove as vírgulas antes de converter para número
        // Ex: "1,234.56" -> "1234.56" -> 1234.56
        const rawBalance = localBalance.replace(/,/g, '');
        let balance = Number(rawBalance);
        if (isNaN(balance)) balance = 0;
        if (balance < 0) balance = 0;

        // Atualiza o risco
        await setRiskPercentage(risk);
        
        // Atualiza a banca
        await setInitialBalance(balance);
        
        // Atualiza inputs visuais para garantir formatação perfeita após salvar
        setLocalRisk(risk.toString());
        setLocalBalance(formatToCurrencyString(balance));

        toast.success('Configurações atualizadas com sucesso!');
    } catch (error: any) {
        console.error(error);
        toast.error(`Erro ao salvar: ${error.message || 'Verifique sua conexão.'}`);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto pb-10">
      <div className="flex items-center gap-3 border-b border-white/10 pb-6">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
            <Sliders size={24} />
        </div>
        <div>
            <h2 className="text-3xl font-bold text-white">Ajustes</h2>
            <p className="text-gray-400 text-sm">Personalize sua gestão e conta.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
            <h3 className="text-lg font-bold mb-6 text-primary flex items-center gap-2">
                Parâmetros Gerais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Banca Atual (Reajustar)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        {/* INPUT TYPE TEXT para controle total da máscara */}
                        <input 
                            type="text" 
                            inputMode="numeric"
                            value={localBalance}
                            onChange={handleBalanceChange}
                            className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-8 pr-4 text-white placeholder-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-lg"
                            placeholder="0.00"
                        />
                    </div>
                    <p className="text-[10px] text-gray-600">Digite apenas números. O sistema formata automaticamente.</p>
                    <p className="text-[10px] text-emerald-400">Equivalente: {formatBrlFromUsd(Number(localBalance.replace(/,/g, '') || 0), usdToBrlRate)}</p>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Risco Padrão (%)</label>
                    <div className="relative">
                        {/* INPUT TYPE TEXT para bloquear letras e controlar limite */}
                        <input 
                            type="text" 
                            inputMode="decimal"
                            value={localRisk}
                            onChange={handleRiskChange}
                            maxLength={5}
                            className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-lg"
                            placeholder="2.0"
                        />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-gray-600">Define quanto da banca é usado por operação. Máximo: 100%.</p>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/5">
                <Button onClick={handleSave} className="w-full md:w-auto" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
            </div>
        </Card>

        {/* Guia de Configuração Geral */}
        <div className="bg-dark-900/40 rounded-xl p-6 border border-white/5">
           <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={18} className="text-gray-300" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Entendendo as Configurações</h3>
           </div>
           <div className="grid grid-cols-1 gap-4 text-xs text-gray-500 leading-relaxed">
              <div className="flex gap-3">
                  <div className="w-1 bg-gold-500/50 rounded-full h-full min-h-[40px]"></div>
                  <div>
                    <strong className="text-gold-200 block mb-1">Banca Atual (Reajustar)</strong>
                    Este campo mostra quanto você tem <strong>agora</strong>. Se você depositou mais dinheiro na corretora ou sacou, edite este valor e clique em Salvar para sincronizar o sistema com a realidade.
                  </div>
              </div>
              <div className="flex gap-3">
                  <div className="w-1 bg-gold-500/50 rounded-full h-full min-h-[40px]"></div>
                  <div>
                    <strong className="text-gold-200 block mb-1">Risco Padrão (%)</strong>
                    É a porcentagem da sua banca que você aceita perder em uma única operação. Exemplo: Com banca de $1000 e risco de 2%, o "Modo Branco" sugerirá entradas de $20.
                  </div>
              </div>
           </div>
        </div>

        {/* Card Informativo de Dados em Nuvem */}
        <Card className="bg-gradient-to-br from-dark-900 to-dark-800 border-emerald-500/20">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500 border border-emerald-500/20">
                    <Cloud size={28} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">Sincronização Ativa</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        Seus dados estão sendo salvos automaticamente em nossa base de dados criptografada.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 text-xs font-mono text-gray-500">
                        <div className="flex items-center gap-2">
                            <Mail size={14} className="text-gold-500" />
                            {session?.user.email}
                        </div>
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            Status: <span className="text-emerald-400">Online</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        <Card className="border-red-900/30 bg-red-900/5">
            <h3 className="text-lg font-bold mb-2 text-red-500">Zona de Perigo</h3>
            <p className="text-sm text-gray-400 mb-4">Esta ação apagará todo o seu histórico de operações do banco de dados permanentemente.</p>
            <Button variant="danger" onClick={resetBankroll} className="w-full md:w-auto border border-red-500/50 shadow-red-900/20">
            <Trash2 size={18} /> Resetar Toda a Banca
            </Button>
        </Card>
      </div>
    </div>
  );
};
