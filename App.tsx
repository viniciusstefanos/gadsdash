
import React, { useState, useEffect, useRef } from 'react';
import { AdAccount, AuthStatus, DashboardStats, Campaign, DateRange } from './types';
import { googleAds } from './services/googleAds';
import KpiCard from './components/KpiCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MOCK_ACCOUNTS: AdAccount[] = [
  { id: 'DEMO-001', name: 'Restaurante L\'Artiste (Demo)', currencyCode: 'BRL', timeZone: 'America/Sao_Paulo' },
  { id: 'DEMO-002', name: 'Pizzaria Verace (Demo)', currencyCode: 'BRL', timeZone: 'America/Sao_Paulo' }
];

const MOCK_STATS: DashboardStats = {
  current: { cost: 12450.80, conversions: 452, impressions: 89000, clicks: 4200, ctr: 0.047, cpc: 2.96, cpa: 27.54, roas: 4.8 },
  comparison: { cost: 10200.00, conversions: 380, impressions: 75000, clicks: 3100, ctr: 0.041, cpc: 3.29, cpa: 26.84, roas: 4.2 },
  trend: Array.from({ length: 30 }, (_, i) => ({
    date: `202501${String(i + 1).padStart(2, '0')}`,
    value: 300 + Math.random() * 500,
    comparisonValue: 250 + Math.random() * 400
  }))
};

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'ESTRATÉGIA: Menu Degustação (Conversão)', status: 'ENABLED', metrics: { cost: 4500, conversions: 120, impressions: 22000, clicks: 1100, ctr: 0.05, cpc: 4.09, cpa: 37.5, roas: 5.2 } },
  { id: '2', name: 'ESTRATÉGIA: Reservas Sexta/Sábado', status: 'ENABLED', metrics: { cost: 3200, conversions: 185, impressions: 34000, clicks: 1500, ctr: 0.044, cpc: 2.13, cpa: 17.29, roas: 6.1 } },
  { id: '3', name: 'TOPO DE FUNIL: Institucional & Atmosfera', status: 'ENABLED', metrics: { cost: 2800, conversions: 45, impressions: 18000, clicks: 900, ctr: 0.05, cpc: 3.11, cpa: 62.22, roas: 2.1 } },
  { id: '4', name: 'REMARKETING: Carrinho Abandonado Delivery', status: 'PAUSED', metrics: { cost: 1950.80, conversions: 102, impressions: 15000, clicks: 700, ctr: 0.046, cpc: 2.78, cpa: 19.12, roas: 4.5 } }
];

