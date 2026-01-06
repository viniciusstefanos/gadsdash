
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
        } catch (err) { console.error(err); }
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
      alert("Erro na conexão real. Verifique seu Developer Token ou use o Modo Demo.");
      setStatus('unauthenticated');
    } finally { setIsLoading(false); }
  };

  const handleLogin = () => {
    if (!clientId || !developerToken) return alert("Preencha as credenciais.");
    if (clientRef.current) {
      setStatus('authenticating');
      clientRef.current.requestAccessToken({ prompt: 'select_account' });
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8 font-inter overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-amber-600/10 blur-[150px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-zinc-800/20 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-md w-full z-10 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <header className="text-center space-y-4">
            <h1 className="text-8xl font-black text-white italic tracking-tighter uppercase leading-none">Saltear<span className="text-amber-600">.</span></h1>
            <p className="text-zinc-600 font-bold tracking-[0.4em] uppercase text-[10px]">Marketing para Restaurantes</p>
          </header>

          <div className="bg-zinc-900/40 border border-zinc-800/50 p-12 rounded-[60px] space-y-8 backdrop-blur-3xl shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-6">Google Client ID</label>
                <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value.trim())} placeholder="000-xxx.apps.googleusercontent.com" className="w-full bg-black/40 border border-zinc-800 rounded-full px-8 py-5 text-white text-xs font-mono focus:border-amber-500 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-6">Developer Token</label>
                <input type="password" value={developerToken} onChange={(e) => setDeveloperToken(e.target.value.trim())} placeholder="Token da API Google Ads" className="w-full bg-black/40 border border-zinc-800 rounded-full px-8 py-5 text-white text-xs font-mono focus:border-amber-500 outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-4">
              <button onClick={handleLogin} disabled={status === 'authenticating'} className="w-full py-6 bg-white text-black rounded-full font-black text-lg hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50">
                {status === 'authenticating' ? "SINCRO..." : "CONECTAR GOOGLE ADS"}
              </button>
              <button onClick={handleDemoMode} className="w-full py-5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full font-black text-xs uppercase tracking-widest hover:border-amber-600 hover:text-white transition-all active:scale-95">
                Dashboard Experimental (Demo)
              </button>
            </div>

            <div className="flex flex-col space-y-4 pt-4 text-center">
              <button onClick={() => setShowConfigGuide(true)} className="text-[10px] font-black text-amber-500 uppercase tracking-widest hover:underline">Configuração do Painel</button>
              <button onClick={resetAuth} className="text-[10px] font-black text-zinc-700 uppercase tracking-widest hover:text-rose-500 transition-colors">Limpar Sessão</button>
            </div>
          </div>
        </div>

        {showConfigGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setShowConfigGuide(false)} />
            <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[64px] p-16 shadow-2xl space-y-12 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-start">
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Setup Master</h2>
                <button onClick={() => setShowConfigGuide(false)} className="text-zinc-500 hover:text-white transition-colors uppercase font-black text-xs tracking-widest">Fechar</button>
              </div>
              <div className="space-y-8">
                <section className="space-y-6">
                   <div className="flex items-start space-x-6">
                    <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-black font-black flex-shrink-0 mt-1 italic">1</div>
                    <div>
                      <h4 className="text-white font-black text-sm uppercase tracking-widest">Ativação da Marca</h4>
                      <p className="text-zinc-500 text-sm mt-2 leading-relaxed">No Google Cloud, certifique-se de que a URL de origem JavaScript autorizada é: <br/><code className="text-amber-500 font-mono text-xs">{window.location.origin}</code></p>
                    </div>
                  </div>
                </section>
                <button onClick={() => setShowConfigGuide(false)} className="w-full py-6 bg-zinc-100 text-black rounded-full font-black text-sm uppercase tracking-widest">Entendido</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!selectedAccountId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/5 blur-[150px] rounded-full" />
        <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-20">Selecionar Unidade</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl w-full z-10">
          {accounts.map(acc => (
            <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)} className="group bg-zinc-900 border border-zinc-800 p-12 rounded-[64px] text-left hover:border-amber-600 transition-all flex flex-col justify-between h-[360px] shadow-2xl active:scale-95 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-600/5 rounded-full group-hover:bg-amber-600/10 transition-all" />
              <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center group-hover:bg-amber-600 transition-all shadow-xl group-hover:text-black">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <div>
                <h4 className="text-3xl font-black text-white line-clamp-2 uppercase italic leading-none">{acc.name}</h4>
                <p className="text-zinc-600 text-[10px] font-mono mt-4 uppercase tracking-widest">UNIT_ID: {acc.id}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-inter">
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-[60]">
        <div className="max-w-[1800px] mx-auto px-10 h-32 flex items-center justify-between">
          <div className="flex items-center space-x-12">
            <h1 className="text-4xl font-black italic text-white cursor-pointer" onClick={() => setSelectedAccountId('')}>SALTEAR<span className="text-amber-600">.</span></h1>
            <div className="flex flex-col border-l border-zinc-800 pl-12">
               <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Unidade Operacional</span>
               <span className="text-xl font-black text-white uppercase italic">{accounts.find(a => a.id === selectedAccountId)?.name || selectedAccountId}</span>
            </div>
          </div>
          <div className="flex items-center space-x-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-full px-10 py-4 flex items-center space-x-10 shadow-2xl shadow-black/40">
               <div className="flex items-center space-x-4 border-r border-zinc-800 pr-10">
                  <span className="text-[10px] text-zinc-600 font-black uppercase">De</span>
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="bg-transparent border-none text-[11px] font-black text-white uppercase cursor-pointer focus:ring-0" />
               </div>
               <div className="flex items-center space-x-4">
                  <span className="text-[10px] text-zinc-600 font-black uppercase">Até</span>
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="bg-transparent border-none text-[11px] font-black text-white uppercase cursor-pointer focus:ring-0" />
               </div>
            </div>
            <button onClick={() => setSelectedAccountId('')} className="p-5 bg-zinc-900 border border-zinc-800 rounded-full hover:text-amber-500 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1800px] mx-auto p-12 space-y-20 pb-48">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-64 space-y-12 animate-pulse">
            <div className="w-24 h-24 border-8 border-zinc-900 border-t-amber-600 rounded-full animate-spin" />
            <p className="text-3xl font-black text-white uppercase italic tracking-[0.2em]">Cozinhando Dados...</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              <KpiCard label="Investimento" value={dashboardData?.current.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0'} prefix="R$ " percentage={dashboardData ? ((dashboardData.current.cost / (dashboardData.comparison.cost || 1)) - 1) * 100 : 0} accentColor="#d97706" />
              <KpiCard label="Conversões" value={dashboardData?.current.conversions.toLocaleString('pt-BR') || '0'} percentage={dashboardData ? ((dashboardData.current.conversions / (dashboardData.comparison.conversions || 1)) - 1) * 100 : 0} accentColor="#d97706" />
              <KpiCard label="CPA Médio" value={dashboardData?.current.cpa.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0'} prefix="R$ " percentage={dashboardData ? ((dashboardData.current.cpa / (dashboardData.comparison.cpa || 1)) - 1) * 100 : 0} accentColor="#d97706" />
              <KpiCard label="Alcance" value={dashboardData?.current.impressions.toLocaleString('pt-BR') || '0'} percentage={dashboardData ? ((dashboardData.current.impressions / (dashboardData.comparison.impressions || 1)) - 1) * 100 : 0} accentColor="#d97706" />
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-[80px] p-24 shadow-inner relative overflow-hidden group">
               <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter underline decoration-amber-600 decoration-[16px] underline-offset-[-8px] mb-24">Curva de Tração</h3>
               <div className="h-[600px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData?.trend}>
                      <defs>
                        <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.4}/><stop offset="95%" stopColor="#d97706" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="0" vertical={false} stroke="#1f1f23" />
                      <XAxis dataKey="date" stroke="#3f3f46" fontSize={10} fontWeight={900} tickLine={false} axisLine={false} dy={30} tickFormatter={(val) => val ? new Date(val.slice(0,4)+'-'+val.slice(4,6)+'-'+val.slice(6,8)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).toUpperCase() : ""} />
                      <YAxis stroke="#3f3f46" fontSize={10} fontWeight={900} tickLine={false} axisLine={false} dx={-30} tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(1) + 'K' : val}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '2px solid #d97706', borderRadius: '48px', padding: '30px' }} />
                      <Area type="monotone" dataKey="value" stroke="#d97706" strokeWidth={10} fillOpacity={1} fill="url(#premiumGradient)" animationDuration={2000} />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-[80px] overflow-hidden shadow-2xl">
               <div className="p-24 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-zinc-900/50 to-transparent">
                  <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Inventário Estratégico</h3>
                  <button className="bg-white text-black px-16 py-6 rounded-full font-black text-xs uppercase tracking-[0.3em] hover:bg-zinc-200 transition-all shadow-2xl active:scale-95">Relatório PDF</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-zinc-950/50 text-zinc-600 text-[11px] font-black uppercase tracking-[0.6em] border-b border-zinc-800/50">
                       <th className="px-24 py-16">Estratégia de Fluxo</th>
                       <th className="px-10 py-16">Estado</th>
                       <th className="px-10 py-16 text-right">Aporte</th>
                       <th className="px-10 py-16 text-right">Conversão</th>
                       <th className="px-24 py-16 text-right">Score Saltear</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/40">
                     {campaigns.map(camp => (
                       <tr key={camp.id} className="group hover:bg-zinc-950 transition-all border-l-0 hover:border-l-[16px] border-amber-600 cursor-pointer">
                         <td className="px-24 py-16">
                           <span className="text-3xl font-black text-white block tracking-tighter uppercase italic group-hover:text-amber-500 transition-colors">{camp.name}</span>
                           <span className="text-zinc-700 text-[9px] font-mono tracking-widest uppercase mt-2 block">STRAT_CORE_{camp.id}</span>
                         </td>
                         <td className="px-10 py-16">
                           <div className="flex items-center space-x-5">
                             <div className={`w-4 h-4 rounded-full ${camp.status === 'ENABLED' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-zinc-800'}`} />
                             <span className="text-[12px] font-black tracking-widest uppercase text-zinc-400">{camp.status}</span>
                           </div>
                         </td>
                         <td className="px-10 py-16 text-right font-black text-2xl text-zinc-200 italic">R$ {camp.metrics.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                         <td className="px-10 py-16 text-right font-black text-white text-3xl">{camp.metrics.conversions}</td>
                         <td className="px-24 py-16 text-right font-black text-white italic">{Math.min(100, (camp.metrics.cost / 150)).toFixed(0)}%</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
