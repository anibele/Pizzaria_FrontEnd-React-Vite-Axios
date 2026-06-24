import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { Search, Plus, Leaf } from "lucide-react";

import "../styles/cardProduto.css";

interface CardProdutoProps {
    produto: ProdutoDados;
    onVerDetalhes: (produto: ProdutoDados) => void;
    onAdicionar: (produto: ProdutoDados) => void;
}

export default function CardProduto({
                                        produto,
                                        onVerDetalhes,
                                        onAdicionar,
                                    }: CardProdutoProps) {

    const ehBebida =
        produto.categoria?.toUpperCase() === "BEBIDAS";

    const ehVegano =
        !ehBebida &&
        produto.descricao?.pratoVegano === true;

    return (
        <div
            className="card-produto"
            onClick={() => onVerDetalhes(produto)}
        >
            {ehVegano && (
                <div className="badge-vegano-tag">
                    <Leaf size={12} />
                    <span>Prato Vegano</span>
                </div>
            )}

            <img
                src={produto.imagemUrl}
                alt={produto.nome}
                className="produto-imagem"
            />

            <div className="produto-info">

                <h3 className="produto-nome">
                    {produto.nome}
                </h3>

                <button
                    className="btn-detalhes"
                    onClick={(e) => {
                        e.stopPropagation();
                        onVerDetalhes(produto);
                    }}
                >
                    <Search size={15} />
                    <span>Toque para ver detalhes</span>
                </button>

            </div>

            <div className="produto-footer">

                <div className="produto-preco">
                    R$ {produto.precoBase.toFixed(2)}
                </div>

                <button
                    className="btn btn-accent"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdicionar(produto);
                    }}
                >
                    <Plus size={18} />
                    <span>Adicionar</span>
                </button>

            </div>
        </div>
    );
}