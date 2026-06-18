import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { X, Clock, Leaf, Egg, Utensils } from "lucide-react";

// Vinculação do arquivo CSS específico do modal
import "../styles/modalDetalhes.css";

interface ModalDetalhesProdutoProps {
    produto: ProdutoDados | null;
    onClose: () => void;
}

// Interface que espelha a nova estrutura JSON gravada na coluna 'descricao' do banco
interface DescricaoEstruturada {
    ingredientes: string[];
    pratoVegano: "Sim" | "Não";
    breveDescricao: string;
    tempoMedioPreparo: string;
}

/**
 * Componente de Modal Interativo para exibição detalhada e diagramada
 * das informações nutricionais e técnicas do item selecionado.
 */
export default function ModalDetalhesProduto({ produto, onClose }: ModalDetalhesProdutoProps) {
    // Caso não exista produto selecionado, encerra a renderização imediatamente
    if (!produto) return null;

    // Objeto de fallback padrão caso o JSON falhe ou a descrição seja puro texto (compatibilidade)
    let detalhesParsed: DescricaoEstruturada = {
        ingredientes: [],
        pratoVegano: "Não",
        breveDescricao: produto.descricao || "Nenhuma descrição informada.",
        tempoMedioPreparo: "N/A"
    };

    // Bloco Try-Catch defensivo para tratar a conversão da String JSON do Banco de dados
    try {
        if (produto.descricao && (produto.descricao.startsWith("{") || produto.descricao.startsWith("["))) {
            detalhesParsed = JSON.parse(produto.descricao);
        }
    } catch (error) {
        console.error("Erro ao processar os detalhes estruturados do produto:", error);
        // O fallback definido acima garante que a aplicação continue rodando com o texto original
    }

    // Determina se a flag de vegano é positiva
    const ehVegano = detalhesParsed.pratoVegano === "Sim";

    return (
        <div className="modal-detalhes-overlay" onClick={onClose}>
            {/* Evita o fechamento do modal ao clicar na área interna do card */}
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
                    {detalhesParsed.breveDescricao && (
                        <p className="modal-detalhes-breve">{detalhesParsed.breveDescricao}</p>
                    )}

                    {/* Grupo de Metadados Rápidos (Tempo de Preparo e Restrição Alimentar) */}
                    <div className="modal-detalhes-meta-group">
                        <div className="modal-detalhes-meta-item">
                            <Clock size={16} color="#495057" />
                            <span>Preparo: {detalhesParsed.tempoMedioPreparo}</span>
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

                    {/* Listagem de Ingredientes (Renderizado apenas se existirem itens no Array) */}
                    {detalhesParsed.ingredientes && detalhesParsed.ingredientes.length > 0 && (
                        <div>
                            <h4 className="modal-detalhes-secao-titulo">
                                <Utensils size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Ingredientes inclusos:
                            </h4>
                            <div className="modal-detalhes-tags">
                                {detalhesParsed.ingredientes.map((ingrediente, index) => (
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