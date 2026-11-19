import { Link } from "react-router-dom";
import { LayoutDashboard, Pizza, Armchair, ChefHat, TrendingUp, Wrench, MonitorCog } from "lucide-react";
// Importações do PrimeReact
import { TabView, TabPanel } from 'primereact/tabview';
import PainelAnalitico from "./PainelAnalitico";
import "../styles/dashboardGerente.css";
import {useFaturamentoDiario} from "../hooks/useDadosArquivo.ts";
import { useDataFinanceira } from '../hooks/useDataFinanceira';

export default function DashboardGerente() {
    const hojeStr = useDataFinanceira();

    const { data: faturamentoDia, isPending, isFetching, isError, isSuccess, refetch } = useFaturamentoDiario(hojeStr);

    return (
        <div className="dashboard-container animate-fade-in">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><MonitorCog/> Centro de controle da Pizzaria Mauá <Wrench /></h1>
                    <p className="dashboard-subtitle">Navegue pelas diferentes abas para acessar módulos de informações e controles.</p>
                </div>
            </header>

            {/* O TabView cria a estrutura de abas automaticamente */}
            <TabView>
                {/* ABA 1: O seu hub de navegação atual */}
                <TabPanel header="Visão Geral" leftIcon="pi pi-home mr-2">

                    <section className="dashboard-metrics-grid mt-4">
                        <div className="metric-card">
                            <div className="metric-icon-wrapper" style={{ backgroundColor: '#fff0f0', color: '#e53935' }}>
                                <TrendingUp size={24} />
                            </div>
                            <div className="metric-info">
                                <h3>Caixa - Vendas de Hoje</h3>
                                <p role="status">{isError ? 'Indisponível' : isPending ? 'Carregando...' :
                                    isSuccess && faturamentoDia !== undefined ? `R$ ${faturamentoDia.toFixed(2)}` : 'Indisponível'}</p>
                                <button type="button" aria-busy={isFetching} aria-disabled={isFetching}
                                    onClick={() => { if (!isFetching) void refetch(); }}>Atualizar faturamento</button>
                                <span className="metric-hint">Acesse o caixa para detalhes</span>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-icon-wrapper" style={{ backgroundColor: '#f0f4ff', color: '#3b82f6' }}>
                                <Armchair size={24} />
                            </div>
                            <div className="metric-info">
                                <h3>Status do Salão</h3>
                                <p>Gestão de Mesas</p>
                                <span className="metric-hint">Acesse para atualizar status</span>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-icon-wrapper" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                                <ChefHat size={24} />
                            </div>
                            <div className="metric-info">
                                <h3>Fila de Produção</h3>
                                <p>Cozinha Ativa</p>
                                <span className="metric-hint">Acompanhe os pedidos em tempo real</span>
                            </div>
                        </div>
                    </section>

                    <h2 className="section-title mt-4">
                        <LayoutDashboard size={20} /> Acesso Rápido
                    </h2>

                    <div className="quick-access-grid">
                        <Link to="/produtos" className="quick-access-card">
                            <div className="quick-access-icon"><Pizza size={32} /></div>
                            <h3>Gerir Cardápio</h3>
                            <p>Adicione, edite ou altere o status de produtos.</p>
                        </Link>
                        <Link to="/mesas" className="quick-access-card">
                            <div className="quick-access-icon"><Armchair size={32} /></div>
                            <h3>Mapa de Mesas</h3>
                            <p>Controle quem está consumindo no salão.</p>
                        </Link>
                        <Link to="/pedidos" className="quick-access-card">
                            <div className="quick-access-icon"><ChefHat size={32} /></div>
                            <h3>Visão da Cozinha</h3>
                            <p>Verifique o andamento dos preparos.</p>
                        </Link>
                    </div>

                </TabPanel>

                {/* ABA 2: O novo painel inteligente */}
                <TabPanel header="Inteligência de Negócio" leftIcon="pi pi-chart-bar mr-2">
                    <PainelAnalitico />
                </TabPanel>
            </TabView>
        </div>
    );
}
