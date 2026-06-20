import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { X, Clock, Leaf, Egg, Utensils } from "lucide-react";

import "../styles/modalDetalhes.css";

interface ModalDetalhesProdutoProps {
    produto: ProdutoDados | null;
    onClose: () => void;
}

// 👈 CORREÇÃO: Alinhado perfeitamente com o DetalhesDescricaoDTO do Spring Boot
interface DescricaoEstruturada {
    breveDescricao: string;
    tempoMedioPreparo: string;
    pratoVegano: boolean;
    ingredientes: string[];
}

export default function ModalDetalhesProduto({ produto, onClose }: ModalDetalhesProdutoProps) {
    if (!produto) return null;

    // 👈 CORREÇÃO: Mapeamento direto sem necessidade de JSON.parse()
    const detalhes = produto.descricao as unknown as DescricaoEstruturada | undefined;
    const ehVegano = detalhes?.pratoVegano === true;

    return (
        <div className="modal-detalhes-overlay" onClick={onClose}>
            <div className="modal-detalhes-card" onClick={(e) => e.stopPropagation()}>

                {/* Botão Superior de Fechamento */}
                <button className="modal-detalhes-fechar" onClick={onClose} title="Fechar visualização">
                    <X size={20} />
                </button>

                {/* Banner com a imagem real do item cadastrado */}
                <img className="modal-detalhes-banner" src={produto.imagemUrl} alt={produto.nome} />

                {/* Corpo do Card com as informações organizadas */}
                <div className="modal-detalhes-corpo">

                    <h2 className="modal-detalhes-titulo">{produto.nome}</h2>
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
                    <button className="btn btn-secondary" style={{ width: "100%", padding: "12px", borderRadius: "8px" }} onClick={onClose}>
                        Voltar ao Menu
                    </button>
                </div>

            </div>
        </div>
    );
}