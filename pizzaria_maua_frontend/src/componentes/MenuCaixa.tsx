import { Link, useLocation } from "react-router-dom";
import { DollarSign, Archive } from "lucide-react";
import "../styles/menuCaixa.css";

export default function MenuCaixa() {
    const location = useLocation();

    const links = [
        { path: "/caixa", label: "Caixa Atual", icon: DollarSign, exact: true },
        { path: "/caixa/arquivo", label: "Arquivo / Histórico", icon: Archive, exact: false },
    ];

    return (
        <nav className="menu-caixa-container">
            <ul className="menu-caixa-lista">
                {links.map((link) => {
                    const Icon = link.icon;
                    // Lógica para verificar rota ativa de forma precisa
                    const isActive = link.exact
                        ? location.pathname === link.path
                        : location.pathname.startsWith(link.path);

                    return (
                        <li key={link.path}>
                            <Link to={link.path} className={`menu-caixa-link ${isActive ? "ativo" : ""}`}>
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