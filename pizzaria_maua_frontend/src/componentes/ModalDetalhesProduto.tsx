import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { X, Clock, Leaf, Egg, Utensils } from "lucide-react";

import "../styles/modalDetalhes.css";
import { useDialogo } from '../hooks/useDialogo';

interface ModalDetalhesProdutoProps {
    produto: ProdutoDados | null;
    onClose: () => void;
}

export default function ModalDetalhesProduto({ produto, onClose }: ModalDetalhesProdutoProps) {
    const [dialogoRef, tituloId, fecharDialogo] = useDialogo(!!produto, onClose);
    if (!produto) return null;

    const detalhes = produto.descricao;
    const ehVegano = detalhes?.pratoVegano === true;

    return (
        <div className="modal-detalhes-overlay" onClick={fecharDialogo}>
            <div ref={dialogoRef} className="modal-detalhes-card dialogo-acessivel" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onClick={(e) => e.stopPropagation()}>

                {/* Botão Superior de Fechamento */}
                <button className="modal-detalhes-fechar" onClick={onClose} title="Fechar visualização">
                    <X size={20} />
                </button>

                {/* Banner com a imagem real do item cadastrado */}
                <img className="modal-detalhes-banner" src={produto.imagemUrl} alt={produto.nome} />

                {/* Corpo do Card com as informações organizadas */}
                <div className="modal-detalhes-corpo">

                    <h2 id={tituloId} className="modal-detalhes-titulo">{produto.nome}</h2>
                    <p className="modal-detalhes-preco">R$ {produto.precoBase.toFixed(2)}</p>

                    {/* Exibição da Breve Descrição Comercial */}
                    {detalhes?.breveDescricao && (
                        <p className="modal-detalhes-breve">{detalhes.breveDescricao}</p>
                    )}

                    {/* Grupo de Metadados Rápidos (Tempo de Preparo e Restrição Alimentar) */}
                    <div className="modal-detalhes-meta-group">
                        <div className="modal-detalhes-meta-item">
                            <Clock size={16} color="#495057" />
                            <span>Preparo: {detalhes?.tempoMedioPreparo || "N/A"}</span>
                        </div>

                        <div className={`modal-detalhes-meta-item ${ehVegano ? "vegano-sim" : ""}`}>
                            {ehVegano ? (
                                <>
                                    <Leaf size={16} />
                                    <span>Prato Vegano</span>
                                </>
                            ) : (
                                <>
                                    <Egg size={16} color="#747d8c" />
                                    <span>Contém Derivados Animais</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Listagem de Ingredientes */}
                    {detalhes?.ingredientes && detalhes.ingredientes.length > 0 && (
                        <div>
                            <h4 className="modal-detalhes-secao-titulo">
                                <Utensils size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Ingredientes inclusos:
                            </h4>
                            <div className="modal-detalhes-tags">
                                {detalhes.ingredientes.map((ingrediente, index) => (
                                    <span key={index} className="modal-detalhes-tag-ingrediente">
                                        {ingrediente}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Botão de Rodapé para fechamento e retorno ao Menu */}
                    <button className="btn btn-secondary" style={{ width: "100%", padding: "12px", borderRadius: "8px", backgroundColor: "#dc2626", color: "white" }} onClick={onClose}>
                        Voltar ao Menu
                    </button>
                </div>

            </div>
        </div>
    );
}
