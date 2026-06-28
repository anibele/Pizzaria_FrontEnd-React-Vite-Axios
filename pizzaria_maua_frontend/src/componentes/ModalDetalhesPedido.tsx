import { X, Printer } from "lucide-react";
import type { PedidoCaixaDados } from "../interfaces/PedidoDadosCaixa"; // Novo import
import { baixarComandaTxt } from "../services/gerarComandaTxt";
import "../styles/modaldetalhespedido.css";

interface ModalDetalhesPedidoProps {
    isOpen: boolean;
    onClose: () => void;
    pedido: PedidoCaixaDados | null; // Tipagem atualizada
}

export function ModalDetalhesPedido({ isOpen, onClose, pedido }: ModalDetalhesPedidoProps) {
    if (!isOpen || !pedido) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>

                <div className="modal-header">
                    <h2>Mesa {pedido.numeroMesa ?? "Avulsa"}</h2>
                    <button onClick={onClose} className="btn-fechar"><X size={24} /></button>
                </div>

                <div className="modal-body">
                    <ul className="lista-itens">
                        {pedido.itens?.map((item, index) => (
                            <li key={index} className="item-linha">
                                <div className="item-qtd-nome">
                                    <span className="item-qtd">{item.quantidade}x</span>
                                    <span>{item.produtoNome}</span> {/* Direto do JSON */}
                                </div>
                                <span className="item-preco">
                                    R$ {(item.quantidade * item.precoUnitario).toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="modal-footer">
                    <div className="linha-total">
                        <span>Total Pago:</span>
                        <span className="valor-total">R$ {pedido.faturamento.toFixed(2)}</span>
                    </div>
                    <button onClick={() => baixarComandaTxt(pedido)} className="btn-imprimir">
                        <Printer size={20} /> Imprimir Comanda (.txt)
                    </button>
                </div>
            </div>
        </div>
    );
}