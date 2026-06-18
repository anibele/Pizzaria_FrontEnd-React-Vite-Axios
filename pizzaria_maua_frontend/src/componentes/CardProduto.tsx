import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { Eye, Plus, Leaf } from "lucide-react";

interface CardProdutoProps {
    produto: ProdutoDados;
    onVerDetalhes: (produto: ProdutoDados) => void;
    onAdicionar: (produto: ProdutoDados) => void;
}

export default function CardProduto({ produto, onVerDetalhes, onAdicionar }: CardProdutoProps) {
    let ehVegano = false;

    // Identifica se o produto atual pertence à categoria de bebidas
    const ehBebida = produto.categoria?.toUpperCase() === "BEBIDAS";

    // Só analisa o JSON descritivo se o produto NÃO for uma bebida
    if (!ehBebida) {
        try {
            if (produto.descricao && (produto.descricao.startsWith("{") || produto.descricao.startsWith("["))) {
                const dadosParseados = JSON.parse(produto.descricao);
                ehVegano = dadosParseados.pratoVegano === "Sim";
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // Ignora falhas de parse de forma segura para não travar a renderização
        }
    }

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