import { AlertTriangle, Wrench, Trash2, X } from "lucide-react";
import type { EstadoAcaoMesa } from "../services/acoesMesa";
import "../styles/modalAcoesMesa.css";
import { useDialogo } from '../hooks/useDialogo';

interface ModalAcoesMesaProps {
    isOpen: boolean;
    onClose: () => void;
    numeroMesa: number;
    onDesativar: () => void;
    onExcluir: () => void;
    estado: EstadoAcaoMesa;
    onVerificar: () => void;
}

export function ModalAcoesMesa({ isOpen, onClose, numeroMesa, onDesativar, onExcluir, estado, onVerificar }: ModalAcoesMesaProps) {
    const [dialogoRef, tituloId, fecharDialogo] = useDialogo(isOpen, onClose, !estado.processando);
    if (!isOpen) return null;
    const bloquearAcoes = estado.processando || estado.verificar || estado.sucesso;

    return (
        <div className="overlay-modal">
            <div ref={dialogoRef} className="modal-conteudo modal-acoes-mesa animate-scale-up dialogo-acessivel" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} aria-busy={estado.processando}>
                <div className="modal-acoes-header">
                    <div className="icone-alerta-wrapper">
                        <AlertTriangle size={22} className="icone-alerta-modal" />
                    </div>
                    <h3 id={tituloId}>Gerenciar Remoção da Mesa {numeroMesa}</h3>
                    <button className="btn-fechar-modal-X" aria-label="Fechar ações da mesa" onClick={fecharDialogo} disabled={estado.processando}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-acoes-corpo">
                    <p className="texto-pergunta">
                        Você deseja excluir definitivamente esta mesa do sistema ou apenas desativá-la momentaneamente?
                    </p>
                    {estado.mensagem && <p className="texto-pergunta" role={estado.processando || estado.sucesso ? 'status' : 'alert'}>{estado.mensagem}</p>}

                    <div className="opcoes-container">
                        {/* OPÇÃO 1: DESATIVAR */}
                        <button className="opcao-card card-desativar" onClick={onDesativar} disabled={bloquearAcoes}>
                            <div className="opcao-icone color-manutencao">
                                <Wrench size={22} />
                            </div>
                            <div className="opcao-info">
                                <h4>Desativar Mesa (Recomendado)</h4>
                                <p>A mesa ficará indisponível (cinza) para os clientes e tablets. Você poderá ativá-la novamente quando quiser.</p>
                            </div>
                        </button>

                        {/* OPÇÃO 2: EXCLUIR */}
                        <button className="opcao-card card-excluir" onClick={onExcluir} disabled={bloquearAcoes}>
                            <div className="opcao-icone color-excluir">
                                <Trash2 size={22} />
                            </div>
                            <div className="opcao-info">
                                <h4>Excluir Permanentemente</h4>
                                <p>Remove o registro e as credenciais quando permitido. Registros vinculados podem impedir a exclusão. A desativação é uma escolha separada, sujeita às regras da mesa.</p>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="modal-acoes-rodape">
                    {estado.verificar && <button className="btn-cancelar-modal" onClick={onVerificar} disabled={estado.processando}>Verificar mesa</button>}
                    <button className="btn-cancelar-modal" onClick={fecharDialogo} disabled={estado.processando}>
                        {estado.sucesso ? 'Fechar' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
