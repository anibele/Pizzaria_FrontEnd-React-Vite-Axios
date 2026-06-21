import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { Edit, Trash2, Package, Power, PowerOff } from "lucide-react";

interface CardProdutoGerenteProps {
    produto: ProdutoDados;
    onEditar: (produto: ProdutoDados) => void;
    onDeletar: (produto: ProdutoDados) => void;
}

export function CardProdutoGerente({ produto, onEditar, onDeletar }: CardProdutoGerenteProps) {
    return (
        <div className={`card-gerente ${!produto.ativo ? "inativo" : ""}`}>
            {/* Status visual do produto no topo da imagem */}
            <div className="card-gerente-badges">
                {produto.ativo ? (
                    <span className="badge-ativo"><Power size={12} /> Ativo</span>
                ) : (
                    <span className="badge-inativo"><PowerOff size={12} /> Inativo</span>
                )}
            </div>

            <img src={produto.imagemUrl} alt={produto.nome} className="card-gerente-imagem" />

            <div className="card-gerente-conteudo">
                <div className="card-gerente-header">
                    <span className="card-gerente-categoria">{produto.categoria}</span>
                    <h3 className="card-gerente-nome">{produto.nome}</h3>
                </div>

                <div className="card-gerente-info">
                    <p className="card-gerente-preco">R$ {produto.precoBase.toFixed(2)}</p>
                    <p className="card-gerente-estoque">
                        <Package size={14} /> Estoque: {produto.qtdEstoque}
                    </p>
                </div>

                <div className="card-gerente-acoes">
                    <button onClick={() => onEditar(produto)} className="btn-gerente-editar" title="Editar">
                        <Edit size={18} /> Editar
                    </button>
                    <button onClick={() => onDeletar(produto)} className="btn-gerente-deletar" title="Excluir">
                        <Trash2 size={18} /> Excluir
                    </button>
                </div>
            </div>
        </div>
    );
}