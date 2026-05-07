import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, TrendingUp, CheckCircle2, Shield, 
  Target, BarChart2, RefreshCcw, XCircle, CheckCircle, 
  ArrowDown, ArrowUp, Star, Quote, ShieldCheck, Plus, Minus,
  Zap, Lock, Table
} from 'lucide-react';
import { Logo } from './ui/Logo';

interface LandingPageProps {
  onGetStarted: () => void;
}

// --- EFEITOS VISUAIS ---

const BackgroundEffects = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {/* Grid Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    
    {/* Moving Orbs */}
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/10 rounded-full blur-[120px] animate-pulse-slow mix-blend-screen"></div>
    <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] animate-pulse mix-blend-screen"></div>
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-dark-900/50 rounded-full blur-[100px]"></div>
  </div>
);

// --- SUB-COMPONENTES ---

const Button = ({ variant = 'primary', children, className = '', ...props }: any) => {
  const baseStyles = "px-6 py-2.5 rounded-lg font-bold transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wide relative overflow-hidden group";
  const variants = {
    primary: "bg-gold-gradient text-dark-950 shadow-[0_0_20px_rgba(227,188,83,0.3)] hover:shadow-[0_0_30px_rgba(227,188,83,0.5)] border border-transparent",
    outline: "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-gold-500/50 hover:text-gold-400 backdrop-blur-sm"
  };
  return (
    <button className={`${baseStyles} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {variant === 'primary' && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
    </button>
  );
};

// --- SEÇÕES ---

const Header = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-3 bg-dark-950/80 backdrop-blur-xl border-b border-gold-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]' : 'py-6 bg-transparent border-b border-transparent'}`}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Logo className={`transition-transform duration-300 ${scrolled ? 'scale-90' : 'scale-100'}`} />
        <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium uppercase tracking-widest text-gray-400">
                <button onClick={() => scrollToSection('features')} className="hover:text-gold-400 transition-colors bg-transparent border-none cursor-pointer">Funcionalidades</button>
                <button onClick={() => scrollToSection('testimonials')} className="hover:text-gold-400 transition-colors bg-transparent border-none cursor-pointer">Depoimentos</button>
            </nav>
            <div className="h-4 w-px bg-white/10 hidden md:block"></div>
            <Button onClick={onGetStarted} variant="outline" className="flex items-center gap-2 px-5 py-2 text-xs md:text-xs">
              <Lock className="w-3 h-3" />
              <span>acessar sistema</span>
            </Button>
        </div>
      </div>
    </header>
  );
};

