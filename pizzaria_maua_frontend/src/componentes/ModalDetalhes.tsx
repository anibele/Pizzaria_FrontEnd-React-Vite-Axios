import type { ProdutoDados } from "../interfaces/ProdutoDados";

interface Props {
    produto: ProdutoDados | null;
    onClose: () => void;
}

/**
 * Modal responsável por exibir detalhes do produto selecionado
 */
export default function ModalDetalhes({ produto, onClose }: Props) {
    if (!produto) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>

                {/* Botão fechar */}
                <button className="modal-close" onClick={onClose}>
                    ✖
                </button>

                {/* Conteúdo */}
                <img src={produto.imagemUrl} alt={produto.nome} className="modal-img" />

                <h2>{produto.nome}</h2>
                <p className="modal-preco">R$ {produto.precoBase.toFixed(2)}</p>

                <p className="modal-descricao">
                    {produto.descricao}
                </p>
            </div>
        </div>
    );
}