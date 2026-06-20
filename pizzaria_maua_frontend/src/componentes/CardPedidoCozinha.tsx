import { Clock, Check, UtensilsCrossed } from "lucide-react";
import "../styles/cardPedidoCozinha.css";

interface ItemPedidoCozinha {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
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
    const formatarHora = (dataString: string) => {
        try {
            const dataObjeto = new Date(dataString);
            return dataObjeto.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return "--:--";
        }
    };

    // Filtra os itens que não estão prontos e não foram recém-clicados
    const itensAtivos = (pedido.itens || []).filter(
        (item) => item.status !== "PRONTO" && !itensDespachados.includes(item.id)
    );

    // Se a comanda já foi toda entregue, o card some
    if (itensAtivos.length === 0) return null;

    return (
        <div className="card-cozinha">
            <div className="card-cozinha-header">
                <div className="mesa-badge">
                    MESA {pedido.numeroMesa}
                </div>
                <div className="tempo-badge">
                    <Clock size={16} />
                    {formatarHora(pedido.dataHora)}
                </div>
            </div>

            <ul className="card-cozinha-lista">
                {itensAtivos.map((item) => {
                    const foiClicado = itensDespachados.includes(item.id);

                    return (
                        <li key={item.id} className={`item-cozinha ${foiClicado ? "item-despachado" : ""}`}>
                            <div className="item-info">
                                <span className="item-qtd">{item.quantidade}x</span>
                                <span className="item-nome">{item.produtoNome}</span>
                            </div>

                            <button
                                className="btn-entregar"
                                onClick={() => onMarcarComoEntregue(item.id)}
                                disabled={foiClicado}
                            >
                                {foiClicado ? <Check size={20} /> : "Pronto"}
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