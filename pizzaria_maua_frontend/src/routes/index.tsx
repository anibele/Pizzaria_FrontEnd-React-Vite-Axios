import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import Login from "../pages/Login";
import DashboardGerente from "../pages/DashboardGerente";
import ProdutosGerente from "./ProdutosGerente";
import MesasGerente from "./MesasGerente";
import PedidosCozinha from "./PedidosCozinha";
import CardapioCliente from "./CardapioCliente";
import DashboardCaixa from "../pages/DashboardCaixa";
import ArquivoCaixa from "../pages/ArquivoCaixa";
import MenuCaixa from "../componentes/MenuCaixa";

export default function AppRoutes() {
    return (
        <Routes>
            {/* Rota Pública de Autenticação */}
            <Route path="/login" element={<Login />} />

            {/* Redirecionamento da Raiz para a Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 📊 Rota da Dashboard Principal (Nova) */}
            <Route
                path="/dashboard"
                element = {
                    <ProtectedRoute allowedRoles={["GERENTE"]}>
                        <DashboardGerente />
                    </ProtectedRoute>
                }
            />

            {/* 📦 Rota de Gestão do Cardápio (Atualizada de "/" para "/produtos") */}
            <Route
                path="/produtos"
                element = {
                    <ProtectedRoute allowedRoles={["GERENTE"]}>
                        <ProdutosGerente />
                    </ProtectedRoute>
                }
            />

            {/* 🪑 Rota de Gerenciamento de Mesas */}
            <Route
                path="/mesas"
                element = {
                    <ProtectedRoute allowedRoles={["GERENTE"]}>
                        <MesasGerente />
                    </ProtectedRoute>
                }
            />

            {/* 🍳 Rota do Monitor de Pedidos (Cozinha e gerenciamento) */}
            <Route
                path="/pedidos"
                element = {
                    <ProtectedRoute allowedRoles={["COZINHA", "GERENTE"]}>
                        <PedidosCozinha />
                    </ProtectedRoute>
                }
            />

            {/* 💰 Rotas do Caixa (Dashboard e Arquivo unificados) */}
            <Route
                path="/caixa"
                element={
                    <ProtectedRoute allowedRoles={["CAIXA", "GERENTE"]}>
                        {/* O MenuCaixa envelopa apenas o contexto do Caixa */}
                        <>
                            <MenuCaixa />
                            <Outlet /> {/* O Outlet renderiza dinamicamente a rota filha ativa */}
                        </>
                    </ProtectedRoute>
                }
            >
                {/* Rota padrão: /caixa */}
                <Route index element={<DashboardCaixa />} />

                {/* Sub-rota: /caixa/arquivo */}
                <Route path="arquivo" element={<ArquivoCaixa />} />
            </Route>

            {/* 📱 Rota do Cardápio Digital (Exclusiva para os tablets das Mesas) */}
            <Route
                path="/cardapio"
                element = {
                    <ProtectedRoute allowedRoles={["MESA"]}>
                        <CardapioCliente />
                    </ProtectedRoute>
                }
            />

            {/* Feedback visual para tentativas de acessos indevidos */}
            <Route
                path="/unauthorized"
                element = {
                    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
                        <h2 style={{ color: "#d9534f" }}>Acesso Negado 🚫</h2>
                        <p>Seu perfil de usuário não tem permissão para acessar esta tela.</p>
                    </div>
                }
            />

            {/* Qualquer rota desconhecida joga o usuário para tentar o Login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}