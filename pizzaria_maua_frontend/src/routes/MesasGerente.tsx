import { useState } from "react";
import { useMesaDados } from "../hooks/useMesaDados";
import { useMesaDadosMutate } from "../hooks/useMesaDadosMutate";
import { useMesaMutateStatus } from "../hooks/useMesaMutateStatus";
import { useMesaDeletar } from "../hooks/useMesaDelete";

export default function MesasGerente() {
    // Consumo dos Hooks de dados e mutações
    const { data: mesas, isLoading, isError } = useMesaDados();
    const { mutate: cadastrarMesa } = useMesaDadosMutate();
    const { mutate: atualizarStatus } = useMesaMutateStatus();
    const { mutate: deletarMesa } = useMesaDeletar();

    // Estado local simplificado para controlar o formulário inline
    const [novoNumero, setNovoNumero] = useState<number | "">("");

    const handleCadastrar = (e: React.FormEvent) => {
        e.preventDefault();
        if (novoNumero) {
            cadastrarMesa({ numero: Number(novoNumero) }, {
                onSuccess: () => setNovoNumero("") // Limpa o input se cadastrar com sucesso
            });
        }
    };

    const handleAlternarStatus = (numero: number, statusAtual: 'LIVRE' | 'OCUPADA') => {
        const novoStatus = statusAtual === 'LIVRE' ? 'OCUPADA' : 'LIVRE';
        atualizarStatus({ numero, status: novoStatus });
    };

    const handleDeletar = (numero: number) => {
        if (window.confirm(`Deseja realmente remover a Mesa ${numero}?`)) {
            deletarMesa(numero);
        }
    };

    if (isLoading) return <p>⏳ Carregando mapa de mesas...</p>;
    if (isError) return <p>❌ Erro ao buscar dados das mesas da API.</p>;

    return (
        <div style={{ padding: "20px" }}>
            <h2>🪑 Gerenciamento de Mesas do Salão</h2>

            {/* Formulário Rápido de Cadastro */}
            <form onSubmit={handleCadastrar} style={{ marginBottom: "30px" }}>
                <label>
                    Número da Mesa:
                    <input
                        type="number"
                        value={novoNumero}
                        onChange={(e) => setNovoNumero(e.target.value !== "" ? Number(e.target.value) : "")}
                        min="1"
                        required
                    />
                </label>
                <button type="submit" style={{ marginLeft: "10px" }}>+ Adicionar Mesa</button>
            </form>

            {/* Listagem Estrutural das Mesas */}
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                {mesas && mesas.length > 0 ? (
                    mesas.map((mesa) => (
                        <div key={mesa.numero} style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "5px", width: "160px" }}>
                            <h3>Mesa {mesa.numero}</h3>
                            <p>Status: <strong>{mesa.status}</strong></p>

                            <button
                                onClick={() => handleAlternarStatus(mesa.numero, mesa.status)}
                                style={{ display: "block", width: "100%", marginBottom: "5px", cursor: "pointer" }}
                            >
                                Mudar para {mesa.status === 'LIVRE' ? 'OCUPADA' : 'LIVRE'}
                            </button>

                            <button
                                onClick={() => handleDeletar(mesa.numero)}
                                style={{ display: "block", width: "100%", backgroundColor: "#ffc9c9", color: "red", border: "1px solid red", cursor: "pointer" }}
                            >
                                Remover Mesa
                            </button>
                        </div>
                    ))
                ) : (
                    <p>Nenhuma mesa cadastrada no sistema.</p>
                )}
            </div>
        </div>
    );
}