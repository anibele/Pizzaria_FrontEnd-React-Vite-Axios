import { useState } from "react";
//import "./CartaoProduto.css";
import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { useProdutoDeletar } from "../hooks/useProdutosMutateDelete";
import { DetalhesProduto } from "./DetalhesProduto";
import { FormularioProduto } from "./FormularioProduto";

interface CartaoProdutoProps {
    produto: ProdutoDados;
}

export function CartaoProduto({ produto }: CartaoProdutoProps) {
    const [modalEditarAberto, setModalEditarAberto] = useState(false);
    const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);

    const { mutate: deletarProduto, isPending: isDeleting } = useProdutoDeletar();

    const handleDeletar = () => {
        if (window.confirm(`Deseja realmente excluir o produto "${produto.nome}"?`)) {
            deletarProduto(produto.id!);
        }
    };

    return (
        <div className="cartao">
            <img src={produto.imagemUrl} alt={`Imagem de ${produto.nome}`} />

            <div className="cartao-conteudo">
                <h2>{produto.nome}</h2>

                <p><strong>Categoria:</strong> {produto.categoria}</p>
                <p><strong>Valor:</strong> R$ {produto.precoBase.toFixed(2)}</p>
                <p><strong>Estoque:</strong> {produto.qtdEstoque} un</p>
                <p><strong>Status:</strong> {produto.ativo ? "Ativo" : "Inativo"}</p>

                {/* Botões de Ação */}
                <div className="cartao-acoes">
                    <button
                        className="btn-detalhes"
                        onClick={() => setModalDetalhesAberto(true)}
                    >
                        Ver Detalhes
                    </button>

                    <button
                        className="btn-editar"
                        onClick={() => setModalEditarAberto(true)}
                    >
                        Editar Produto
                    </button>

                    <button
                        className="btn-deletar"
                        onClick={handleDeletar}
                        disabled={isDeleting}
                    >
                        {isDeleting ? "Excluindo..." : "Excluir Produto"}
                    </button>
                </div>
            </div>

            {/* Modal de Detalhes */}
            {modalDetalhesAberto && (
                <div className="overlay">
                    <div className="modal">
                        <button
                            className="fechar"
                            onClick={() => setModalDetalhesAberto(false)}
                        >
                            X
                        </button>
                        <DetalhesProduto produto={produto} />
                    </div>
                </div>
            )}

            {/* Modal de Edição */}
            {modalEditarAberto && (
                <div className="overlay">
                    <div className="modal">
                        <button
                            className="fechar"
                            onClick={() => setModalEditarAberto(false)}
                        >
                            X
                        </button>
                        <FormularioProduto
                            produtoParaEditar={produto}
                            fecharModal={() => setModalEditarAberto(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}