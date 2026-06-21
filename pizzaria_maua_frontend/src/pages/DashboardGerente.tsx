import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { LayoutDashboard, Pizza, Armchair, ChefHat, TrendingUp } from "lucide-react";
import "../styles/dashboardGerente.css";

export default function DashboardGerente() {
    const { user } = useContext(AuthContext);

    // Fallback amigável caso o nome não esteja disponível no contexto
    const nomeGerente = user?.username || "Gestor";

    return (
        <div className="dashboard-container animate-fade-in">
            {/* Cabeçalho da Dashboard */}
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Olá, {nomeGerente}! 👋</h1>
                    <p className="dashboard-subtitle">Bem-vindo ao centro de controle da Pizzaria Mauá.</p>
                </div>
            </header>

            {/* Grid de Métricas (Visão Geral) */}
            <section className="dashboard-metrics-grid">
                <div className="metric-card">
                    <div className="metric-icon-wrapper" style={{ backgroundColor: '#fff0f0', color: '#e53935' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="metric-info">
                        <h3>Vendas de Hoje</h3>
                        <p>R$ ---,--</p>
                        <span className="metric-hint">Módulo financeiro em breve</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon-wrapper" style={{ backgroundColor: '#f0f4ff', color: '#3b82f6' }}>
                        <Armchair size={24} />
                    </div>
                    <div className="metric-info">
                        <h3>Status do Salão</h3>
                        <p>Gestão de Mesas</p>
                        <span className="metric-hint">Acesse para atualizar ocupação</span>
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

            {/* Navegação por Cards (Acesso Rápido) */}
            <h2 className="section-title">
                <LayoutDashboard size={20} /> Acesso Rápido
            </h2>

            <div className="quick-access-grid">
                <Link to="/produtos" className="quick-access-card">
                    <div className="quick-access-icon"><Pizza size={32} /></div>
                    <h3>Gerir Cardápio</h3>
                    <p>Adicione, edite ou altere o status de produtos e estoque.</p>
                </Link>

                <Link to="/mesas" className="quick-access-card">
                    <div className="quick-access-icon"><Armchair size={32} /></div>
                    <h3>Mapa de Mesas</h3>
                    <p>Adicione novas mesas ao salão e controle quem está consumindo.</p>
                </Link>

                <Link to="/pedidos" className="quick-access-card">
                    <div className="quick-access-icon"><ChefHat size={32} /></div>
                    <h3>Visão da Cozinha</h3>
                    <p>Espelhe a tela da cozinha para verificar o andamento dos preparos.</p>
                </Link>
            </div>
        </div>
    );
}