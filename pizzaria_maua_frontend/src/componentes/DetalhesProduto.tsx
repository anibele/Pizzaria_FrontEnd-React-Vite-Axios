//import "./DetalhesProduto.css";
import type { ProdutoDados } from "../interfaces/ProdutoDados";

interface DetalhesProdutoProps {
    produto: ProdutoDados;
}

export function DetalhesProduto({ produto }: DetalhesProdutoProps) {
    return (
        <div className="detalhes-container">
            <img src={produto.imagemUrl} alt={`Imagem de ${produto.nome}`} />

            <div className="detalhes-info">
                <h2>{produto.nome}</h2>
                <p><strong>Categoria:</strong> {produto.categoria}</p>

                <div className="detalhes-descricao">
                    <strong>Descrição:</strong>
                    <p>{produto.descricao}</p>
                </div>

                <div className="detalhes-meta">
                    <p><strong>Preço Base:</strong> R$ {produto.precoBase.toFixed(2)}</p>
                    <p><strong>Estoque Atual:</strong> {produto.qtdEstoque} unidades</p>
                    <p><strong>Status do Cardápio:</strong> {produto.ativo ? "Ativo (Visível)" : "Inativo"}</p>
                </div>
            </div>
        </div>
    );
}