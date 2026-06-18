import { Link } from "react-router-dom";
import { useContext } from "react";
import AppRoutes from "./routes";
import NavBar from "./componentes/NavBar";
import { AuthContext } from "./contexts/AuthContext";
import "./App.css";

export default function App() {
    const { user, authenticated } = useContext(AuthContext);

    return (
        // Adiciona padding superior dinâmico se logado para não cobrir o conteúdo do cardápio/dashboard
        <div className="app-container" style={{ paddingTop: authenticated ? "250px" : "0px" }}>

            {/* 1. Só exibe a NavBar fixa se o usuário estiver autenticado */}
            {authenticated && <NavBar />}

            {/* 2. Menu secundário de navegação baseado na ROLE do usuário */}
            {authenticated && user && (
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
                    {/* Se for GERENTE, ele vê os links administrativos */}
                    {user.role === "GERENTE" && (
                        <>
                            <Link to="/" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}>Produtos</Link> |
                            <Link to="/mesas" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}> Mesas</Link> |
                        </>
                    )}

                    {/* Se for COZINHA ou GERENTE, vê a fila de produção */}
                    {(user.role === "COZINHA" || user.role === "GERENTE") && (
                        <Link to="/pedidos" style={{ textDecoration: "none", color: "#007bff", fontWeight: "bold" }}> Pedidos (Cozinha)</Link>
                    )}
                </header>
            )}

            {/* Renderização da tela correspondente à rota */}
            <main className="conteudo-principal" style={{ padding: "0 20px" }}>
                <AppRoutes />
            </main>
        </div>
    );
}