import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import Login from "../pages/Login";
import ProdutosGerente from "./ProdutosGerente";
import MesasGerente from "./MesasGerente";
import PedidosCozinha from "./PedidosCozinha";
import CardapioCliente from "./CardapioCliente";

export default function AppRoutes() {
    return (
        <Routes>
            {/* Rota Pública de Autenticação */}
            <Route path="/login" element={<Login />} />

            {/* Rotas Administrativas (Painel do Gerente) */}
            <Route
                path="/"
                element = {
                    <ProtectedRoute allowedRoles={["GERENTE"]}>
                        <ProdutosGerente />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/mesas"
                element = {
                    <ProtectedRoute allowedRoles={["GERENTE"]}>
                        <MesasGerente />
                    </ProtectedRoute>
                }
            />

            {/* Rota do Monitor de Pedidos (Cozinha e gerenciamento) */}
            <Route
                path="/pedidos"
                element = {
                    <ProtectedRoute allowedRoles={["COZINHA", "GERENTE"]}>
                        <PedidosCozinha />
                    </ProtectedRoute>
                }
            />

            {/* Rota do Cardápio Digital (Exclusiva para os tablets das Mesas) */}
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

            {/* Qualquer rota desconhecida ou rota padrão joga o usuário para tentar o Login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}