import { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import bannerImg from "../assets/BannerPizzaria.png";

export default function NavBar() {
    const { user, logout } = useContext(AuthContext);
    const [dropdownAberto, setDropdownAberto] = useState<boolean>(false);

    const handleLogoutClique = () => {
        if (user?.role === "MESA") {
            const senhaDigitada = prompt(
                "🔒 Operação Restrita: Digite a senha para deslogar esta mesa:"
            );

            if (senhaDigitada === "pizza1998") {
                logout();
            } else if (senhaDigitada !== null) {
                alert(
                    "❌ Senha incorreta! O tablet da mesa continuará conectado."
                );
            }
        } else {
            logout();
        }
    };

    const iniciaisUsuario = user?.username
        ? user.username.substring(0, 2).toUpperCase()
        : "👤";

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                overflow: "hidden",
                boxShadow: "0 6px 20px rgba(0,0,0,0.20)",
                zIndex: 1000,
                backgroundColor: "#111"
            }}
        >
            {/* Banner */}
            <img
                src={bannerImg}
                alt="Banner Pizzaria Mauá"
                style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    userSelect: "none"
                }}
            />

            {/* Gradiente elegante sobre o topo */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "130px",
                    background:
                        "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.20), transparent)",
                    pointerEvents: "none"
                }}
            />

            {/* Área do usuário */}
            <div
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "30px"
                }}
            >
                <div style={{ position: "relative" }}>
                    {/* Avatar */}
                    <div
                        onClick={() =>
                            setDropdownAberto(!dropdownAberto)
                        }
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background:
                                "linear-gradient(135deg, #f59e0b, #d97706)",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            cursor: "pointer",
                            border: "3px solid rgba(255,255,255,0.95)",
                            boxShadow:
                                "0 6px 18px rgba(0,0,0,0.35)",
                            userSelect: "none",
                            fontSize: "1.05rem",
                            transition: "all 0.25s ease"
                        }}
                    >
                        {iniciaisUsuario}
                    </div>

                    {/* Dropdown */}
                    {dropdownAberto && (
                        <div
                            style={{
                                position: "absolute",
                                top: "70px",
                                right: 0,
                                backgroundColor:
                                    "rgba(255,255,255,0.98)",
                                borderRadius: "12px",
                                boxShadow:
                                    "0 10px 30px rgba(0,0,0,0.25)",
                                padding: "16px",
                                minWidth: "230px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                                zIndex: 1001,
                                fontFamily:
                                    "'Segoe UI', sans-serif",
                                border:
                                    "1px solid rgba(0,0,0,0.08)",
                                backdropFilter: "blur(8px)"
                            }}
                        >
                            <div
                                style={{
                                    borderBottom:
                                        "1px solid #e5e7eb",
                                    paddingBottom: "10px",
                                    color: "#555",
                                    fontSize: "0.85rem"
                                }}
                            >
                                Conectado como:
                                <br />

                                <strong
                                    style={{
                                        color: "#111827",
                                        fontSize: "1rem"
                                    }}
                                >
                                    {user?.username}
                                </strong>

                                <span
                                    style={{
                                        display: "block",
                                        marginTop: "4px",
                                        color: "#6b7280",
                                        fontSize: "0.8rem"
                                    }}
                                >
                                    Perfil: {user?.role}
                                </span>
                            </div>

                            <button
                                onClick={handleLogoutClique}
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    border: "none",
                                    borderRadius: "8px",
                                    background:
                                        "linear-gradient(135deg, #dc2626, #b91c1c)",
                                    color: "white",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "0.2s"
                                }}
                            >
                                👋 Fazer Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}