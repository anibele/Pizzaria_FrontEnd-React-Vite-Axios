import { useState } from "react";
import { useProdutoDados } from "../hooks/useProdutoDados";
import { CartaoProduto } from "../componentes/CartaoProduto";
import { FormularioProduto } from "../componentes/FormularioProduto";
//import "./ProdutosGerente.css";

export default function ProdutosGerente() {
    // Consome os dados da API usando o hook assíncrono do TanStack Query
    const { data: produtos, isLoading, isError } = useProdutoDados();

    // Estado local para gerenciar a abertura do modal de NOVO produto
    const [modalNovoAberto, setModalNovoAberto] = useState(false);

    if (isLoading) return <div className="status-tela"><p>⏳ Carregando produtos do banco de dados...</p></div>;
    if (isError) return <div className="status-tela error"><p>❌ Erro ao conectar com a API do Spring Boot. Verifique o servidor.</p></div>;

    return (
        <div className="gerente-produtos-container">
            <div className="topo-painel">
                <div>
                    <h2>📦 Gestão do Cardápio e Estoque</h2>
                    <p>Visualize, edite, exclua ou adicione novos produtos à Pizzaria Mauá.</p>
                </div>
                <button
                    className="btn-novo-produto"
                    onClick={() => setModalNovoAberto(true)}
                >
                    + Cadastrar Novo Item
                </button>
            </div>

            {/* Grid dinâmica renderizando os cartões de produtos */}
            <div className="grid-produtos">
                {produtos && produtos.length > 0 ? (
                    produtos.map((produto) => (
                        <CartaoProduto key={produto.id} produto={produto} />
                    ))
                ) : (
                    <p className="sem-produtos">Nenhum produto cadastrado no banco de dados.</p>
                )}
            </div>

            {/* Modal para inserção de um novo produto do zero */}
            {modalNovoAberto && (
                <div className="overlay">
                    <div className="modal">
                        <button
                            className="fechar"
                            onClick={() => setModalNovoAberto(false)}
                        >
                            X
                        </button>
                        <FormularioProduto fecharModal={() => setModalNovoAberto(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}