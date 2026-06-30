import { UtensilsCrossed, Check } from "lucide-react";
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
    itensDespachados: number[];
    onMarcarComoEntregue: (itemId: number) => void;
}

export default function CardPedidoCozinha({ pedido, itensDespachados, onMarcarComoEntregue }: CardPedidoCozinhaProps) {
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
                    const foiClicado = itensDespachados.includes(item.id);
                    const calculo = calcularPrioridadeKds(item.dataHoraInclusao, item.tempoPreparoMinutos);

                    return (
                        <li key={item.id} className={`item-cozinha ${foiClicado ? "item-despachado" : ""}`}>
                            <div className="item-info">
                                <span className="item-qtd">{item.quantidade}x</span>
                                <div className="item-nome-container">
                                    <span className="item-nome">{item.produtoNome}</span>
                                    {!foiClicado && (
                                        <BadgeTimerKds
                                            status={calculo.status}
                                            minutosRestantes={calculo.minutosRestantes}
                                        />
                                    )}
                                </div>
                            </div>

                            <button
                                className="btn-entregar"
                                onClick={() => onMarcarComoEntregue(item.id)}
                                disabled={foiClicado}
                            >
                                <Check size={22} strokeWidth={3} />
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