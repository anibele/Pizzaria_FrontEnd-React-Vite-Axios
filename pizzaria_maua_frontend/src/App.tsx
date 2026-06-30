import { useLocation } from "react-router-dom";
import { useContext } from "react";
import AppRoutes from "./routes";
import NavBar from "./componentes/NavBar";
import MenuGerente from "./componentes/MenuGerente";
import { AuthContext } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import "./App.css";

export default function App() {
    const {user, authenticated} = useContext(AuthContext);
    const location = useLocation();

    const isAmbienteCozinha = user?.role === "COZINHA" || location.pathname === "/pedidos";
    const isGerente = user?.role === "GERENTE";
    const isCaixa = user?.role === "CAIXA";

    return (
        <NotificationProvider>
            <div className="app-container">
                {/* 1. NavBar Global (Login/Logout, etc) */}
                {authenticated && !isAmbienteCozinha && <NavBar/>}

                {/* 2. Menu Exclusivo do Gerente */}
                {authenticated && isGerente && <MenuGerente/>}

                {/* 3. Menu do caixa */}
                {authenticated && isCaixa && !isAmbienteCozinha}

                {/* 4. Renderização da tela */}
                <main className="conteudo-principal" style={{padding: isAmbienteCozinha ? "0" : "0 20px"}}>
                    <AppRoutes/>
                </main>
            </div>
        </NotificationProvider>
    );
}