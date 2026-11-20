import { X, QrCode, CreditCard, Banknote, CheckCircle2, Loader2 } from "lucide-react";
import type { EstadoPagamento, FormaPagamento } from "../services/solicitacaoPagamento";
import "../styles/modalPagamento.css";
import { useDialogo } from '../hooks/useDialogo';

interface ModalPagamentoProps {
    isOpen: boolean;
    onClose: () => void;
    estado: EstadoPagamento;
    onSolicitarPagamento: (forma: FormaPagamento) => Promise<void>;
    onVerificarPedido: () => Promise<void>;
}

export default function ModalPagamento({ isOpen, onClose, estado, onSolicitarPagamento, onVerificarPedido }: ModalPagamentoProps) {
    const [dialogoRef, tituloId, fecharDialogo] = useDialogo(isOpen, onClose, estado.fase !== 'processando' && estado.fase !== 'sucesso');
    if (!isOpen) return null;
    const processando = estado.fase === 'processando';
    const sucesso = estado.fase === 'sucesso';
    const podeSolicitar = estado.fase === 'selecao' || estado.fase === 'erro';

    return (
        <div className="modal-overlay">
            <div ref={dialogoRef} className="modal-container dialogo-acessivel" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} aria-busy={processando}>

                {!sucesso && (
                    <button onClick={fecharDialogo} disabled={processando} className="btn-modal-fechar" title="Voltar ao Cardápio">
                        <X size={22} />
                    </button>
                )}

                {!sucesso ? (
                    <>
                        <h2 id={tituloId} className="modal-titulo">Como deseja pagar?</h2>
                        <p className="modal-subtitulo">Selecione a forma de pagamento abaixo:</p>

                        {processando && <p className="modal-subtitulo" role="status"><Loader2 className="animate-spin" size={20} /> {estado.mensagem}</p>}
                        {!processando && estado.mensagem && <p className="modal-subtitulo" role="alert">{estado.mensagem}</p>}

                        {(podeSolicitar || processando) && <div className="opcoes-pagamento-container">
                            <button className="btn-opcao-pagamento" disabled={processando} onClick={() => { void onSolicitarPagamento("PIX"); }}>
                                <QrCode size={20} /> Pix
                            </button>
                            <button className="btn-opcao-pagamento" disabled={processando} onClick={() => { void onSolicitarPagamento("CARTAO"); }}>
                                <CreditCard size={20} /> Cartão (Crédito/Débito)
                            </button>
                            <button className="btn-opcao-pagamento" disabled={processando} onClick={() => { void onSolicitarPagamento("DINHEIRO"); }}>
                                <Banknote size={20} /> Dinheiro
                            </button>
                        </div>}
                        {estado.fase === 'verificar' && <button className="btn-opcao-pagamento" onClick={() => { void onVerificarPedido(); }}>Verificar pedido</button>}
                    </>
                ) : (
                    <div className="sucesso-container">
                        <div className="sucesso-icone-wrapper">
                            <CheckCircle2 size={56} strokeWidth={2.5} />
                        </div>
                        <h2 id={tituloId} className="modal-titulo" style={{ color: "#2e7d32" }}>Aguarde...</h2>
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
