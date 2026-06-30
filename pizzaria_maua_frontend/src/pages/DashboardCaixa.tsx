import { useMemo, useState, useEffect, useRef } from "react";
import { usePedidosCozinha } from "../hooks/usePedidosCozinha";
import { usePedidoConfirmarPagamento } from "../hooks/usePedidoConfirmarPagamento";
import { useFaturamentoDiario } from "../hooks/useDadosArquivo";
import { CheckCircle, Loader2, DollarSign, Coffee, CreditCard, TrendingUp } from "lucide-react";
import { ModalDetalhesPedido } from "../componentes/ModalDetalhesPedido";
import type { PedidoCaixaDados } from "../interfaces/PedidoDadosCaixa";
import { adaptarParaCaixa } from "../services/adapter";
import { useNotification } from "../contexts/NotificationContext";

import "../styles/dashboardCaixa.css";

export default function DashboardCaixa() {
        const hojeStr = useMemo(() => {
        const d = new Date();
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }, []);

    const { data: pedidosBrutos, isLoading } = usePedidosCozinha();
    const { mutate: confirmar, isPending } = usePedidoConfirmarPagamento();
    const { data: faturamentoDia = 0 } = useFaturamentoDiario(hojeStr); // <-- Consumindo faturamento do dia

    const { adicionarNotificacao } = useNotification();
    const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCaixaDados | null>(null);
    const prevPedidosRef = useRef<PedidoCaixaDados[]>([]);

    const pedidosAtivos = useMemo(() => {
        if (!pedidosBrutos) return [];
        return pedidosBrutos
            .filter(p => p.status !== "FINALIZADO")
            .map(p => adaptarParaCaixa(p));
    }, [pedidosBrutos]);

    useEffect(() => {
        if (pedidosAtivos.length > 0) {
            pedidosAtivos.forEach(pedidoAtual => {
                const pedidoAnterior = prevPedidosRef.current.find(p => p.id === pedidoAtual.id);
                if (pedidoAtual.status === "AGUARDANDO_PAGAMENTO") {
                    const eraAguardando = pedidoAnterior?.status === "AGUARDANDO_PAGAMENTO";
                    if (!eraAguardando) {
                        adicionarNotificacao("PAGAMENTO", pedidoAtual.numeroMesa, pedidoAtual.formaPagamento || "A combinar");
                    }
                }
            });
        }
        prevPedidosRef.current = pedidosAtivos;
    }, [pedidosAtivos, adicionarNotificacao]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    const handleConfirmar = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        confirmar(id);
    };

    const calcularTotal = (pedido: PedidoCaixaDados) => {
        if (pedido.faturamento) return pedido.faturamento;
        return pedido.itens.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);
    };

    return (
        <div className="caixa-container">
            {/* CABEÇALHO INTEGRANDO O FATURAMENTO LADO A LADO */}
            <div className="caixa-top-bar">
                <div className="caixa-header">
                    <DollarSign size={36} className="text-green-600" />
                    <h1 className="text-3xl font-bold m-0">Monitor de Caixa</h1>
                </div>

                <div className="faturamento-card-mini">
                    <div className="faturamento-icone-wrapper">
                        <TrendingUp size={20} />
                    </div>
                    <div className="faturamento-info">
                        <span className="faturamento-label">Faturamento de Hoje</span>
                        <span className="faturamento-valor">R$ {faturamentoDia.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {pedidosAtivos.length === 0 ? (
                <div className="empty-state">
                    <Coffee size={56} className="empty-icon" />
                    <h3 className="text-xl font-bold mb-2">Nenhum movimento no momento</h3>
                    <p>As mesas estão livres ou não iniciaram nenhum pedido.</p>
                </div>
            ) : (
                <div className="cards-grid">
                    {pedidosAtivos.map((pedido) => {
                        const querPagar = pedido.status === "AGUARDANDO_PAGAMENTO";
                        const total = calcularTotal(pedido);

                        return (
                            <div
                                key={pedido.id}
                                className={`card-mesa ${querPagar ? "aguardando-pagamento" : ""}`}
                                onClick={() => setPedidoSelecionado(pedido)}
                            >
                                <div className={`card-header ${querPagar ? "aguardando-pagamento" : ""}`}>
                                    <h3 className="mesa-title">Mesa {pedido.numeroMesa ?? "?"}</h3>
                                    <span className={`status-badge ${querPagar ? "status-pagamento" : "status-aberto"}`}>
                                        {querPagar ? "Pagar" : "Em Consumo"}
                                    </span>
                                </div>

                                <div className="card-body">
                                    <span className="label-total">Total Atual</span>
                                    <span className="valor-total">R$ {total.toFixed(2)}</span>

                                    {querPagar && (
                                        <span className="forma-pagamento">
                                            <CreditCard size={16} />
                                            Pagamento: {pedido.formaPagamento || "A combinar"}
                                        </span>
                                    )}
                                </div>

                                {querPagar && (
                                    <div className="card-footer">
                                        <button
                                            onClick={(e) => handleConfirmar(e, pedido.id)}
                                            disabled={isPending}
                                            className="btn-confirmar-pagamento"
                                        >
                                            {isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                                            Confirmar Recebimento
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <ModalDetalhesPedido
                isOpen={!!pedidoSelecionado}
                onClose={() => setPedidoSelecionado(null)}
                pedido={pedidoSelecionado}
            />
        </div>
    );
}