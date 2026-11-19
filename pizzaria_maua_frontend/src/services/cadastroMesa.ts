export interface DadosFormularioMesa {
    numero: number | "";
    criarUsuario: boolean;
    usarPadrao: boolean;
    username: string;
    password: string;
}

interface PayloadCadastroMesa {
    numero: number;
    criarUsuario: boolean;
    username?: string;
    password?: string;
}

// Representação auxiliar para detectar previsibilidade; nunca compõe o payload.
const compararCredencial = (valor: string) => valor.normalize("NFKC").toLowerCase()
    .replace(/[\p{White_Space}\p{Punctuation}\p{Format}\p{Default_Ignorable_Code_Point}]/gu, "");

export function prepararCadastroMesa(dados: DadosFormularioMesa, mesasExistentes: readonly number[]): PayloadCadastroMesa {
    const { numero, criarUsuario, usarPadrao, username, password } = dados;
    if (!Number.isSafeInteger(numero) || Number(numero) <= 0) throw new Error("Informe um número de mesa válido.");
    if (mesasExistentes.includes(Number(numero))) throw new Error(`A Mesa ${numero} já está cadastrada no sistema.`);
    if (!criarUsuario) return { numero: Number(numero), criarUsuario: false };

    const login = usarPadrao ? `mesa${numero}` : username;
    if (!login.trim()) throw new Error("Informe o username da mesa.");
    if (typeof Intl.Segmenter !== "function") throw new Error("Atualize o navegador para validar a senha com segurança e criar o usuário da mesa.");
    // Invisíveis nas pontas também não podem esconder espaços de preenchimento.
    const paraContagem = password.replace(/^[\p{White_Space}\p{Format}\p{Default_Ignorable_Code_Point}]+|[\p{White_Space}\p{Format}\p{Default_Ignorable_Code_Point}]+$/gu, "");
    const caracteres = [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(paraContagem)]
        // Não dividir emojis compostos nem contar formatação invisível isolada.
        .filter(({ segment }) => !/^[\p{Format}\p{Default_Ignorable_Code_Point}]+$/u.test(segment)).length;
    if (caracteres < 12) throw new Error("Defina uma senha com pelo menos 12 caracteres, sem contar espaços nas extremidades.");
    // Limite conservador para o BCrypt utilizado pelo backend, inclusive com Unicode.
    if (new TextEncoder().encode(password).length > 72) throw new Error("A senha está muito longa. Use uma senha menor.");
    const senhaComparada = compararCredencial(password);
    if (senhaComparada === compararCredencial(login)
        || /^mesa\p{Decimal_Number}+$/u.test(senhaComparada) || /^\p{Decimal_Number}+$/u.test(senhaComparada)) {
        throw new Error("A senha não pode ser igual ao username nem usar apenas números ou o padrão mesa seguido de número.");
    }
    return { numero: Number(numero), criarUsuario: true, username: login, password };
}

// O formulário usa este mesmo fluxo; falhas HTTP nunca são exibidas com payload/credenciais.
export async function submeterCadastroMesa(dados: DadosFormularioMesa, mesasExistentes: readonly number[],
    executar: (payload: PayloadCadastroMesa) => Promise<unknown>): Promise<string | null> {
    let payload: PayloadCadastroMesa;
    try { payload = prepararCadastroMesa(dados, mesasExistentes); }
    catch (erro: unknown) { return erro instanceof Error ? erro.message : "Confira os dados da mesa."; }
    try { await executar(payload); return null; }
    catch { return "Não foi possível cadastrar a mesa. Confira os dados e tente novamente."; }
}
