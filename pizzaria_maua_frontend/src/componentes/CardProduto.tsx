import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { Eye, Plus, Leaf } from "lucide-react";

interface CardProdutoProps {
    produto: ProdutoDados;
    onVerDetalhes: (produto: ProdutoDados) => void;
    onAdicionar: (produto: ProdutoDados) => void;
}

export default function CardProduto({ produto, onVerDetalhes, onAdicionar }: CardProdutoProps) {
    // Identifica se o produto atual pertence à categoria de bebidas
    const ehBebida = produto.categoria?.toUpperCase() === "BEBIDAS";

    // 👈 CORREÇÃO: Agora lemos diretamente a propriedade booleana do objeto mapeado
    const ehVegano = !ehBebida && produto.descricao?.pratoVegano === true;

    return (
        <div className="card-produto">
            {/* Tag/Adesivo visual para identificação de receitas veganas */}
            {ehVegano && (
                <div className="badge-vegano-tag">
                    <Leaf size={12} />
                    <span>Prato Vegano</span>
                </div>
            )}

            <img src={produto.imagemUrl} alt={produto.nome} className="produto-imagem" />
            <h3 className="produto-nome">{produto.nome}</h3>
            <p className="produto-preco">R$ {produto.precoBase.toFixed(2)}</p>

            <div className="card-actions">
                <button
                    onClick={() => onVerDetalhes(produto)}
                    className="btn btn-secondary"
                >
                    <Eye size={16} /> Ver Detalhes
                </button>
                <button
                    onClick={() => onAdicionar(produto)}
                    className="btn btn-accent"
                >
                    <Plus size={16} /> Adicionar ao Pedido
                </button>
            </div>
        </div>
    );
}