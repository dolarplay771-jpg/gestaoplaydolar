import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useBankroll } from '../context/BankrollContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  Search,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  PlusCircle,
  RefreshCw,
  Trash2,
  Timer,
  Activity,
} from 'lucide-react';
import { formatBrlFromUsd, formatUsd } from '../lib/currency';

interface UserProfile {
  id: string;
  email?: string;
  current_balance: number;
  initial_balance?: number;
  risk_percentage?: number;
  subscription_expiry: number;
  is_admin: boolean;
  created_at: string;
}

export const AdminPanel: React.FC = () => {
  const { usdToBrlRate } = useBankroll();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        toast.error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        return;
      }
      // Requer RLS permitindo admins ler todos os profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      toast.error(`Erro ao carregar lista: ${error.message || 'Verifique permissões RLS/Admin.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddDays = async (userId: string, days: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (!isSupabaseConfigured || !supabase) {
        toast.error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        return;
    }

    try {
        const { error } = await supabase.rpc('admin_add_days', { p_target: userId, p_days: days });
        if (error) throw error;
        // Refetch para consistência
        await fetchUsers();
        toast.success(`Adicionado ${days} dias com sucesso!`);
    } catch (err) {
        console.error(err);
        toast.error(`Erro ao atualizar assinatura: ${(err as any)?.message || 'verifique políticas/Admin ou chave de serviço.'}`);
    }
  };

  const handleExpireNow = async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) {
        toast.error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        return;
    }
    try {
        const { error } = await supabase.rpc('admin_expire_user', { p_target: userId });
        if (error) throw error;
        await fetchUsers();
        toast.success('Plano marcado como expirado.');
    } catch (err) {
        console.error(err);
        toast.error(`Erro ao expirar plano: ${(err as any)?.message || 'verifique políticas/Admin ou chave de serviço.'}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (!window.confirm(`Excluir usuário ${user.email || user.id}? Isso apagará perfis e transações.`)) return;
    if (!isSupabaseConfigured || !supabase) {
        toast.error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        return;
    }
    try {
        const { error } = await supabase.rpc('admin_purge_user', { p_target: userId });
        if (error) throw error;
        await fetchUsers();
        toast.success('Usuário removido.');
    } catch (err) {
        console.error(err);
        toast.error(`Erro ao excluir: ${(err as any)?.message || 'Ajuste políticas/Admin ou use função com chave de serviço.'}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (ts: number) => {
    if (!ts) return 'Nunca';
    return new Date(ts).toLocaleDateString('pt-BR');
  };

  const formatCurrency = formatUsd;

  const isActive = (ts: number) => ts > Date.now();

  const DAY_MS = 1000 * 60 * 60 * 24;

  const remaining = (ts: number) => {
    const diff = ts - Date.now();
    const days = Math.floor(diff / DAY_MS);
    return {
      days: Math.max(0, days),
      active: days > 0 && diff > 0,
    };
  };

  const stats = useMemo(() => {
    const active = users.filter(u => isActive(u.subscription_expiry)).length;
    const expired = users.length - active;
    const balances = users.reduce((acc, u) => acc + Number(u.current_balance || 0), 0);
    return { active, expired, balances };
  }, [users]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 rounded-full text-red-500 border border-red-500/20">
                <ShieldAlert size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-bold text-white">Painel Administrativo</h2>
                <p className="text-gray-400 text-sm">Gerenciamento de usuários e assinaturas.</p>
            </div>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-dark-900 border-white/5">
            <div className="text-gray-400 text-xs uppercase font-bold">Total Usuários</div>
            <div className="text-3xl font-black text-white mt-1">{users.length}</div>
        </Card>
        <Card className="bg-dark-900 border-white/5">
            <div className="text-gray-400 text-xs uppercase font-bold">Assinantes Ativos</div>
            <div className="text-3xl font-black text-emerald-400 mt-1">
                {stats.active}
            </div>
        </Card>
        <Card className="bg-dark-900 border-white/5">
             <div className="text-gray-400 text-xs uppercase font-bold">Expirados</div>
            <div className="text-3xl font-black text-red-400 mt-1">
                {stats.expired}
            </div>
        </Card>
        <Card className="bg-dark-900 border-white/5">
             <div className="text-gray-400 text-xs uppercase font-bold">Banca Total</div>
            <div className="text-2xl font-black text-gold-400 mt-1 flex items-center gap-2">
                <Activity size={18} /> {formatCurrency(stats.balances)}
            </div>
            <div className="text-sm font-semibold text-gold-200 mt-1">
              {formatBrlFromUsd(stats.balances, usdToBrlRate)}
            </div>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 bg-dark-900/60 border border-white/5 rounded-xl px-4 py-3">
        <Search size={18} className="text-gray-500" />
        <input 
            type="text" 
            placeholder="Buscar por ID ou email" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent flex-1 outline-none text-sm text-white placeholder-gray-600"
        />
      </div>

      {/* Tabela */}
      <div className="bg-dark-900/60 border border-white/5 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/5">
            <div className="col-span-3">Usuário</div>
            <div className="col-span-2">Banca/Risco</div>
            <div className="col-span-2">Expira</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Ações</div>
        </div>
        
        <div className="divide-y divide-white/5">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Carregando...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Nenhum usuário encontrado.</div>
          ) : filteredUsers.map(user => {
            const { days, active } = remaining(user.subscription_expiry);
            return (
              <div key={user.id} className="grid grid-cols-12 items-center px-4 py-4 text-sm text-gray-200">
                <div className="col-span-3 flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg">
                        <User size={16} className="text-gold-400" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{user.email || 'Sem email'}</div>
                        <div className="text-[11px] text-gray-500 font-mono truncate">{user.id}</div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Calendar size={12} /> {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        {user.is_admin && (
                          <div className="text-[10px] text-amber-400 font-bold uppercase">Admin</div>
                        )}
                    </div>
                </div>
                <div className="col-span-2 font-mono space-y-1">
                    <div>{formatCurrency(Number(user.current_balance || 0))}</div>
                    <div className="text-[11px] text-gray-500">{formatBrlFromUsd(Number(user.current_balance || 0), usdToBrlRate)}</div>
                    <div className="text-[11px] text-gray-500">Risk {Number(user.risk_percentage ?? 0).toFixed(2)}%</div>
                </div>
                <div className="col-span-2 flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-500" />
                        {formatDate(user.subscription_expiry)}
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                        <Timer size={12} /> {days} dias restantes
                    </div>
                </div>
                <div className="col-span-2">
                    {active ? (
                        <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full inline-flex items-center gap-1">
                            <CheckCircle size={12} /> Ativo
                        </span>
                    ) : (
                        <span className="text-red-400 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-full inline-flex items-center gap-1">
                            <XCircle size={12} /> Expirado
                        </span>
                    )}
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleAddDays(user.id, 7)}>
                        +7d
                    </Button>
                    <Button size="sm" onClick={() => handleAddDays(user.id, 30)}>
                        <PlusCircle size={14} /> +30d
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleExpireNow(user.id)}>
                        Expirar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 size={14} />
                    </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
