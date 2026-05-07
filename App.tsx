import React, { useState } from 'react';
import { BankrollProvider, useBankroll } from './context/BankrollContext';
import { AppView } from './types';
import { LayoutGrid, TrendingUp, DollarSign, CandlestickChart, Palette, Settings as SettingsIcon, Menu, X, ChevronRight, LogOut, Zap, ShieldAlert, Mail, Table } from 'lucide-react';
const Dashboard = React.lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const Settings = React.lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));
const WhiteMode = React.lazy(() => import('./components/modes/WhiteMode').then((m) => ({ default: m.WhiteMode })));
const DollarMode = React.lazy(() => import('./components/modes/DollarMode').then((m) => ({ default: m.DollarMode })));
const CandleMode = React.lazy(() => import('./components/modes/CandleMode').then((m) => ({ default: m.CandleMode })));
const ColorMode = React.lazy(() => import('./components/modes/ColorMode').then((m) => ({ default: m.ColorMode })));
const PlanilhaMode = React.lazy(() => import('./components/modes/PlanilhaMode').then((m) => ({ default: m.PlanilhaMode })));
const Auth = React.lazy(() => import('./components/Auth').then((m) => ({ default: m.Auth })));
const LandingPage = React.lazy(() => import('./components/LandingPage').then((m) => ({ default: m.LandingPage })));
const SubscriptionPage = React.lazy(() => import('./components/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })));
const AdminPanel = React.lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
import { Logo } from './components/ui/Logo';
const PasswordReset = React.lazy(() => import('./components/PasswordReset').then((m) => ({ default: m.PasswordReset })));
import { Toaster } from 'react-hot-toast';
import { useRevealOnScroll } from './lib/useRevealOnScroll';

const ViewLoader: React.FC = () => (
  <div className="h-[40vh] w-full flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold-500"></div>
  </div>
);

// Inner component to access context
const AppContent: React.FC = () => {
  const { theme, session, loading, signOut, isSubscribed, isAdmin, usdToBrlRate, usdToBrlUpdatedAt } = useBankroll();
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);
    const type = hashParams.get('type') || searchParams.get('type');
    return type === 'recovery';
  });

  useRevealOnScroll([
    view,
    session?.user?.id,
    loading,
    isSubscribed,
    showAuth,
    passwordRecovery,
  ]);

  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutGrid },
    { id: AppView.MODE_WHITE, label: 'Modo Conservador', icon: TrendingUp },
    { id: AppView.MODE_DOLLAR, label: 'Modo Metas', icon: DollarSign },
    { id: AppView.MODE_CANDLE, label: 'Modo Exponencial', icon: CandlestickChart },
    { id: AppView.MODE_COLOR, label: 'Modo Cores (Visual)', icon: Palette },
    { id: AppView.MODE_PLANILHA, label: 'Modo Planilha', icon: Table },
    { id: AppView.SETTINGS, label: 'Ajustes', icon: SettingsIcon },
  ];

  // Adiciona item de Admin se for admin
  if (isAdmin) {
      navItems.push({ id: AppView.ADMIN, label: 'Admin Panel', icon: ShieldAlert });
  }

  if (passwordRecovery) {
    return (
      <React.Suspense fallback={<ViewLoader />}>
        <PasswordReset
          onBack={() => {
            setPasswordRecovery(false);
            setShowAuth(true);
          }}
          onComplete={() => {
            setPasswordRecovery(false);
            setShowAuth(true);
          }}
        />
      </React.Suspense>
    );
  }

  // 1. Loading State
  if (loading) {
    return (
        <div className="h-screen w-full bg-dark-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
        </div>
    );
  }

  // 2. Unauthenticated State (Landing or Auth)
  if (!session) {
    if (showAuth) {
        return <React.Suspense fallback={<ViewLoader />}><Auth onBack={() => setShowAuth(false)} /></React.Suspense>;
    }
    return <React.Suspense fallback={<ViewLoader />}><LandingPage onGetStarted={() => setShowAuth(true)} /></React.Suspense>;
  }

  // 3. Authenticated BUT No Subscription (Paywall)
  // Admin bypasses subscription check
  if (!isSubscribed) {
      return <React.Suspense fallback={<ViewLoader />}><SubscriptionPage /></React.Suspense>;
  }

  // 4. Authenticated & Subscribed (Main App)
  const handleNav = (id: AppView) => {
    setView(id);
    setMobileMenuOpen(false);
  };

  const renderView = () => {
    switch(view) {
      case AppView.DASHBOARD: return <Dashboard />;
      case AppView.MODE_WHITE: return <WhiteMode />;
      case AppView.MODE_DOLLAR: return <DollarMode />;
      case AppView.MODE_CANDLE: return <CandleMode />;
      case AppView.MODE_COLOR: return <ColorMode />;
      case AppView.MODE_PLANILHA: return <PlanilhaMode />;
      case AppView.SETTINGS: return <Settings />;
      case AppView.ADMIN: return isAdmin ? <AdminPanel /> : <Dashboard />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className={`h-screen w-full flex flex-col lg:flex-row bg-dark-950 text-gray-100 overflow-hidden font-sans selection:bg-gold-500 selection:text-black ${theme}`}>
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-dark-900/80 backdrop-blur-lg border-b border-white/5 p-4 flex items-center justify-between shadow-lg z-30 shrink-0 relative">
        <Logo />
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white hover:text-gold-400 transition-colors">
           {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-dark-950/90 backdrop-blur-xl border-r border-white/5 shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full lg:shadow-none
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col relative">
             {/* Mobile Close Button */}
            <div className="lg:hidden absolute top-4 right-4">
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>

          {/* Brand Logo */}
          <div className="p-8 pb-4">
             <Logo />
             <div className="mt-4 flex items-center gap-2 text-gray-400 bg-white/5 p-2 rounded-lg border border-white/5">
                <Mail size={12} className="shrink-0" />
                <p className="text-[10px] font-mono truncate">{session.user.email}</p>
             </div>
             
             <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                <Zap size={10} /> Plano PRO {isAdmin ? 'ADMIN' : 'Ativo'}
             </div>
          </div>

          <div className="px-6 py-2">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-4 space-y-2 py-6 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`group relative w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300
                    ${isActive 
                      ? 'bg-gold-500/10 border border-gold-500/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon 
                      size={20} 
                      className={`transition-colors duration-300 ${isActive ? 'text-gold-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 'text-gray-500 group-hover:text-white'}`} 
                    />
                    <span className={`font-medium text-sm tracking-wide ${isActive ? 'translate-x-1 text-gold-100' : ''} transition-transform`}>
                      {item.label}
                    </span>
                  </div>
                  {isActive && <ChevronRight size={16} className="text-gold-400 animate-pulse" />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 bg-black/20 space-y-4">
             <button 
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm font-bold bg-red-500/5 hover:bg-red-500/10 py-3 rounded-xl border border-red-500/10 transition-all"
             >
                <LogOut size={16} /> Sair do Sistema
             </button>

             <div className="flex flex-col items-center justify-center text-center">
               <div className="flex items-center gap-2">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs text-emerald-500 font-mono">ONLINE (Cloud)</span>
               </div>
               <div className="mt-2 text-[10px] text-gray-400 font-mono">
                  USD/BRL {usdToBrlRate.toFixed(4)}
               </div>
               {usdToBrlUpdatedAt && (
                 <div className="text-[10px] text-gray-500 font-mono">
                   Atualizado {new Date(usdToBrlUpdatedAt).toLocaleTimeString('pt-BR')}
                 </div>
               )}
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto bg-dark-950 relative scroll-smooth">
        {/* Ambient Glow Effects */}
        <div className="fixed top-0 left-1/2 w-[600px] h-[600px] bg-premium-glow blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"></div>
        <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-blue-900/10 blur-[150px] pointer-events-none z-0"></div>

         <div className="relative z-10 p-4 lg:p-10 max-w-6xl mx-auto pb-24 animate-fade-in">
           <React.Suspense fallback={<ViewLoader />}>
             {renderView()}
           </React.Suspense>
         </div>
      </main>

      {/* Overlay for Mobile */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BankrollProvider>
      <AppContent />
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#121212', color: '#f5f5f5', border: '1px solid rgba(255,255,255,0.08)' } }} />
    </BankrollProvider>
  );
};

export default App;
