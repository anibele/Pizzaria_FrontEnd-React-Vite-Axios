export const CHAVE_SESSAO_ADICAO = "pizzaria-adicao-sessao";
export const CHAVE_ADICAO_PENDENTE = "pizzaria-adicao-pendente";

interface VinculoAutenticado { username: string; role: string; numeroMesa: number | null; token: string }
let vinculo: VinculoAutenticado | null = null;
export function definirVinculoAutenticado(atual: VinculoAutenticado | null): void { vinculo = atual; }

export interface ContextoAdicao {
    sessao: string;
    username: string;
    role: string;
    numeroMesa: number;
}

export function novoUUID(fonte: Crypto = globalThis.crypto): string {
    if (typeof fonte.randomUUID === "function") return fonte.randomUUID();
    // Tablets em HTTP na rede local podem nao ter randomUUID, mas tem getRandomValues.
    const bytes = fonte.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function garantirSessaoAdicao(user: { username: string; role: string }, nova = false): boolean {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_SESSAO_ADICAO) || "null");
        if (!nova && salvo?.username === user.username && salvo?.role === user.role && typeof salvo.sessao === "string") return true;
        localStorage.removeItem(CHAVE_SESSAO_ADICAO); // Nao conservar nonce antigo se a gravacao falhar.
        const registro = JSON.stringify({ username: user.username, role: user.role, sessao: novoUUID() });
        localStorage.setItem(CHAVE_SESSAO_ADICAO, registro);
        return localStorage.getItem(CHAVE_SESSAO_ADICAO) === registro;
        // Uma pendencia de outra sessao permanece bloqueada, nunca e reutilizada.
    } catch { return false; }
}

export function contextoAtualAdicao(numeroMesa: number): ContextoAdicao | null {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const sessao = JSON.parse(localStorage.getItem(CHAVE_SESSAO_ADICAO) || "null");
        if (!vinculo || vinculo.role !== 'MESA' || vinculo.numeroMesa !== numeroMesa
            || vinculo.token !== localStorage.getItem('token') || user?.username !== vinculo.username || user?.role !== vinculo.role
            || !localStorage.getItem("token") || !user || !sessao || !Number.isSafeInteger(numeroMesa) || numeroMesa <= 0
            || user.username !== sessao.username || user.role !== sessao.role || typeof sessao.sessao !== "string") return null;
        return { sessao: sessao.sessao, username: user.username, role: user.role, numeroMesa };
    } catch { return null; }
}

export function encerrarSessaoAdicao(): void {
    definirVinculoAutenticado(null);
    try {
        localStorage.removeItem(CHAVE_SESSAO_ADICAO);
        // A pendência incerta permanece preservada; outra sessão não pode reenviá-la.
    } catch { /* Sem sessao valida, nenhuma pendencia pode ser reenviada. */ }
}
