import { ClipboardList, Minus, Plus, Loader2, ChefHat } from "lucide-react";
import ComandaMesa from "./ComandaMesa"; // Importando o novo componente de histórico
import type { ProdutoDados } from "../interfaces/ProdutoDados";
import "../styles/pedidoMesa.css";

interface ItemCarrinho {
    produto: ProdutoDados;
    quantidade: number;
}

interface ItemPedidoResponse {
    id: number;
    produtoId: number;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    status: "PENDENTE" | "EM_PREPARO" | "PRONTO";
}

interface PedidoMesaProps {
    carrinho: ItemCarrinho[];
    onRemoverOuDiminuir: (produtoId: number) => void;
    onAdicionarAoCarrinho: (produto: ProdutoDados) => void;
    onEnviarParaCozinha: () => void;
    criando: boolean;
    adicionando: boolean;
    pedidoAtivo: any;
    itensConsumidos: ItemPedidoResponse[];
    possuiItensConsumidos: boolean;
    todosItensProntos: boolean;
    onAbrirPagamento: () => void;
}

export default function PedidoMesa({
                                       carrinho,
                                       onRemoverOuDiminuir,
                                       onAdicionarAoCarrinho,
                                       onEnviarParaCozinha,
                                       criando,
                                       adicionando,
                                       pedidoAtivo,
                                       itensConsumidos,
                                       possuiItensConsumidos,
                                       todosItensProntos,
                                       onAbrirPagamento
                                   }: PedidoMesaProps) {

    // Total dos itens que estão apenas no carrinho atual
    const totalPedido = carrinho.reduce((acc, item) => {
        return acc + (item.produto.precoBase * item.quantidade);
    }, 0);

    // Total do histórico de itens que já foram enviados para a cozinha da mesa
    const totalConsumado = itensConsumidos.reduce((acc, item) => {
        return acc + (item.precoUnitario * item.quantidade);
    }, 0);

    // Soma do carrinho + comanda já aberta
    const totalGeralConta = totalConsumado + totalPedido;

    return (
        <div className="sticky-pedido-wrapper" data-tour="step-3">
            <h3 className="pedido-titulo">
                <ClipboardList size={20} color="#e53935" /> Comanda atual
            </h3>
            <p className="pedido-subtitulo">Estes itens ainda não foram para a cozinha.</p>

            {carrinho.length === 0 ? (
                <p className="carrinho-vazio">
                    Seu pedido está vazio. Adicione os itens no menu ao lado!
                </p>
            ) : (
                <div className="carrinho-conteudo">
                    <ul className="lista-carrinho">
                        {carrinho.map((item) => (
                            <li key={item.produto.id} className="item-carrinho">
                                <div className="item-carrinho-info">
                                    <span className="item-carrinho-nome">
                                        <strong>{item.quantidade}x</strong> {item.produto.nome}
                                    </span>
                                    <span className="item-carrinho-preco">
                                        R$ {(item.produto.precoBase * item.quantidade).toFixed(2)}
                                    </span>
                                </div>
                                <div className="carrinho-controles">
                                    <button className="btn-qty" onClick={() => onRemoverOuDiminuir(item.produto.id!)} title="Diminuir">
                                        <Minus size={14} />
                                    </button>
                                    <button className="btn-qty" onClick={() => onAdicionarAoCarrinho(item.produto)} title="Aumentar">
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="total-box">
                        <span>Total do Pedido:</span>
                        <span>R$ {totalPedido.toFixed(2)}</span>
                    </div>

                    {/* Exibe o somatório total acumulado se houver uma comanda em andamento */}
                    {pedidoAtivo && possuiItensConsumidos && (
                        <div className="total-conta-futura-box">
                            <span>Total acumulado da conta:</span>
                            <span>R$ {totalGeralConta.toFixed(2)}</span>
                        </div>
                    )}

                    <button
                        onClick={onEnviarParaCozinha}
                        disabled={criando || adicionando}
                        className="btn btn-primary"
                        data-tour="step-4">
                        {criando || adicionando ? (
                            <><Loader2 className="animate-spin" size={18} /> Enviando...</>
                        ) : (
                            <><ChefHat size={18} /> Enviar à Cozinha</>
                        )}
                    </button>
                </div>
            )}

            {/* Histórico da mesa */}
            {pedidoAtivo && possuiItensConsumidos && (
                <ComandaMesa
                    itensConsumidos={itensConsumidos}
                    todosItensProntos={todosItensProntos}
                    onAbrirPagamento={onAbrirPagamento}
                />
            )}
        </div>
    );
}