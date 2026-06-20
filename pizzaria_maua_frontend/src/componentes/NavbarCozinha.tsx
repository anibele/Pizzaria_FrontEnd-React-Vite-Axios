import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { ChefHat, LogOut, User } from "lucide-react";
import "../styles/navbarCozinha.css";

export default function NavbarCozinha() {
    const { user, logout } = useContext(AuthContext);

    return (
        <nav className="nav-cozinha-container">
            <div className="nav-cozinha-logo">
                <ChefHat size={32} color="#ffb300" />
                <h1>Monitor de Pedidos</h1>
            </div>

            <div className="nav-cozinha-acoes">
                <div className="nav-cozinha-usuario">
                    <User size={20} />
                    <span>{user?.username || "Equipe Cozinha"}</span>
                </div>
                <button className="btn-cozinha-logout" onClick={logout}>
                    <LogOut size={18} />
                    <span>Sair</span>
                </button>
            </div>
        </nav>
    );
}