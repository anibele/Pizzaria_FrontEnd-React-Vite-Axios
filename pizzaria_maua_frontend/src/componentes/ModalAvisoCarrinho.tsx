import { AlertTriangle, Trash2, ArrowLeft } from "lucide-react";
import "../styles/modalAvisoCarrinho.css";

interface ModalAvisoCarrinhoProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmarPagamento: () => void;
}

export default function ModalAvisoCarrinho({ isOpen, onClose, onConfirmarPagamento }: ModalAvisoCarrinhoProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-aviso-content">
                <div className="modal-aviso-header">
                    <div className="icon-warning-bg">
                        <AlertTriangle size={32} color="#e65100" />
                    </div>
                    <h2>Atenção aos itens no carrinho!</h2>
                </div>

                <div className="modal-aviso-body">
                    <p>
                        Você clicou em <strong>Encerrar e Pagar</strong>, mas notamos que ainda existem itens no seu pedido atual que <strong>não foram enviados para a cozinha</strong>.
                    </p>
                    <p className="aviso-destaque">
                        Como deseja prosseguir?
                    </p>
                </div>

                <div className="modal-aviso-actions">
                    <button className="btn btn-secondary" onClick={onClose}>
                        <ArrowLeft size={18} /> Voltar para o Cardápio
                    </button>

                    <button className="btn btn-danger" onClick={onConfirmarPagamento}>
                        <Trash2 size={18} /> Descartar itens e Pagar
                    </button>
                </div>
            </div>
        </div>
    );
}