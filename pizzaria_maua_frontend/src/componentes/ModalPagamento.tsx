import { useState, useEffect } from "react";
import { X, QrCode, CreditCard, Banknote, CheckCircle2 } from "lucide-react";
import "../styles/modalPagamento.css";

interface ModalPagamentoProps {
    isOpen: boolean;
    onClose: () => void;
    onSolicitarPagamento: (forma: 'PIX' | 'CARTAO' | 'DINHEIRO') => void;
}

export default function ModalPagamento({ isOpen, onClose, onSolicitarPagamento }: ModalPagamentoProps) {
    const [passo, setPasso] = useState<1 | 2>(1);

    // Garante que o modal volte ao passo 1 silenciosamente caso a mesa seja resetada
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => setPasso(1), 300);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleEscolherForma = (forma: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        onSolicitarPagamento(forma);
        setPasso(2); // Avança e "tranca" a tela no passo 2
    };

    const handleFecharManualmente = () => {
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">

                {/* Botão de Fechar é renderizado APENAS no passo 1 */}
                {passo === 1 && (
                    <button onClick={handleFecharManualmente} className="btn-modal-fechar" title="Voltar ao Cardápio">
                        <X size={22} />
                    </button>
                )}

                {passo === 1 ? (
                    <>
                        <h2 className="modal-titulo">Como deseja pagar?</h2>
                        <p className="modal-subtitulo">Selecione a forma de pagamento abaixo:</p>

                        <div className="opcoes-pagamento-container">
                            <button className="btn-opcao-pagamento" onClick={() => handleEscolherForma("PIX")}>
                                <QrCode size={20} /> Pix
                            </button>
                            <button className="btn-opcao-pagamento" onClick={() => handleEscolherForma("CARTAO")}>
                                <CreditCard size={20} /> Cartão (Crédito/Débito)
                            </button>
                            <button className="btn-opcao-pagamento" onClick={() => handleEscolherForma("DINHEIRO")}>
                                <Banknote size={20} /> Dinheiro
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="sucesso-container">
                        <div className="sucesso-icone-wrapper">
                            <CheckCircle2 size={56} strokeWidth={2.5} />
                        </div>
                        <h2 className="modal-titulo" style={{ color: "#2e7d32" }}>Aguarde...</h2>
                        <p className="sucesso-texto">
                            Sua solicitação foi enviada para o caixa!
                        </p>
                        <br/>
                        <p className="sucesso-texto">
                            Por favor, aguarde o nosso atendente vir até a sua mesa para finalizar o pagamento.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}