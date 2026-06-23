import { AlertTriangle, Wrench, Trash2, X } from "lucide-react";
import "../styles/modalAcoesMesa.css";

interface ModalAcoesMesaProps {
    isOpen: boolean;
    onClose: () => void;
    numeroMesa: number;
    onDesativar: () => void;
    onExcluir: () => void;
}

export function ModalAcoesMesa({ isOpen, onClose, numeroMesa, onDesativar, onExcluir }: ModalAcoesMesaProps) {
    if (!isOpen) return null;

    return (
        <div className="overlay-modal">
            <div className="modal-conteudo modal-acoes-mesa animate-scale-up">
                <div className="modal-acoes-header">
                    <div className="icone-alerta-wrapper">
                        <AlertTriangle size={22} className="icone-alerta-modal" />
                    </div>
                    <h3>Gerenciar Remoção da Mesa {numeroMesa}</h3>
                    <button className="btn-fechar-modal-X" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-acoes-corpo">
                    <p className="texto-pergunta">
                        Você deseja excluir definitivamente esta mesa do sistema ou apenas desativá-la momentaneamente?
                    </p>

                    <div className="opcoes-container">
                        {/* OPÇÃO 1: DESATIVAR */}
                        <button className="opcao-card card-desativar" onClick={onDesativar}>
                            <div className="opcao-icone color-manutencao">
                                <Wrench size={22} />
                            </div>
                            <div className="opcao-info">
                                <h4>Desativar Mesa (Recomendado)</h4>
                                <p>A mesa ficará indisponível (cinza) para os clientes e tablets. Você poderá ativá-la novamente quando quiser.</p>
                            </div>
                        </button>

                        {/* OPÇÃO 2: EXCLUIR */}
                        <button className="opcao-card card-excluir" onClick={onExcluir}>
                            <div className="opcao-icone color-excluir">
                                <Trash2 size={22} />
                            </div>
                            <div className="opcao-info">
                                <h4>Excluir Permanentemente</h4>
                                <p>Remove o registro e as credenciais. Se houver histórico de pedidos no banco, ela será desativada automaticamente por segurança.</p>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="modal-acoes-rodape">
                    <button className="btn-cancelar-modal" onClick={onClose}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}