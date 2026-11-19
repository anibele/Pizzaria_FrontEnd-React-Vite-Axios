import { X, Printer } from "lucide-react";
import type { PedidoCaixaDados } from "../interfaces/PedidoDadosCaixa"; // Novo import
import { imprimirComanda } from "../services/gerarComanda.ts";
import "../styles/modaldetalhespedido.css";
import { useDialogo } from '../hooks/useDialogo';

interface ModalDetalhesPedidoProps {
    isOpen: boolean;
    onClose: () => void;
    pedido: PedidoCaixaDados | null; 
}

export function ModalDetalhesPedido({ isOpen, onClose, pedido }: ModalDetalhesPedidoProps) {
    const [dialogoRef, tituloId] = useDialogo(isOpen && !!pedido, onClose);
    if (!isOpen || !pedido) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div ref={dialogoRef} className="modal-container dialogo-acessivel" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onClick={(e) => e.stopPropagation()}>

                <div className="modal-header">
                    <h2 id={tituloId}>Mesa {pedido.numeroMesa ?? "Avulsa"}</h2>
                    <button onClick={onClose} className="btn-fechar" aria-label="Fechar detalhes do pedido"><X size={24} /></button>
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
                    <button onClick={() => imprimirComanda(pedido)} className="btn-imprimir">
                        <Printer size={20} /> Imprimir Comanda
                    </button>
                </div>
            </div>
        </div>
    );
}
