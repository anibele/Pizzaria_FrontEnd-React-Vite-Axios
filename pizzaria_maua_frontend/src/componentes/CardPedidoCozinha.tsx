import { UtensilsCrossed, Check, Loader2, RefreshCw } from "lucide-react";
import type { EstadoConclusaoItem } from "../services/conclusaoCozinha";
import BadgeTimerKds from "./BadgeTimerKds";
import { calcularPrioridadeKds, type KdsStatus } from "../services/kdsCalculadora";
import "../styles/cardPedidoCozinha.css";

interface ItemPedidoCozinha {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
    dataHoraInclusao: string;
    tempoPreparoMinutos: number;
}

interface PedidoCozinhaDados {
    id: number;
    numeroMesa: number;
    dataHora: string;
    formaPagamento: string;
    itens: ItemPedidoCozinha[];
}

interface CardPedidoCozinhaProps {
    pedido: PedidoCozinhaDados;
    operacoes: Record<number, EstadoConclusaoItem>;
    onMarcarComoEntregue: (itemId: number) => void;
    onVerificar: (itemId: number) => void;
}

export default function CardPedidoCozinha({ pedido, operacoes, onMarcarComoEntregue, onVerificar }: CardPedidoCozinhaProps) {
    // Ordena os itens do mais urgente (menor tempo restante) para o menos urgente
    const itensOrdenados = [...pedido.itens].sort((a, b) => {
        const calcA = calcularPrioridadeKds(a.dataHoraInclusao, a.tempoPreparoMinutos);
        const calcB = calcularPrioridadeKds(b.dataHoraInclusao, b.tempoPreparoMinutos);
        return calcA.minutosRestantes - calcB.minutosRestantes;
    });

    if (itensOrdenados.length === 0) return null;

    // Descobre o pior status para pintar o Header do Card
    let statusGeral: KdsStatus = "NORMAL";
    for (const item of itensOrdenados) {
        const calculo = calcularPrioridadeKds(item.dataHoraInclusao, item.tempoPreparoMinutos);
        if (calculo.status === "ATRASADO") {
            statusGeral = "ATRASADO";
            break; // Atrasado é o peso máximo, pode parar de procurar
        }
        if (calculo.status === "ALERTA") {
            statusGeral = "ALERTA";
        }
    }

    return (
        <div className={`card-cozinha status-${statusGeral.toLowerCase()}`}>
            <div className="card-cozinha-header">
                <div className="mesa-badge">
                    MESA {pedido.numeroMesa}
                </div>
            </div>

            <ul className="card-cozinha-lista">
                {itensOrdenados.map((item) => {
                    const operacao = operacoes[item.id];
                    const calculo = calcularPrioridadeKds(item.dataHoraInclusao, item.tempoPreparoMinutos);

                    return (
                        <li key={item.id} className="item-cozinha">
                            <div className="item-info">
                                <span className="item-qtd">{item.quantidade}x</span>
                                <div className="item-nome-container">
                                    <span className="item-nome">{item.produtoNome}</span>
                                    <BadgeTimerKds
                                        status={calculo.status}
                                        minutosRestantes={calculo.minutosRestantes}
                                    />
                                    {operacao?.mensagem && <span role={operacao.processando ? 'status' : 'alert'}>{operacao.mensagem}</span>}
                                </div>
                            </div>

                            <button
                                className="btn-entregar"
                                onClick={() => operacao?.verificar ? onVerificar(item.id) : onMarcarComoEntregue(item.id)}
                                disabled={operacao?.processando}
                                aria-label={operacao?.verificar ? 'Verificar estado do item' : 'Concluir item'}
                                aria-busy={operacao?.processando || false}
                            >
                                {operacao?.processando ? <Loader2 size={22} className="animate-spin" />
                                    : operacao?.verificar ? <RefreshCw size={22} /> : <Check size={22} strokeWidth={3} />}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="card-cozinha-footer">
                <UtensilsCrossed size={14} />
                <span>Comanda #{pedido.id}</span>
            </div>
        </div>
    );
}
