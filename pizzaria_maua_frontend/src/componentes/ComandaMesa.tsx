import type { ItemPedidoDados } from '../interfaces/PedidoDados';
import { Receipt, Clock } from "lucide-react";
import "../styles/comandaMesa.css";

interface ComandaMesaProps {
    itensConsumidos: ItemPedidoDados[];
    todosItensProntos: boolean;
    onAbrirPagamento: () => void;
    pagamentoPermitido?: boolean;
    aguardandoPagamento?: boolean;
}

export default function ComandaMesa({
                                        itensConsumidos,
                                        todosItensProntos,
                                        onAbrirPagamento,
                                        pagamentoPermitido = true, aguardandoPagamento = false
                                    }: ComandaMesaProps) {

    const podePagar = todosItensProntos && itensConsumidos.length > 0 && pagamentoPermitido && !aguardandoPagamento;

    // Cálculo do total consumido atualizado
    const totalContaAtual = itensConsumidos.reduce((acc, i) => {
        return acc + (i.precoUnitario * i.quantidade);
    }, 0);

    return (
        <div className="comanda-mesa-container">
            <h4 className="comanda-titulo">
                <Receipt size={18} color="#2e7d32" /> Já Pedido nesta Mesa:
            </h4>

            <ul className="lista-consumido">
                {itensConsumidos.map((item) => (
                    <li key={item.id} className="item-consumido">
                        <span className="item-consumido-info">
                            <strong>{item.quantidade}x</strong> {item.produtoNome}
                        </span>
                        {/* Alterado para 'Em Preparo' para otimizar espaço em telas compactas */}
                        <span className={`status-badge ${item.status === "PRONTO" ? "pronto" : "preparacao"}`}>
                            {item.status === "PRONTO" ? "Entregue" : "Em Preparo"}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Conta atual */}
            <div className="conta-atual-box">
                <span>Conta atual:</span>
                <span>R$ {totalContaAtual.toFixed(2)}</span>
            </div>

            {/* Aviso resumido e explicativo sobre o andamento dos pratos */}
            {!todosItensProntos && (
                <div className="comanda-aviso-preparo">
                    <Clock size={16} />
                    <p>Pedidos em preparo. O pagamento será liberado assim que todos os itens forem entregues na mesa.</p>
                </div>
            )}

            <button
                onClick={() => { if (podePagar) onAbrirPagamento(); }}
                disabled={!podePagar}
                className={`btn-fechamento ${podePagar ? "btn-success" : "btn-disabled"}`}
            >
                {aguardandoPagamento ? 'Pagamento já solicitado' : pagamentoPermitido ? '💳 Encerrar e Pagar' : 'Atualize a comanda'}
            </button>
        </div>
    );
}