const Hero = ({ onGetStarted }: { onGetStarted: () => void }) => (
  <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 lg:pt-52 lg:pb-40 overflow-hidden">
    <div className="container mx-auto px-4 md:px-6 relative z-10">
      <div className="flex flex-col items-center gap-12 lg:gap-20">
        
        {/* Text Content */}
        <div className="w-full max-w-5xl space-y-8 text-center flex flex-col items-center">
          <div data-reveal className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-[10px] font-bold uppercase tracking-widest animate-fade-in mb-4">
            <Zap className="w-3 h-3 fill-current" /> Nova Versão 2.0 Disponível
          </div>
          
          <h1 data-reveal className="text-5xl sm:text-7xl md:text-8xl font-black text-white leading-[0.95] tracking-tighter drop-shadow-2xl">
            Pare de Operar <br />
            <span className="text-transparent bg-clip-text bg-gold-gradient relative">
               Como Amador
               <svg className="absolute w-full h-3 -bottom-1 left-0 text-gold-500 opacity-40" viewBox="0 0 200 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.00024 7.00003C51.6423 2.09456 127.357 -3.00767 197.999 4.90803" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
            </span>
          </h1>
          
          <p data-reveal className="text-gray-400 text-base md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
            O único sistema que alinha <strong className="text-gray-100">Matemática</strong>, <strong className="text-gray-100">Probabilidade</strong> e <strong className="text-gray-100">Psicologia</strong> para blindar seu capital contra a quebra.
          </p>
          
          <div data-reveal className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-6 w-full">
            <Button onClick={onGetStarted} className="w-full sm:w-auto h-14 px-10 text-base shadow-[0_0_50px_rgba(212,175,55,0.25)] animate-pulse-slow">
                COMEÇAR AGORA
            </Button>
            <div className="flex items-center gap-3 text-xs text-gray-500 font-medium bg-dark-900/50 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
              <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-black border border-gray-600 flex items-center justify-center text-[8px] text-white font-bold relative z-10">
                           {i === 3 ? '99+' : <CheckCircle2 className="w-3 h-3 text-gold-500" />}
                      </div>
                  ))}
              </div>
              <span>Junte-se a 1.2k+ Gestores</span>
            </div>
          </div>
        </div>

        {/* Dynamic Dashboard Preview */}
        <div data-reveal className="w-full max-w-4xl relative perspective-1000 group">
           {/* Glow behind card */}
           <div className="absolute -inset-1 bg-gradient-to-r from-gold-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
           
           <div className="relative rounded-2xl bg-dark-900 border border-white/10 shadow-2xl overflow-hidden transform transition-transform duration-500 hover:rotate-x-2">
            
            {/* Fake Browser Header */}
            <div className="h-12 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center px-6 gap-2 justify-between">
              <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
              </div>
              <div className="px-4 py-1 rounded-full bg-white/5 text-[10px] text-gray-500 font-mono border border-white/5">app.gestaodebanca.com</div>
            </div>

            {/* Dashboard Content Mockup */}
            <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-6 bg-dark-900/90 backdrop-blur-sm">
               {/* Stats Left */}
               <div className="space-y-4 md:col-span-1">
                  <div className="p-4 rounded-xl bg-dark-800 border border-white/5 space-y-2">
                      <div className="text-xs text-gray-500 uppercase font-bold">Saldo Atual</div>
                      <div className="text-2xl font-black text-white">$ 2,450.00</div>
                      <div className="text-xs text-green-400 flex items-center gap-1">+12% hoje</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gold-500/5 border border-gold-500/10 space-y-2">
                      <div className="text-xs text-gold-500 uppercase font-bold">Meta Diária</div>
                      <div className="h-2 w-full bg-dark-950 rounded-full overflow-hidden">
                          <div className="h-full w-[85%] bg-gold-500"></div>
                      </div>
                      <div className="text-right text-xs text-gold-400 font-mono">85% Concluído</div>
                  </div>
               </div>

               {/* Chart Area Right */}
               <div className="md:col-span-2 p-4 rounded-xl bg-dark-800 border border-white/5 relative overflow-hidden flex flex-col justify-between">
                   <div className="flex justify-between items-center mb-4">
                       <span className="text-xs font-bold text-gray-400 uppercase">Performance</span>
                       <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 font-bold border border-green-500/20">WIN: $125.00</span>
                   </div>
                   {/* Abstract Chart Lines */}
                   <div className="relative h-32 w-full">
                       <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                           <defs>
                               <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                   <stop offset="0%" style={{stopColor:'#D4AF37', stopOpacity:0.2}} />
                                   <stop offset="100%" style={{stopColor:'#D4AF37', stopOpacity:0}} />
                               </linearGradient>
                           </defs>
                           <path d="M0,80 C50,80 50,40 100,40 C150,40 150,90 200,90 C250,90 250,20 300,20" fill="none" stroke="#D4AF37" strokeWidth="2" />
                           <circle cx="300" cy="20" r="4" fill="#D4AF37" className="animate-ping" />
                           <circle cx="300" cy="20" r="3" fill="#fff" />
                       </svg>
                   </div>
                   <div className="absolute inset-0 bg-gradient-to-t from-dark-800 to-transparent"></div>
               </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  </section>
);