const App: React.FC = () => {
  const [status, setStatus] = useState<AuthStatus>('unauthenticated');
  const [isDemo, setIsDemo] = useState(false);
  const [developerToken, setDeveloperToken] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [showConfigGuide, setShowConfigGuide] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const clientRef = useRef<any>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('adv_client_id');
    const savedToken = localStorage.getItem('adv_dev_token');
    if (savedId) setClientId(savedId);
    if (savedToken) setDeveloperToken(savedToken);
  }, []);

  const resetAuth = () => {
    localStorage.clear();
    window.location.reload();
  };

  useEffect(() => {
    const initGsi = () => {
      const google = (window as any).google;
      if (google && clientId.trim().endsWith('.apps.googleusercontent.com')) {
        try {
          clientRef.current = google.accounts.oauth2.initTokenClient({
            client_id: clientId.trim(),
            scope: 'https://www.googleapis.com/auth/adwords',
            ux_mode: 'popup',
            callback: async (response: any) => {
              if (response.access_token) {
                setIsDemo(false);
                localStorage.setItem('adv_client_id', clientId);
                localStorage.setItem('adv_dev_token', developerToken);
                googleAds.setCredentials(response.access_token, developerToken);
                setStatus('authenticated');
                fetchAccountList();
              }
            },
          });
        } catch (err) { console.error("Erro GSI:", err); }
      }
    };

    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true; script.defer = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    } else { initGsi(); }
  }, [clientId, developerToken]);

  const fetchAccountList = async () => {
    setIsLoading(true);
    try {
      const accs = await googleAds.fetchAccounts();
      setAccounts(accs);
    } catch (err) {
      console.error(err);
      alert("Autenticado! Porém o Developer Token é inválido ou sem acesso à API.");
      setStatus('unauthenticated');
    } finally { setIsLoading(false); }
  };

  const handleLogin = () => {
    if (!clientId || !developerToken) return alert("Preencha todas as credenciais.");
    if (clientRef.current) {
      setStatus('authenticating');
      clientRef.current.requestAccessToken({ prompt: 'select_account' });
    } else {
      alert("SDK do Google não inicializado. Verifique o Client ID.");
    }
  };

  const handleDemoMode = () => {
    setIsDemo(true);
    setStatus('authenticated');
    setAccounts(MOCK_ACCOUNTS);
  };

  useEffect(() => {
    if (selectedAccountId) {
      const load = async () => {
        setIsLoading(true);
        if (isDemo) {
          setTimeout(() => {
            setDashboardData(MOCK_STATS);
            setCampaigns(MOCK_CAMPAIGNS);
            setIsLoading(false);
          }, 800);
          return;
        }
        try {
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          const diff = end.getTime() - start.getTime();
          const compStart = new Date(start.getTime() - diff).toISOString().split('T')[0];
          const compEnd = new Date(start.getTime() - 1).toISOString().split('T')[0];
          const stats = await googleAds.fetchDashboardData(selectedAccountId, dateRange, { start: compStart, end: compEnd });
          const camps = await googleAds.fetchCampaigns(selectedAccountId);
          setDashboardData(stats);
          setCampaigns(camps);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
      };
      load();
    }
  }, [selectedAccountId, dateRange, isDemo]);

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8 font-inter overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-amber-600/10 blur-[180px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-zinc-800/20 blur-[150px] rounded-full" />
        </div>

        <div className="max-w-md w-full z-10 space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <header className="text-center space-y-4">
            <h1 className="text-9xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-2xl">Saltear<span className="text-amber-600">.</span></h1>
            <p className="text-zinc-600 font-bold tracking-[0.5em] uppercase text-[10px] ml-2">Inteligência Gastronômica High-End</p>
          </header>

          <div className="bg-zinc-900/40 border border-zinc-800/50 p-12 rounded-[64px] space-y-10 backdrop-blur-3xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] relative">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-8">Google Client ID</label>
                <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value.trim())} placeholder="000-xxx.apps.googleusercontent.com" className="w-full bg-black/60 border border-zinc-800 rounded-full px-8 py-5 text-white text-xs font-mono focus:border-amber-500 outline-none transition-all placeholder:text-zinc-800" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-8">Developer Token</label>
                <input type="password" value={developerToken} onChange={(e) => setDeveloperToken(e.target.value.trim())} placeholder="Insira o Token de Acesso API" className="w-full bg-black/60 border border-zinc-800 rounded-full px-8 py-5 text-white text-xs font-mono focus:border-amber-500 outline-none transition-all placeholder:text-zinc-800" />
              </div>
            </div>

            <div className="space-y-4">
              <button onClick={handleLogin} disabled={status === 'authenticating'} className="w-full py-6 bg-white text-black rounded-full font-black text-xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-white/5">
                {status === 'authenticating' ? "CONECTANDO..." : "AUTENTICAR ADS"}
              </button>
              <button onClick={handleDemoMode} className="w-full py-5 bg-zinc-900/80 border border-zinc-800 text-zinc-500 rounded-full font-black text-[11px] uppercase tracking-[0.2em] hover:border-amber-600/50 hover:text-white transition-all active:scale-95">
                Acessar Dashboard Demo
              </button>
            </div>

            <div className="flex flex-col space-y-5 pt-6 text-center border-t border-zinc-800/50">
              <button onClick={() => setShowConfigGuide(true)} className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] hover:underline">Guia de Configuração para Netlify</button>
              <button onClick={resetAuth} className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] hover:text-rose-500 transition-colors">Limpar Cache do App</button>
            </div>
          </div>
        </div>

        {showConfigGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={() => setShowConfigGuide(false)} />
            <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[64px] p-16 shadow-2xl space-y-12 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Netlify Deploy</h2>
                  <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mt-2">Configuração crítica de produção</p>
                </div>
                <button onClick={() => setShowConfigGuide(false)} className="p-4 bg-zinc-900 rounded-full text-white hover:bg-zinc-800 transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-12">
                <section className="space-y-6">
                   <div className="flex items-start space-x-8">
                    <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-black font-black flex-shrink-0 mt-1 italic text-xl shadow-lg shadow-amber-600/20">1</div>
                    <div>
                      <h4 className="text-white font-black text-lg uppercase tracking-tight">Origens JavaScript Autorizadas</h4>
                      <p className="text-zinc-500 text-sm mt-3 leading-relaxed">No console do Google Cloud, adicione a URL exata deste deploy nas credenciais do seu Client ID:</p>
                      <div className="group mt-5 relative">
                        <code className="block bg-black p-6 rounded-3xl text-amber-500 text-[11px] border border-zinc-800 font-mono select-all break-all pr-12">
                          {window.location.origin}
                        </code>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-8">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-white font-black flex-shrink-0 mt-1 italic text-xl">2</div>
                    <div>
                      <h4 className="text-white font-black text-lg uppercase tracking-tight">Status de Publicação</h4>
                      <p className="text-zinc-500 text-sm mt-3 leading-relaxed">Vá em <b>Tela de Consentimento OAuth</b> e clique em <b>"Publicar Aplicativo"</b>. Sem isso, o login só funcionará para o seu e-mail de desenvolvedor.</p>
                    </div>
                  </div>
                </section>
                <button onClick={() => setShowConfigGuide(false)} className="w-full py-7 bg-white text-black rounded-full font-black text-sm uppercase tracking-[0.3em] hover:bg-zinc-200 transition-all shadow-xl active:scale-95">Configurações Aplicadas</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!selectedAccountId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-12 overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-amber-600/5 blur-[180px] rounded-full pointer-events-none" />
        <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter mb-24 drop-shadow-2xl">Selecionar Unidade</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-7xl w-full z-10">
          {accounts.map(acc => (
            <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)} className="group bg-zinc-900/60 border border-zinc-800 p-14 rounded-[80px] text-left hover:border-amber-600/50 hover:bg-zinc-900 transition-all flex flex-col justify-between h-[420px] shadow-2xl active:scale-95 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-600/5 rounded-full group-hover:bg-amber-600/10 transition-all" />
              <div className="w-20 h-20 bg-zinc-800 rounded-[32px] flex items-center justify-center group-hover:bg-amber-600 transition-all shadow-2xl group-hover:text-black">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <div>
                <h4 className="text-4xl font-black text-white line-clamp-2 uppercase italic leading-[0.9] tracking-tighter group-hover:text-amber-500 transition-colors">{acc.name}</h4>
                <div className="flex items-center space-x-4 mt-6">
                  <span className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.3em]">Operational ID</span>
                  <span className="text-zinc-500 text-[11px] font-mono">{acc.id}</span>
                </div>
              </div>
            </button>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-full py-32 text-center space-y-8 animate-pulse">
               <div className="w-20 h-20 border-4 border-zinc-800 border-t-amber-600 rounded-full animate-spin mx-auto" />
               <p className="text-zinc-700 font-black text-xl uppercase tracking-[0.6em] italic">Sincronizando Ativos Saltear...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-inter selection:bg-amber-600/30">
      <nav className="border-b border-zinc-900/50 bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-[60]">
        <div className="max-w-[1920px] mx-auto px-12 h-36 flex items-center justify-between">
          <div className="flex items-center space-x-16">
            <h1 className="text-5xl font-black italic text-white cursor-pointer group tracking-tighter" onClick={() => setSelectedAccountId('')}>
              SALTEAR<span className="text-amber-600 group-hover:animate-ping inline-block">.</span>
            </h1>
            <div className="h-16 w-[1px] bg-zinc-800 rotate-12" />
            <div className="flex flex-col">
               <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em]">Unidade Ativa</span>
               <span className="text-2xl font-black text-white uppercase italic tracking-tighter">
                {accounts.find(a => a.id === selectedAccountId)?.name || selectedAccountId}
               </span>
            </div>
          </div>
          <div className="flex items-center space-x-10">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-full px-12 py-5 flex items-center space-x-12 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]">
               <div className="flex items-center space-x-5 border-r border-zinc-800 pr-12">
                  <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Início</span>
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="bg-transparent border-none text-[12px] font-black text-white uppercase cursor-pointer focus:ring-0 w-32" />
               </div>
               <div className="flex items-center space-x-5">
                  <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Fim</span>
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="bg-transparent border-none text-[12px] font-black text-white uppercase cursor-pointer focus:ring-0 w-32" />
               </div>
            </div>
            <button onClick={() => setSelectedAccountId('')} className="p-6 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-rose-600/10 hover:text-rose-500 transition-all active:scale-90">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1920px] mx-auto p-16 space-y-24 pb-64">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-80 space-y-16 animate-pulse">
            <div className="relative">
              <div className="w-32 h-32 border-8 border-zinc-900 rounded-full" />
              <div className="absolute top-0 left-0 w-32 h-32 border-8 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-4xl font-black text-white uppercase italic tracking-[0.3em] drop-shadow-2xl">Cozinhando Dados...</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              <KpiCard label="Investment" value={dashboardData?.current.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0'} prefix="R$ " percentage={dashboardData ? ((dashboardData.current.cost / (dashboardData.comparison.cost || 1)) - 1) * 100 : 0} accentColor="#d97706" />
              <KpiCard label="Conversions" value={dashboardData?.current.conversions.toLocaleString('pt-BR') || '0'} percentage={dashboardData ? ((dashboardData.current.conversions / (dashboardData.comparison.conversions || 1)) - 1) * 100 : 0} accentColor="#d97706" />
              <KpiCard label="Avg. CPA" value={dashboardData?.current.cpa.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0'} prefix="R$ " percentage={dashboardData ? ((dashboardData.current.cpa / (dashboardData.comparison.cpa || 1)) - 1) * 100 : 0} accentColor="#d97706" />
              <KpiCard label="Market Share" value={dashboardData?.current.impressions.toLocaleString('pt-BR') || '0'} percentage={dashboardData ? ((dashboardData.current.impressions / (dashboardData.comparison.impressions || 1)) - 1) * 100 : 0} accentColor="#d97706" />
            </section>

            <section className="bg-zinc-900/60 border border-zinc-800 rounded-[100px] p-32 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-amber-600/5 rounded-full blur-[200px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
               <h3 className="text-7xl font-black text-white italic uppercase tracking-tighter underline decoration-amber-600 decoration-[24px] underline-offset-[-10px] mb-32 drop-shadow-2xl">Curva de Tração</h3>
               <div className="h-[700px] w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData?.trend}>
                      <defs>
                        <linearGradient id="saltearGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.5}/><stop offset="95%" stopColor="#d97706" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="0" vertical={false} stroke="#1f1f23" />
                      <XAxis dataKey="date" stroke="#3f3f46" fontSize={11} fontWeight={900} tickLine={false} axisLine={false} dy={40} tickFormatter={(val) => val ? new Date(val.slice(0,4)+'-'+val.slice(4,6)+'-'+val.slice(6,8)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).toUpperCase() : ""} />
                      <YAxis stroke="#3f3f46" fontSize={11} fontWeight={900} tickLine={false} axisLine={false} dx={-40} tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(1) + 'K' : val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000', border: '3px solid #d97706', borderRadius: '56px', padding: '40px', boxShadow: '0 50px 100px rgba(0,0,0,1)' }} 
                        itemStyle={{ color: '#fff', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase' }}
                        labelStyle={{ color: '#d97706', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '16px' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#d97706" strokeWidth={12} fillOpacity={1} fill="url(#saltearGradient)" animationDuration={2500} />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-[100px] overflow-hidden shadow-[0_80px_150px_-30px_rgba(0,0,0,1)]">
               <div className="p-32 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-zinc-900/80 via-zinc-900/40 to-transparent">
                  <div className="space-y-4">
                     <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter">Inventário Estratégico</h3>
                     <p className="text-zinc-600 font-black uppercase text-[11px] tracking-[0.5em] ml-2">Distribuição de ativos e fluxo de performance operacional.</p>
                  </div>
                  <button className="bg-white text-black px-20 py-7 rounded-full font-black text-sm uppercase tracking-[0.3em] hover:bg-zinc-200 transition-all shadow-2xl active:scale-95">Download Analytics</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-zinc-950/50 text-zinc-700 text-[11px] font-black uppercase tracking-[0.8em] border-b border-zinc-800/50">
                       <th className="px-32 py-20">Estratégia de Fluxo</th>
                       <th className="px-12 py-20">Status</th>
                       <th className="px-12 py-20 text-right">Aporte</th>
                       <th className="px-12 py-20 text-right">Conversão</th>
                       <th className="px-32 py-20 text-right">Power Score</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/30">
                     {campaigns.map(camp => (
                       <tr key={camp.id} className="group hover:bg-zinc-950 transition-all border-l-0 hover:border-l-[24px] border-amber-600 cursor-pointer">
                         <td className="px-32 py-20">
                           <span className="text-4xl font-black text-white block tracking-tighter uppercase italic group-hover:text-amber-500 transition-colors leading-none">{camp.name}</span>
                           <span className="text-zinc-800 text-[10px] font-mono tracking-widest uppercase mt-4 block">ID_STRAT_{camp.id}</span>
                         </td>
                         <td className="px-12 py-20">
                           <div className="flex items-center space-x-6">
                             <div className={`w-5 h-5 rounded-full ${camp.status === 'ENABLED' ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-zinc-800'}`} />
                             <span className="text-[13px] font-black tracking-widest uppercase text-zinc-500 group-hover:text-zinc-300 transition-colors">{camp.status}</span>
                           </div>
                         </td>
                         <td className="px-12 py-20 text-right font-black text-3xl text-zinc-200 italic tabular-nums">R$ {camp.metrics.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                         <td className="px-12 py-20 text-right font-black text-white text-5xl tabular-nums drop-shadow-xl">{camp.metrics.conversions}</td>
                         <td className="px-32 py-20 text-right">
                           <div className="flex items-center justify-end space-x-10">
                              <div className="w-48 bg-black/40 h-4 rounded-full overflow-hidden p-1 border border-zinc-800/50 shadow-inner">
                                <div 
                                  className="h-full rounded-full bg-amber-600 transition-all duration-1000 ease-out" 
                                  style={{ width: `${Math.min(100, (camp.metrics.cost / 5000) * 100)}%` }} 
                                />
                              </div>
                              <span className="text-xl font-black text-white italic tracking-tighter w-16">{Math.min(100, (camp.metrics.cost / 150)).toFixed(0)}%</span>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>
          </>
        )}
      </main>

      <footer className="max-w-[1920px] mx-auto px-12 py-48 border-t border-zinc-900 flex flex-col items-center space-y-12 opacity-30 hover:opacity-100 transition-opacity duration-1000">
         <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">Saltear<span className="text-amber-600">.</span> Strategic Master</h2>
         <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-[1em] text-center max-w-2xl leading-loose">
            Camada de inteligência executiva dedicada ao crescimento e escala de operações gastronômicas de alta performance.
         </p>
         <div className="flex items-center space-x-12 pt-12">
            <div className="h-[1px] w-32 bg-zinc-800" />
            <span className="text-[9px] font-mono text-zinc-800">ENCRYPTION_ACTIVE v2.9.0</span>
            <div className="h-[1px] w-32 bg-zinc-800" />
         </div>
      </footer>
    </div>
  );
};

export default App;
