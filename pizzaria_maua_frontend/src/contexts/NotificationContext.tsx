import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Bell, PlusCircle, DollarSign, X } from "lucide-react";
import "../styles/notification.css"; // Vamos criar este arquivo a seguir

export type NotificationType = "NOVO_PEDIDO" | "ITENS_ADICIONADOS" | "PAGAMENTO";

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
}

interface NotificationContextData {
    adicionarNotificacao: (type: NotificationType, mesa: number, detalhes?: string) => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [fila, setFila] = useState<NotificationItem[]>([]);
    const [notificacaoAtiva, setNotificacaoAtiva] = useState<NotificationItem | null>(null);
    const [isExiting, setIsExiting] = useState(false);

    // Função para tocar os sons correspondentes
    const tocarSom = (type: NotificationType) => {
        let audioPath = "";
        switch (type) {
            case "NOVO_PEDIDO":
                audioPath = "/sons/campainha.mp3";
                break;
            case "ITENS_ADICIONADOS":
                audioPath = "/sons/bipe.mp3";
                break;
            case "PAGAMENTO":
                audioPath = "/sons/caixa.mp3";
                break;
        }

        if (audioPath) {
            const audio = new Audio(audioPath);
            audio.play().catch((err) => console.log("Áudio bloqueado pelo navegador:", err));
        }
    };

    // Expõe a função para qualquer componente disparar um alerta
    const adicionarNotificacao = useCallback((type: NotificationType, mesa: number, detalhes?: string) => {
        let title = "";
        let message = "";

        switch (type) {
            case "NOVO_PEDIDO":
                title = "Novo Pedido!";
                message = `Mesa ${mesa} acabou de abrir um pedido.`;
                break;
            case "ITENS_ADICIONADOS":
                title = "Mais Itens!";
                message = `Mesa ${mesa} adicionou novos itens ao pedido.`;
                break;
            case "PAGAMENTO":
                title = "Solicitação de Pago!";
                message = `Mesa ${mesa} solicitou fechamento via ${detalhes || "Cartão"}.`;
                break;
        }

        const novaNotificacao: NotificationItem = {
            id: Math.random().toString(36).substring(2, 9),
            type,
            title,
            message,
        };

        setFila((prev) => [...prev, novaNotificacao]);
    }, []);

    // Controla o consumo da fila (exibe uma por vez)
    useEffect(() => {
        if (!notificacaoAtiva && fila.length > 0) {
            const proxima = fila[0];
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setNotificacaoAtiva(proxima);
            setFila((prev) => prev.slice(1));
            setIsExiting(false);
            tocarSom(proxima.type);
        }
    }, [fila, notificacaoAtiva]);

    // Timer para fechar a notificação automaticamente após 5 segundos
    useEffect(() => {
        if (notificacaoAtiva) {
            const timerOpacidade = setTimeout(() => {
                setIsExiting(true); // Dispara a animação de saída (CSS)
            }, 4500);

            const timerFechar = setTimeout(() => {
                setNotificacaoAtiva(null);
            }, 5000); // 500ms depois para dar tempo da animação acabar

            return () => {
                clearTimeout(timerOpacidade);
                clearTimeout(timerFechar);
            };
        }
    }, [notificacaoAtiva]);

    const fecharManualmente = () => {
        setIsExiting(true);
        setTimeout(() => {
            setNotificacaoAtiva(null);
        }, 4000);
    };

    // Renderiza o ícone correto baseado no tipo
    const renderIcon = (type: NotificationType) => {
        switch (type) {
            case "NOVO_PEDIDO":
                return <Bell className="notif-icon-svg" size={32} />;
            case "ITENS_ADICIONADOS":
                return <PlusCircle className="notif-icon-svg" size={32} />;
            case "PAGAMENTO":
                return <DollarSign className="notif-icon-svg" size={32} />;
        }
    };

    return (
        <NotificationContext.Provider value={{ adicionarNotificacao }}>
            {children}

            {/* Renderização do Toast Gigante na Tela */}
            {notificacaoAtiva && (
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

                        {/* Barrinha de progresso de 5 segundos */}
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