const PainPoints = () => (
  <section className="py-20 bg-dark-950/50 relative border-t border-white/5">
    <div className="container mx-auto px-4 md:px-6">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
             <span className="text-red-500 font-bold tracking-widest uppercase text-xs mb-2 block">O Problema Real</span>
             <h2 data-reveal className="text-3xl md:text-5xl font-bold text-white">Por que 95% <br/> <span className="text-gray-500">devolvem o lucro?</span></h2>
          </div>
          <p data-reveal className="text-gray-400 max-w-sm text-sm leading-relaxed border-l border-white/10 pl-6">
              Não é falta de operacional, é falta de comportamento. Identifique onde você está errando.
          </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
          {[
              { icon: XCircle, color: "text-red-500", title: "O Vício da Recuperação", desc: "Tentar recuperar um loss imediatamente é a maneira mais rápida de quebrar a banca. O sistema trava isso." },
              { icon: ArrowDown, color: "text-orange-500", title: "Entradas Aleatórias", desc: "Definir valor da entrada baseado no 'feeling' em vez de um percentual matemático fixo." },
              { icon: Target, color: "text-gray-400", title: "Falta de Metas", desc: "Quem não sabe onde quer chegar, não para quando ganha e nem quando perde." }
          ].map((item, i) => (
              <div key={i} data-reveal className="p-8 rounded-2xl bg-dark-900 border border-white/5 hover:border-white/10 transition-colors group">
                  <div className={`p-3 rounded-lg bg-white/5 w-fit mb-6 ${item.color} group-hover:scale-110 transition-transform`}>
                      <item.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
          ))}
      </div>
    </div>
  </section>
);

