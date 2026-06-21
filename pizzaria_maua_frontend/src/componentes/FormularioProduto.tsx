import { useState } from "react";
import { Save, X, Info, Timer, Leaf, List } from "lucide-react";
import type { ProdutoDados } from "../interfaces/ProdutoDados";
import { useProdutoDadosMutate } from "../hooks/useProdutoDadosMutate";
import { useProdutoMutateEditar } from "../hooks/useProdutoMutateEditar";
import "../styles/formularioProduto.css";

interface FormularioProdutoProps {
    fecharModal: () => void;
    produtoParaEditar?: ProdutoDados;
}

export function FormularioProduto({ fecharModal, produtoParaEditar }: FormularioProdutoProps) {
    // Campos Base
    const [nome, setNome] = useState(produtoParaEditar?.nome || "");
    const [categoria, setCategoria] = useState(produtoParaEditar?.categoria || "PIZZAS");
    const [precoBase, setPrecoBase] = useState(produtoParaEditar?.precoBase || 0);
    const [imagemUrl, setImagemUrl] = useState(produtoParaEditar?.imagemUrl || "");
    const [ativo, setAtivo] = useState(produtoParaEditar?.ativo ?? true);
    const [qtdEstoque, setQtdEstoque] = useState(produtoParaEditar?.qtdEstoque || 0);

    // Campos do Novo Objeto 'Descricao'
    const [breveDescricao, setBreveDescricao] = useState(produtoParaEditar?.descricao?.breveDescricao || "");
    const [tempoMedioPreparo, setTempoMedioPreparo] = useState(produtoParaEditar?.descricao?.tempoMedioPreparo || "");
    const [pratoVegano, setPratoVegano] = useState(produtoParaEditar?.descricao?.pratoVegano || false);
    // Transforma o array de ingredientes em uma string separada por vírgula para o input
    const [ingredientesStr, setIngredientesStr] = useState(produtoParaEditar?.descricao?.ingredientes?.join(", ") || "");

    const { mutate: cadastrarProduto, isPending: isRegistering } = useProdutoDadosMutate();
    const { mutate: editarProduto, isPending: isEditing } = useProdutoMutateEditar();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Converte a string de volta para array, removendo espaços vazios
        const arrayIngredientes = ingredientesStr.split(",").map(i => i.trim()).filter(i => i !== "");

        const produtoPayload: ProdutoDados = {
            id: produtoParaEditar?.id,
            nome,
            categoria,
            precoBase,
            imagemUrl,
            ativo,
            qtdEstoque,
            descricao: {
                breveDescricao,
                tempoMedioPreparo,
                pratoVegano,
                ingredientes: arrayIngredientes
            }
        };

        if (produtoParaEditar) {
            editarProduto(produtoPayload, { onSuccess: () => fecharModal() });
        } else {
            cadastrarProduto(produtoPayload, { onSuccess: () => fecharModal() });
        }
    };

    const carregando = isRegistering || isEditing;
    const ehBebida = categoria === "BEBIDAS";

    return (
        <form onSubmit={handleSubmit} className="formulario-produto animate-fade-in">
            <header className="formulario-header">
                <h2>{produtoParaEditar ? "🔧 Editar Produto" : "✨ Novo Produto"}</h2>
                <button type="button" className="btn-fechar-modal" onClick={fecharModal}><X size={24} /></button>
            </header>

            <div className="formulario-grid">
                {/* COLUNA 1: DADOS BÁSICOS */}
                <div className="form-secao">
                    <h3>Dados Básicos</h3>

                    <label>
                        <span>Nome do Produto</span>
                        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
                    </label>

                    <div className="form-linha">
                        <label>
                            <span>Categoria</span>
                            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                                <option value="PIZZAS">Pizza</option>
                                <option value="BEBIDAS">Bebida</option>
                                <option value="SOBREMESAS">Sobremesa</option>
                                <option value="ACOMPANHAMENTOS">Acompanhamento</option>
                            </select>
                        </label>

                        <label>
                            <span>Preço Base (R$)</span>
                            <input type="number" step="0.01" value={precoBase} onChange={(e) => setPrecoBase(Number(e.target.value))} required />
                        </label>
                    </div>

                    <div className="form-linha">
                        <label>
                            <span>Quantidade em Estoque</span>
                            <input type="number" value={qtdEstoque} onChange={(e) => setQtdEstoque(Number(e.target.value))} required />
                        </label>

                        <label className="checkbox-label-destaque">
                            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                            <span>Visível no Cardápio</span>
                        </label>
                    </div>

                    <label>
                        <span>URL da Imagem</span>
                        <input type="text" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="https://..." required />
                    </label>
                </div>

                {/* COLUNA 2: DETALHES (Novo Objeto) */}
                <div className="form-secao form-secao-detalhes">
                    <h3>Detalhes Técnicos</h3>

                    <label>
                        <span><Info size={16}/> Breve Descrição</span>
                        <textarea value={breveDescricao} onChange={(e) => setBreveDescricao(e.target.value)} rows={3} required placeholder="Descrição apetitosa do item..." />
                    </label>

                    {!ehBebida && (
                        <>
                            <label>
                                <span><Timer size={16}/> Tempo de Preparo</span>
                                <input type="text" value={tempoMedioPreparo} onChange={(e) => setTempoMedioPreparo(e.target.value)} placeholder="Ex: 30-40 min" required={!ehBebida} />
                            </label>

                            <label>
                                <span><List size={16}/> Ingredientes (Separe por vírgula)</span>
                                <textarea value={ingredientesStr} onChange={(e) => setIngredientesStr(e.target.value)} rows={2} placeholder="Mussarela, Molho de Tomate, Orégano..." required={!ehBebida} />
                            </label>

                            <label className="checkbox-label-vegano">
                                <input type="checkbox" checked={pratoVegano} onChange={(e) => setPratoVegano(e.target.checked)} />
                                <span><Leaf size={16}/> Marcar como Prato Vegano</span>
                            </label>
                        </>
                    )}
                </div>
            </div>

            <footer className="formulario-footer">
                <button type="button" className="btn-cancelar" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn-salvar" disabled={carregando}>
                    {carregando ? "Salvando..." : <><Save size={18} /> Confirmar</>}
                </button>
            </footer>
        </form>
    );
}