import { useState, useEffect } from "react";
import { X, ShieldCheck, User, Lock, ToggleLeft, ToggleRight } from "lucide-react";
import { useMesaDadosMutate } from "../hooks/useMesaDadosMutate";

interface FormularioMesaProps {
    fecharModal: () => void;
    mesasExistentes: number[];
}

export function FormularioMesa({ fecharModal, mesasExistentes }: FormularioMesaProps) {
    const { mutate: cadastrarMesa, isPending } = useMesaDadosMutate();

    // Estados do Formulário
    const [numero, setNumero] = useState<number | "">("");
    const [criarUsuario, setCriarUsuario] = useState(true);
    const [usarPadrao, setUsarPadrao] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [erroValidacao, setErroValidacao] = useState("");

    // Efeito para sugerir login e senha padrão (Ex: mesa11) toda vez que o número mudar
    useEffect(() => {
        if (criarUsuario && usarPadrao && numero !== "") {
            setUsername(`mesa${numero}`);
            setPassword(`mesa${numero}`);
        } else if (!usarPadrao && numero !== "" && username === `mesa${numero}`) {
            // Se desmarcar o padrão, limpa para o usuário digitar do zero
            setUsername("");
            setPassword("");
        }
    }, [numero, criarUsuario, usarPadrao]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErroValidacao("");

        if (!numero) return;

        // Validação de mesa duplicada no front-end
        if (mesasExistentes.includes(Number(numero))) {
            setErroValidacao(`A Mesa ${numero} já está cadastrada no sistema.`);
            return;
        }

        // Monta o payload completo esperado pelo Spring Boot
        const payload = {
            numero: Number(numero),
            criarUsuario,
            username: criarUsuario ? username : undefined,
            password: criarUsuario ? password : undefined, // O Spring Security vai aplicar o BCrypt aqui
        };

        cadastrarMesa(payload, {
            onSuccess: () => fecharModal(),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="formulario-produto animate-fade-in">
            <header className="formulario-header">
                <h2>🪑 Cadastrar Nova Mesa</h2>
                <button type="button" className="btn-fechar-modal" onClick={fecharModal}>
                    <X size={24} />
                </button>
            </header>

            <div className="formulario-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div className="form-secao">
                    <label>
                        <span>Número da Mesa</span>
                        <input
                            type="number"
                            min="1"
                            value={numero}
                            onChange={(e) => setNumero(e.target.value !== "" ? Number(e.target.value) : "")}
                            required
                            placeholder="Ex: 11"
                        />
                    </label>

                    {erroValidacao && <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: "-10px 0 15px 0", fontWeight: 600 }}>❌ {erroValidacao}</p>}

                    {/* Interruptor para Criar Usuário */}
                    <div
                        className={`checkbox-label-destaque ${criarUsuario ? 'ativo' : ''}`}
                        onClick={() => setCriarUsuario(!criarUsuario)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={18} /> Criar usuário de acesso (Tablet) para esta mesa?
                        </span>
                        {criarUsuario ? <ToggleRight size={32} color="#2563eb" /> : <ToggleLeft size={32} color="#64748b" />}
                    </div>

                    {/* Área de Configuração de Credenciais do Spring Security */}
                    {criarUsuario && (
                        <div className="secao-credenciais-mesa animate-fade-in" style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", marginTop: "12px", border: "1px solid #e2e8f0" }}>
                            <label className="checkbox-label" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <input
                                    type="checkbox"
                                    checked={usarPadrao}
                                    onChange={(e) => setUsarPadrao(e.target.checked)}
                                />
                                <span style={{ fontSize: '0.85rem', color: '#475569' }}>Usar padrão sugerido pelo sistema (Recomendado)</span>
                            </label>

                            <div className="form-linha">
                                <label>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> Usuário (Username)</span>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={usarPadrao}
                                        required={criarUsuario}
                                        style={{ backgroundColor: usarPadrao ? "#e2e8f0" : "#fff" }}
                                    />
                                </label>

                                <label>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={14} /> Senha (Password)</span>
                                    <input
                                        type="text" // Texto simples para o gerente ver o que está criando no padrão rápido
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={usarPadrao}
                                        required={criarUsuario}
                                        style={{ backgroundColor: usarPadrao ? "#e2e8f0" : "#fff" }}
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="formulario-footer">
                <button type="button" className="btn-cancelar" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn-salvar" disabled={isPending || numero === ""}>
                    {isPending ? "Salvando..." : "Confirmar Criação"}
                </button>
            </footer>
        </form>
    );
}