const Features = () => {
  const FeatureCard = ({ icon, title, description }: any) => (
    <div data-reveal className="group relative p-8 rounded-2xl bg-dark-900 border border-white/5 overflow-hidden transition-all duration-300 hover:border-gold-500/30 hover:shadow-glow hover:-translate-y-1">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="text-gold-500 -rotate-45" />
      </div>
      <div className="mb-6 text-gold-400 bg-gold-500/10 w-12 h-12 flex items-center justify-center rounded-xl border border-gold-500/20 group-hover:bg-gold-500 group-hover:text-black transition-colors">
          {icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-dark-900/50 transform -skew-y-3 z-0 origin-top-left scale-110"></div>
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="text-gold-400 font-bold tracking-widest uppercase text-xs mb-2 block">Tecnologia Embarcada</span>
          <h2 data-reveal className="text-4xl font-black text-white">Controle Absoluto</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <FeatureCard icon={<Shield size={24} />} title="Modo Branco" description="Blindagem patrimonial. Algoritmo conservador que protege seu capital principal." />
          <FeatureCard icon={<Target size={24} />} title="Modo Dólar" description="Focado em metas cíclicas. O sistema calcula o esforço necessário para atingir o objetivo." />
          <FeatureCard icon={<BarChart2 size={24} />} title="Modo Velas" description="Análise adaptativa. Aumenta a mão em tendências de alta e protege em tendências de baixa." />
          <FeatureCard icon={<RefreshCcw size={24} />} title="Modo Cores" description="Recuperação inteligente baseada em probabilidade visual (Martingale controlado)." />
          <FeatureCard icon={<Table size={24} />} title="Modo Planilha" description="Planejamento visual com metas diárias e marcações por período." />
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => (
  <section id="testimonials" className="py-24 bg-black border-t border-white/5">
    <div className="container mx-auto px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16">
          <h2 data-reveal className="text-3xl font-bold text-white">Resultados Reais</h2>
          <div className="flex gap-1 text-gold-500">
              {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="currentColor" />)}
              <span className="text-gray-500 text-sm ml-2">4.9/5 de satisfação</span>
          </div>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {[
          { name: "Lucas M.", role: "Trader Forex", quote: "A disciplina que o painel impõe é absurda. Eu parei de devolver lucro na sexta-feira." },
          { name: "Amanda S.", role: "Opções Binárias", quote: "O Modo Dólar mudou minha vida. Saber exatamente quanto buscar tira o peso das costas." },
          { name: "Roberto F.", role: "Cripto Investidor", quote: "Simples, direto e matemático. Sem promessas falsas, apenas gestão pura." }
        ].map((t, i) => (
          <div key={i} data-reveal className="bg-white/5 p-8 rounded-2xl border border-white/5 relative">
             <Quote className="absolute top-8 right-8 text-white/10 w-8 h-8" />
             <p className="text-gray-300 text-lg leading-relaxed mb-6">"{t.quote}"</p>
             <div>
                 <div className="text-white font-bold">{t.name}</div>
                 <div className="text-gold-500 text-xs uppercase font-bold tracking-wide">{t.role}</div>
             </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Pricing = ({ onGetStarted }: { onGetStarted: () => void }) => (
  <section className="py-24 relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-5xl bg-gold-500/5 blur-[100px] rounded-full pointer-events-none"></div>
    <div className="container mx-auto px-4 md:px-6 relative z-10">
      <div data-reveal className="max-w-5xl mx-auto rounded-[2.5rem] bg-dark-900 border border-white/10 p-8 md:p-16 text-center shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"></div>
         
         <div className="mb-8">
             <span className="text-gold-400 font-bold uppercase tracking-[0.3em] text-xs">Assinatura Pro</span>
             <h2 data-reveal className="text-5xl md:text-7xl font-black text-white mt-4 tracking-tighter">
                Profissionalize <br/> <span className="text-transparent bg-clip-text bg-gold-gradient">Sua Gestão</span>
             </h2>
         </div>

         <div className="flex flex-col md:flex-row justify-center items-center gap-12 my-12">
             <div className="text-left space-y-4">
                 <div className="flex items-center gap-3 text-gray-300"><CheckCircle className="text-gold-500 w-5 h-5" /> <span>Todos os 4 Modos Operacionais</span></div>
                 <div className="flex items-center gap-3 text-gray-300"><CheckCircle className="text-gold-500 w-5 h-5" /> <span>Dashboard em Tempo Real</span></div>
                 <div className="flex items-center gap-3 text-gray-300"><CheckCircle className="text-gold-500 w-5 h-5" /> <span>Cancele quando quiser</span></div>
             </div>
             <div className="h-24 w-px bg-white/10 hidden md:block"></div>
             <div className="text-center">
                 <div className="text-sm text-gray-500 line-through mb-1">R$ 49,90</div>
                 <div className="text-6xl font-black text-white flex items-start justify-center">
                    <span className="text-2xl mt-2 mr-1">R$</span>
                    19,99
                    <span className="text-xl mt-auto mb-2 ml-1 text-gray-400 font-medium">/mês</span>
                 </div>
                 <div className="text-xs text-green-400 font-bold uppercase mt-2 bg-green-500/10 py-1 px-2 rounded">Assinatura Mensal</div>
             </div>
         </div>

         <Button onClick={onGetStarted} className="w-full md:w-auto px-16 h-16 text-lg shadow-glow hover:scale-105 transition-transform duration-300">
             QUERO ACESSO IMEDIATO
         </Button>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/5 bg-black pt-20 pb-10">
    <div className="container mx-auto px-6">
      <div className="flex flex-col items-center text-center mb-12">
          {/* Logo centralizada, mas com texto alinhado internamente devido à mudança no componente Logo */}
          <Logo className="scale-125 mb-8" />
          <p data-reveal className="text-gray-500 text-sm max-w-md leading-relaxed">
            Plataforma desenvolvida para operadores que entendem que o segredo não é o setup, mas o gerenciamento de risco.
          </p>
      </div>
      <div className="border-t border-white/5 pt-8 flex justify-center items-center">
          <p className="text-xs text-gray-600 text-center">&copy; 2026 Gestão de Banca. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);

// --- COMPONENTE PRINCIPAL ---

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-dark-950 text-gray-200 selection:bg-gold-500/30 selection:text-gold-400 overflow-x-hidden font-sans relative">
      <BackgroundEffects />
      <Header onGetStarted={onGetStarted} />
      <main className="relative z-10">
        <Hero onGetStarted={onGetStarted} />
        <PainPoints />
        <Features />
        <Testimonials />
        <Pricing onGetStarted={onGetStarted} />
      </main>
      <Footer />
    </div>
  );
};
