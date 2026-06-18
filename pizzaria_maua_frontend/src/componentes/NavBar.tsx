import { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import bannerImg from "../assets/BannerPizzaria.png";

export default function NavBar() {
    const { user, logout } = useContext(AuthContext);
    const [dropdownAberto, setDropdownAberto] = useState<boolean>(false);

    const handleLogoutClique = () => {
        if (user?.role === "MESA") {
            const senhaDigitada = prompt("🔒 Operação Restrita: Digite a senha para deslogar esta mesa:");

            if (senhaDigitada === "pizza1998") {
                logout();
            } else if (senhaDigitada !== null) {
                alert("❌ Senha incorreta! O tablet da mesa continuará conectado.");
            }
        } else {
            logout();
        }
    };

    const iniciaisUsuario = user?.username ? user.username.substring(0, 2).toUpperCase() : "👤";

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "200px",
            backgroundImage: `url(${bannerImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 30px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            boxSizing: "border-box"
        }}>
            {/* Ícone Redondo de Perfil */}
            <div style={{ position: "relative" }}>
                <div
                    onClick={() => setDropdownAberto(!dropdownAberto)}
                    style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        backgroundColor: "#ff9800",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        cursor: "pointer",
                        border: "3px solid white",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        userSelect: "none",
                        fontSize: "1.1em"
                    }}
                >
                    {iniciaisUsuario}
                </div>

                {/* Caixa Suspensa do Menu (Dropdown) */}
                {dropdownAberto && (
                    <div style={{
                        position: "absolute",
                        top: "60px",
                        right: 0,
                        backgroundColor: "white",
                        borderRadius: "6px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                        padding: "12px",
                        minWidth: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        zIndex: 1001,
                        fontFamily: "sans-serif"
                    }}>
                        <div style={{ fontSize: "0.85em", color: "#555", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
                            Conectado como: <br />
                            <strong style={{ color: "#222", fontSize: "1.05em" }}>{user?.username}</strong>
                            <span style={{ display: "block", fontSize: "0.8em", color: "#888", marginTop: "2px" }}>
                                Perfil: {user?.role}
                            </span>
                        </div>

                        <button
                            onClick={handleLogoutClique}
                            style={{
                                width: "100%",
                                padding: "8px",
                                backgroundColor: "#e53935",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                fontSize: "0.9em"
                            }}
                        >
                            👋 Fazer Logout
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}