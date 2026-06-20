import { useState, useEffect } from "react";
import { X, QrCode, CreditCard, Banknote, CheckCircle2 } from "lucide-react";
import "../styles/modalPagamento.css";

interface ModalPagamentoProps {
    isOpen: boolean;
    onClose: () => void; // O onClose serve apenas para fechar o modal visualmente
    onSolicitarPagamento: (forma: 'PIX' | 'CARTAO' | 'DINHEIRO') => void; // Dispara o BACK-END na hora!
}

export default function ModalPagamento({ isOpen, onClose, onSolicitarPagamento }: ModalPagamentoProps) {
    const [passo, setPasso] = useState<1 | 2>(1);

    // TIMER AUTOMÁTICO DE 10 SEGUNDOS PARA O PASSO 2 (Apenas visual)
    useEffect(() => {
        if (!isOpen || passo !== 2) return;

        const autoCloseTimer = setTimeout(() => {
            onClose(); // Apenas fecha a tela, o pagamento já foi enviado no passo 1
            setTimeout(() => setPasso(1), 300);
        }, 10000);

        return () => clearTimeout(autoCloseTimer);
    }, [passo, isOpen, onClose]);

    if (!isOpen) return null;

    const handleEscolherForma = (forma: 'PIX' | 'CARTAO' | 'DINHEIRO') => {
        // 🔥 PASSO CHAVE: Avisa o componente Pai para atualizar o banco de dados AGORA!
        onSolicitarPagamento(forma);
        setPasso(2); // Avança para a animação de sucesso
    };

    const handleFecharManualmente = () => {
        onClose(); // Fecha direto
        setTimeout(() => setPasso(1), 300);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">

                {/* Botão de Fechar fixo no topo direito */}
                {passo === 1 ? (
                    <button onClick={handleFecharManualmente} className="btn-modal-fechar" title="Fechar">
                        <X size={22} />
                    </button>
                ) : (
                    <div className="btn-timer-container">
                        <button onClick={handleFecharManualmente} className="btn-modal-fechar-timer" title="Fechar">
                            <X size={18} />
                        </button>
                        <svg className="svg-countdown" viewBox="0 0 34 34">
                            <circle cx="17" cy="17" r="14" className="svg-countdown-bg" />
                            <circle cx="17" cy="17" r="14" className="svg-countdown-progress" />
                        </svg>
                    </div>
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
                        <h2 className="modal-titulo" style={{ color: "#2e7d32" }}>Pronto!</h2>
                        <p className="sucesso-texto">
                            Obrigado por desfrutar esse momento conosco.
                        </p>
                        <p className="sucesso-texto">
                            Aguarde o nosso funcionário na sua mesa para finalizar o pagamento.
                        </p>
                        <span className="timer-aviso">Esta tela fechará automaticamente inles...</span>
                    </div>
                )}
            </div>
        </div>
    );
}