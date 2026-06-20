import { Link, useLocation } from "react-router-dom";
import { useContext } from "react";
import AppRoutes from "./routes";
import NavBar from "./componentes/NavBar";
import { AuthContext } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext"; 
import "./App.css";

export default function App() {
    const { user, authenticated } = useContext(AuthContext);
    const location = useLocation();

    const isAmbienteCozinha = user?.role === "COZINHA" || location.pathname === "/pedidos";

    return (
        // 👈 Envelopamos tudo com o Provider de Notificações
        <NotificationProvider>
            <div className="app-container">
                {/* 1. Só exibe a NavBar se estiver autenticado E NÃO for o ambiente da cozinha */}
                {authenticated && !isAmbienteCozinha && <NavBar />}

                {/* 2. Menu secundário de navegação */}
                {authenticated && user && !isAmbienteCozinha && (
                    <header className="sub-menu" style={{
                        display: "flex",
                        gap: "15px",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "10px",
                        backgroundColor: "#f8f9fa",
                        marginBottom: "20px",
                        borderBottom: "1px solid #e0e0e0",
                        fontFamily: "sans-serif"
                    }}>
                        {user.role === "GERENTE" && (
                            <>
                                <Link to="/" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}>Produtos</Link> |
                                <Link to="/mesas" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}> Mesas</Link> |
                                <Link to="/pedidos" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}> Ver Cozinha</Link>
                            </>
                        )}
                    </header>
                )}

                {/* 3. Renderização da tela em Full Screen para a Cozinha */}
                <main className="conteudo-principal" style={{ padding: isAmbienteCozinha ? "0" : "0 20px" }}>
                    <AppRoutes />
                </main>
            </div>
        </NotificationProvider>
    );
}