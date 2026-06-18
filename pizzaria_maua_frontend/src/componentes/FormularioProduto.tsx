import { useState } from "react";
//import "./FormularioProduto.css";
import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { useProdutoDadosMutate } from "../hooks/useProdutoDadosMutate";
import { useProdutoMutateEditar } from "../hooks/useProdutoMutateEditar";

interface FormularioProdutoProps {
    fecharModal: () => void;
    produtoParaEditar?: ProdutoDados;
}

export function FormularioProduto({ fecharModal, produtoParaEditar }: FormularioProdutoProps) {
    const [nome, setNome] = useState(produtoParaEditar?.nome || "");
    const [descricao, setDescricao] = useState(produtoParaEditar?.descricao || "");
    const [categoria, setCategoria] = useState(produtoParaEditar?.categoria || "PIZZAS");

    const [precoBase, setPrecoBase] = useState(produtoParaEditar?.precoBase || 0);
    const [imagemUrl, setImagemUrl] = useState(produtoParaEditar?.imagemUrl || "");
    const [ativo, setAtivo] = useState(produtoParaEditar?.ativo ?? true);
    const [qtdEstoque, setQtdEstoque] = useState(produtoParaEditar?.qtdEstoque || 0);

    const { mutate: cadastrarProduto, isPending: isRegistering } = useProdutoDadosMutate();
    const { mutate: editarProduto, isPending: isEditing } = useProdutoMutateEditar();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const produtoPayload: ProdutoDados = {
            id: produtoParaEditar?.id,
            nome,
            descricao,
            categoria,
            precoBase,
            imagemUrl,
            ativo,
            qtdEstoque,
        };

        if (produtoParaEditar) {
            editarProduto(produtoPayload, {
                onSuccess: () => fecharModal(),
            });
        } else {
            cadastrarProduto(produtoPayload, {
                onSuccess: () => fecharModal(),
            });
        }
    };

    const carregando = isRegistering || isEditing;

    return (
        <form onSubmit={handleSubmit} className="formulario-produto">
            <h2>{produtoParaEditar ? "🔧 Editar Produto" : "✨ Novo Produto"}</h2>

            <label>
                Nome do Produto:
                <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                />
            </label>

            <label>
                Descrição:
                <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                />
            </label>

            <div className="form-linha">
                <label>
                    Categoria:
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                        <option value="PIZZAS">Pizza</option>
                        <option value="BEBIDAS">Bebida</option>
                        <option value="SOBREMESAS">Sobremesa</option>
                        {/* CORREÇÃO 2: Alterado o texto de "Sobremesa" para "Acompanhamento" */}
                        <option value="ACOMPANHAMENTOS">Acompanhamento</option>
                    </select>
                </label>

                <label>
                    Preço Base (R$):
                    <input
                        type="number"
                        step="0.01"
                        value={precoBase}
                        onChange={(e) => setPrecoBase(Number(e.target.value))}
                        required
                    />
                </label>
            </div>

            <div className="form-linha">
                <label>
                    Quantidade em Estoque:
                    <input
                        type="number"
                        value={qtdEstoque}
                        onChange={(e) => setQtdEstoque(Number(e.target.value))}
                        required
                    />
                </label>

                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={ativo}
                        onChange={(e) => setAtivo(e.target.checked)}
                    />
                    Disponível no cardápio
                </label>
            </div>

            <label>
                URL da Imagem:
                <input
                    type="text"
                    value={imagemUrl}
                    onChange={(e) => setImagemUrl(e.target.value)}
                    placeholder="Ex: calabresa.png"
                    required
                />
            </label>

            <div className="form-botoes">
                <button type="button" className="btn-cancelar" onClick={fecharModal}>
                    Cancelar
                </button>
                <button type="submit" className="btn-salvar" disabled={carregando}>
                    {carregando ? "Salvando..." : "Confirmar"}
                </button>
            </div>
        </form>
    );
}