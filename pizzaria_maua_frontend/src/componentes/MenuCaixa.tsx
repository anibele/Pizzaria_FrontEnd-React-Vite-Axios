import { Link, useLocation } from "react-router-dom";
import { DollarSign } from "lucide-react";
import "../styles/menuGerente.css";

export default function MenuCaixa() {
    const location = useLocation();

    const links = [
        { path: "/caixa", label: "Pagamentos", icon: DollarSign },
        // Você pode adicionar mais opções aqui futuramente (ex: histórico)
    ];

    return (
        <nav className="menu-caixa-container">
            <ul className="menu-caixa-lista">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.path);

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