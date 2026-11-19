import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Bell, PlusCircle, DollarSign, X } from "lucide-react";
import { AuthContext } from "./AuthContext"; // Confirme o caminho
import { controleHttpSessao } from '../services/httpSessao';
import "../styles/notification.css";

export type NotificationType = "NOVO_PEDIDO" | "ITENS_ADICIONADOS" | "PAGAMENTO";

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    sessao: number;
}

interface NotificationContextData {
    adicionarNotificacao: (type: NotificationType, mesa: number, detalhes?: string) => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, versaoSessao } = useContext(AuthContext);
    const [fila, setFila] = useState<NotificationItem[]>([]);
    const [notificacaoAtiva, setNotificacaoAtiva] = useState<NotificationItem | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const fechamento = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const audioAtual = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFila(prev => prev.filter(item => item.sessao === versaoSessao));
        setNotificacaoAtiva(prev => prev?.sessao === versaoSessao ? prev : null);
        setIsExiting(false);
        return () => { clearTimeout(fechamento.current); audioAtual.current?.pause(); };
    }, [versaoSessao]);

    const tocarSom = (type: NotificationType) => {
        let audioPath = "";
        switch (type) {
            case "NOVO_PEDIDO": audioPath = "/sons/campainha.mp3"; break;
            case "ITENS_ADICIONADOS": audioPath = "/sons/bipe.mp3"; break;
            case "PAGAMENTO": audioPath = "/sons/caixa.mp3"; break;
        }

        if (audioPath) {
            const audio = new Audio(audioPath);
            audioAtual.current = audio;
            void audio.play().catch(() => { /* O navegador pode exigir interação para liberar áudio. */ });
        }
    };

    const adicionarNotificacao = useCallback((type: NotificationType, mesa: number, detalhes?: string) => {
        if (!user || controleHttpSessao.geracao !== versaoSessao) return;
        let title = "";
        let message = "";

        switch (type) {
            case "NOVO_PEDIDO":
                title = "Novo Pedido!";
                message = `Mesa ${mesa} acabou de abrir um pedido.`;
                break;
            case "ITENS_ADICIONADOS":
                title = "Mais Itens no pedido!";
                message = `Mesa ${mesa} adicionou novos itens.`;
                break;
            case "PAGAMENTO":
                title = "Solicitação de Pagamento!";
                message = `Mesa ${mesa} solicitou fechamento via ${detalhes || "Cartão"}.`;
                break;
        }

        setFila((prev) => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            type,
            title,
            message,
            sessao: versaoSessao,
        }]);
    }, [user, versaoSessao]);

    useEffect(() => {
        if (!notificacaoAtiva && fila.length > 0) {
            const proxima = fila[0];
            if (!user || proxima.sessao !== versaoSessao) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setFila(prev => prev.slice(1));
                return;
            }
            const ehPagamento = proxima.type === "PAGAMENTO";

            // CORREÇÃO: Permite que Caixa ou Gerente vejam, com ou sem o prefixo ROLE_
            const cargosPermitidos = ["CAIXA", "ROLE_CAIXA", "GERENTE", "ROLE_GERENTE", "ADMIN", "ROLE_ADMIN"];
            const cargoUsuario = user?.role?.toUpperCase() || "";
            const ehAutorizado = cargosPermitidos.includes(cargoUsuario);

            if (ehPagamento && !ehAutorizado) {
                setFila((prev) => prev.slice(1));
            } else {
                setNotificacaoAtiva(proxima);
                setFila((prev) => prev.slice(1));
                setIsExiting(false);
                tocarSom(proxima.type);
            }
        }
    }, [fila, notificacaoAtiva, user, versaoSessao]);

    useEffect(() => {
        if (notificacaoAtiva) {
            const timerOpacidade = setTimeout(() => setIsExiting(true), 4500);
            const timerFechar = setTimeout(() => setNotificacaoAtiva(null), 5000);

            return () => {
                clearTimeout(timerOpacidade);
                clearTimeout(timerFechar);
            };
        }
    }, [notificacaoAtiva]);

    const fecharManualmente = () => {
        setIsExiting(true);
        // CORREÇÃO: Diminuído de 4000 (4 segundos) para 400ms (tempo exato do CSS)
        clearTimeout(fechamento.current);
        fechamento.current = setTimeout(() => {
            setNotificacaoAtiva(null);
        }, 400);
    };

    const renderIcon = (type: NotificationType) => {
        switch (type) {
            case "NOVO_PEDIDO": return <Bell className="notif-icon-svg" size={32} />;
            case "ITENS_ADICIONADOS": return <PlusCircle className="notif-icon-svg" size={32} />;
            case "PAGAMENTO": return <DollarSign className="notif-icon-svg" size={32} />;
        }
    };

    return (
        <NotificationContext.Provider value={{ adicionarNotificacao }}>
            {children}
            {user && notificacaoAtiva?.sessao === versaoSessao && (
                <div className={`notif-overlay-container ${isExiting ? "exit" : "enter"}`}>
                    <div className={`notif-card ${notificacaoAtiva.type.toLowerCase()}`}>
                        <div className="notif-icon-wrapper">
                            {renderIcon(notificacaoAtiva.type)}
                        </div>
                        <div className="notif-content">
                            <h3>{notificacaoAtiva.title}</h3>
                            <p>{notificacaoAtiva.message}</p>
                        </div>
                        <button className="notif-close-btn" onClick={fecharManualmente}>
                            <X size={20} />
                        </button>
                        <div className="notif-progress-bar" />
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotification() {
    return useContext(NotificationContext);
}
