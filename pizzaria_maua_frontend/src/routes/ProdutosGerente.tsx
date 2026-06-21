import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { useProdutoDados } from "../hooks/useProdutoDados";
import { useProdutoDeletar } from "../hooks/useProdutosMutateDelete.ts";
import { FormularioProduto } from "../componentes/FormularioProduto";
import { ListaProdutosGerente } from "../componentes/ListaProdutosGerente"; // 👈 Importação nova
import type { ProdutoDados } from "../interfaces/ProdutoDados";
import "../styles/produtosGerente.css";

export default function ProdutosGerente() {
    const { data: produtos, isLoading, isError } = useProdutoDados();
    const { mutate: deletarProduto, isPending: isDeleting } = useProdutoDeletar();

    const [modalFormAberto, setModalFormAberto] = useState(false);
    const [produtoEmEdicao, setProdutoEmEdicao] = useState<ProdutoDados | undefined>(undefined);
    const [produtoParaDeletar, setProdutoParaDeletar] = useState<ProdutoDados | undefined>(undefined);

    const abrirModalNovo = () => {
        setProdutoEmEdicao(undefined);
        setModalFormAberto(true);
    };

    const abrirModalEditar = (produto: ProdutoDados) => {
        setProdutoEmEdicao(produto);
        setModalFormAberto(true);
    };

    const confirmarDelecao = () => {
        if (produtoParaDeletar?.id) {
            deletarProduto(produtoParaDeletar.id, {
                onSuccess: () => setProdutoParaDeletar(undefined)
            });
        }
    };

    if (isLoading) return <div className="status-tela"><p>⏳ Sincronizando com o estoque...</p></div>;
    if (isError) return <div className="status-tela error"><p>❌ Erro de conexão com a API.</p></div>;

    return (
        <div className="gerente-produtos-container animate-fade-in">
            <div className="topo-painel">
                <div>
                    <h2>📦 Gestão do Cardápio</h2>
                    <p>Controle os produtos, estoque e disponibilidade na loja.</p>
                </div>
                <button className="btn-novo-produto" onClick={abrirModalNovo}>
                    <Plus size={20} /> Cadastrar Produto
                </button>
            </div>

            {/* 👇 Aqui chamamos a Lista Separada por Categorias */}
            {produtos && produtos.length > 0 ? (
                <ListaProdutosGerente
                    produtos={produtos}
                    onEditar={abrirModalEditar}
                    onDeletar={setProdutoParaDeletar}
                />
            ) : (
                <div className="sem-produtos">Nenhum produto cadastrado no banco de dados.</div>
            )}

            {modalFormAberto && (
                <div className="overlay-modal">
                    <div className="modal-conteudo modal-largo">
                        <FormularioProduto
                            fecharModal={() => setModalFormAberto(false)}
                            produtoParaEditar={produtoEmEdicao}
                        />
                    </div>
                </div>
            )}

            {produtoParaDeletar && (
                <div className="overlay-modal">
                    <div className="modal-conteudo modal-pequeno animate-fade-in">
                        <div className="modal-deletar-header">
                            <AlertTriangle size={40} color="#e53935" />
                            <h3>Excluir Produto?</h3>
                        </div>
                        <p>Tem certeza que deseja remover <strong>{produtoParaDeletar.nome}</strong>? Esta ação não pode ser desfeita.</p>

                        <div className="modal-deletar-acoes">
                            <button className="btn-cancelar" onClick={() => setProdutoParaDeletar(undefined)} disabled={isDeleting}>
                                Cancelar
                            </button>
                            <button className="btn-deletar-confirmar" onClick={confirmarDelecao} disabled={isDeleting}>
                                {isDeleting ? "Excluindo..." : "Sim, Excluir"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}