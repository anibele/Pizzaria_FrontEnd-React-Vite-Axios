import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Pizza, Armchair, ChefHat } from "lucide-react";
import "../styles/menuGerente.css";

export default function MenuGerente() {
    const location = useLocation();

    const links = [
        { path: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
        { path: "/produtos", label: "Cardápio", icon: Pizza },
        { path: "/mesas", label: "Mesas", icon: Armchair },
        { path: "/pedidos", label: "Cozinha", icon: ChefHat },
    ];

    return (
        <nav className="menu-gerente-container">
            <ul className="menu-gerente-lista">
                {links.map((link) => {
                    const Icon = link.icon;
                    // Verifica se a rota atual é a mesma do link para aplicar a classe 'ativo'
                    const isActive = location.pathname.startsWith(link.path);

                    return (
                        <li key={link.path}>
                            <Link to={link.path} className={`menu-gerente-link ${isActive ? "ativo" : ""}`}>
                                <Icon size={18} />
                                <span>{link.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}