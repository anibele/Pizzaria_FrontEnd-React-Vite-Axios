import type { AxiosInstance } from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import type { MesaDados } from '../interfaces/MesaDados';

export type AcaoMesa = 'excluir' | 'desativar' | 'ativar';
export interface EstadoAcaoMesa {
    numero: number | null;
    processando: boolean;
    verificar: boolean;
    sucesso: boolean;
    mensagem: string | null;
}
const inicial: EstadoAcaoMesa = { numero: null, processando: false, verificar: false, sucesso: false, mensagem: null };
const chaveMesas = ['mesa-dados'] as const;

export async function excluirMesa(http: Pick<AxiosInstance, 'delete'>, numero: number): Promise<void> {
    await http.delete(`/mesas/${numero}`, { timeout: 15000 });
}
export async function alterarAtivacaoMesa(http: Pick<AxiosInstance, 'patch'>, dados: { numero: number; ativo: boolean }): Promise<void> {
    await http.patch(`/mesas/${dados.numero}/ativacao?ativo=${dados.ativo}`, null, { timeout: 15000 });
}
export async function consultarMesa(http: Pick<AxiosInstance, 'get'>, numero: number, signal: AbortSignal): Promise<MesaDados | null> {
    try {
        return (await http.get<MesaDados>(`/mesas/${numero}`, { timeout: 15000, signal })).data;
    } catch (erro: unknown) {
        if (statusHttp(erro) === 404) return null;
        throw erro;
    }
}
function statusHttp(erro: unknown) { return (erro as { response?: { status?: number } })?.response?.status; }
class MesaAtualizada extends Error {}
function mensagemErro(erro: unknown): string {
    if (erro instanceof MesaAtualizada) return 'Os dados da mesa mudaram durante a consulta. Verifique novamente.';
    const resposta = (erro as { response?: { data?: { mensagem?: unknown } } })?.response;
    const detalhe = typeof resposta?.data?.mensagem === 'string' ? resposta.data.mensagem : null;
    switch (statusHttp(erro)) {
        case 400: return detalhe || 'Entrada ou operação inválida. Confira os dados da mesa.';
        case 401: return 'Sua sessão expirou. Entre novamente para continuar.';
        case 403: return 'Seu usuário não tem permissão para esta operação.';
        case 404: return 'Mesa inexistente ou já removida.';
        case 409: return detalhe || 'A operação conflita com a situação atual da mesa. Confira os dados.';
        default: return statusHttp(erro) ? 'O servidor não confirmou a operação. Tente verificar os dados da mesa.'
            : 'Falha de conexão ou tempo de espera esgotado. O resultado não foi confirmado.';
    }
}

interface OperacoesMesa {
    excluir: (numero: number) => Promise<void>;
    ativacao: (dados: { numero: number; ativo: boolean }) => Promise<void>;
    consultar: (numero: number, signal: AbortSignal) => Promise<MesaDados | null>;
}

export class AcoesMesa {
    private client: QueryClient;
    private operacoes: OperacoesMesa;
    private estado = inicial;
    private controle: AbortController | null = null;
    private listeners = new Set<() => void>();
    constructor(client: QueryClient, operacoes: OperacoesMesa) { this.client = client; this.operacoes = operacoes; }
    obterEstado = () => this.estado;
    assinar = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private atualizar(estado: EstadoAcaoMesa) { this.estado = estado; this.listeners.forEach(listener => listener()); }
    limpar = () => {
        this.controle?.abort(); this.controle = null;
        this.atualizar(inicial);
    };
    private mesaCache(numero: number) { return this.client.getQueryData<MesaDados[]>(chaveMesas)?.find(m => m.numero === numero); }
    private async consultar(mesa: MesaDados, controle: AbortController) {
        const anterior = this.mesaCache(mesa.numero);
        // Uma leitura mais recente pode manter a mesma referência por structural
        // sharing. O contador já mantido pelo QueryClient identifica essa atualização.
        const revisao = this.client.getQueryState(chaveMesas)?.dataUpdateCount;
        const mudou = () => this.client.getQueryState(chaveMesas)?.dataUpdateCount !== revisao || this.mesaCache(mesa.numero) !== anterior;
        const atual = await this.operacoes.consultar(mesa.numero, controle.signal);
        if (controle.signal.aborted) return null;
        if (mudou()) throw new MesaAtualizada();
        await this.client.cancelQueries({ queryKey: chaveMesas, exact: true }, { revert: false });
        if (controle.signal.aborted) return null;
        if (mudou()) throw new MesaAtualizada();
        this.client.setQueryData<MesaDados[]>(chaveMesas, mesas => {
            if (!mesas) return mesas;
            if (!atual) return mesas.filter(m => m.numero !== mesa.numero);
            return mesas.some(m => m.numero === mesa.numero)
                ? mesas.map(m => m.numero === mesa.numero ? atual : m) : [...mesas, atual];
        });
        return atual;
    }

    executar = (mesa: MesaDados, acao: AcaoMesa) => this.realizar(mesa, acao);
    verificar = (mesa: MesaDados) => this.realizar(mesa);

    private async realizar(mesa: MesaDados, acao?: AcaoMesa): Promise<void> {
        if (this.controle) return;
        if (!Number.isSafeInteger(mesa.id) || !mesa.id || mesa.id <= 0 || !Number.isSafeInteger(mesa.numero) || mesa.numero <= 0) {
            this.atualizar({ ...inicial, numero: mesa.numero, mensagem: 'Não foi possível identificar a mesa com segurança. Atualize a página.' }); return;
        }
        // Enquanto não houver leitura confirmada, qualquer repetição apenas verifica.
        if (this.estado.numero === mesa.numero && this.estado.verificar) acao = undefined;
        const controle = new AbortController();
        this.controle = controle;
        const vigente = () => this.controle === controle;
        let enviou = false;
        this.atualizar({ ...inicial, numero: mesa.numero, processando: true, mensagem: 'Verificando os dados atuais da mesa...' });
        try {
            const atual = await this.consultar(mesa, controle);
            if (!vigente()) return;
            if (!atual) {
                this.atualizar({ ...inicial, numero: mesa.numero, mensagem: 'A mesa não está mais cadastrada. Nenhuma nova alteração foi enviada.' }); return;
            }
            if (atual.id !== mesa.id) {
                this.atualizar({ ...inicial, numero: mesa.numero, mensagem: 'Esta mesa foi substituída por outro cadastro. Feche a janela e confira a mesa atual.' }); return;
            }
            if (!acao) {
                this.atualizar({ ...inicial, numero: mesa.numero, mensagem: `Dados atualizados: mesa ${atual.ativo ? 'ativa' : 'desativada'}, status ${atual.status}. Confira e escolha a ação desejada.` }); return;
            }
            const ativo = acao === 'ativar';
            if (acao !== 'excluir' && atual.ativo === ativo) {
                this.atualizar({ ...inicial, numero: mesa.numero, mensagem: `A mesa já está ${ativo ? 'ativa' : 'desativada'}. Nenhuma alteração foi enviada.` }); return;
            }
            this.atualizar({ ...inicial, numero: mesa.numero, processando: true, mensagem: 'Aguardando confirmação do servidor...' });
            enviou = true;
            if (acao === 'excluir') await this.operacoes.excluir(mesa.numero);
            else await this.operacoes.ativacao({ numero: mesa.numero, ativo });
            if (!vigente()) return;
            // O 204 confirma a operação passada, não o estado atual. Não derivar
            // ativo nem ausência da mesa a partir do comando que acabou de responder.
            // Cancelar sem reverter preserva dados recebidos enquanto o comando aguardava.
            await this.client.cancelQueries({ queryKey: chaveMesas, exact: true }, { revert: false });
            if (!vigente()) return;
            const confirmacao = `Operação confirmada: mesa ${mesa.numero} ${acao === 'excluir' ? 'excluída' : ativo ? 'ativada' : 'desativada'} com sucesso.`;
            this.atualizar({ ...inicial, numero: mesa.numero, processando: true, sucesso: true,
                mensagem: `${confirmacao} Verificando o estado atual...` });
            try {
                const atual = await this.consultar(mesa, controle);
                if (!vigente()) return;
                const situacao = !atual ? 'Na consulta atual, a mesa não está mais cadastrada.'
                    : atual.id !== mesa.id ? 'Consulta atual: outro cadastro ocupa este número. Confira a mesa atual.'
                    : `Consulta atual: mesa ${atual.ativo ? 'ativa' : 'desativada'}, status ${atual.status}.`;
                this.atualizar({ ...inicial, numero: mesa.numero, sucesso: true, mensagem: `${confirmacao} ${situacao}` });
            } catch (erroConsulta: unknown) {
                if (vigente()) this.atualizar({ ...inicial, numero: mesa.numero, sucesso: true, verificar: true,
                    mensagem: `${confirmacao} Não foi possível verificar o estado atual da mesa. ${erroConsulta instanceof MesaAtualizada || statusHttp(erroConsulta) === 401 || statusHttp(erroConsulta) === 403
                        ? mensagemErro(erroConsulta) : 'Use Verificar mesa antes de outra ação.'}` });
            } finally {
                // A consulta da mesa acima é a reconciliação. Não iniciar uma listagem
                // concorrente automaticamente; a lista fica invalidada para a próxima leitura.
                if (vigente()) void this.client.invalidateQueries({ queryKey: chaveMesas, exact: true, refetchType: 'none' });
            }
        } catch (erro: unknown) {
            if (!vigente()) return;
            const mensagem = mensagemErro(erro);
            if (!enviou || statusHttp(erro) === 401 || statusHttp(erro) === 403) {
                this.atualizar({ ...inicial, numero: mesa.numero, verificar: true, mensagem }); return;
            }
            this.atualizar({ ...inicial, numero: mesa.numero, processando: true, mensagem: 'Verificando a mesa após a falha...' });
            try {
                const atual = await this.consultar(mesa, controle);
                if (!vigente()) return;
                this.atualizar({ ...inicial, numero: mesa.numero,
                    mensagem: `${mensagem} ${atual ? `Consulta atual: mesa ${atual.ativo ? 'ativa' : 'desativada'}, status ${atual.status}.` : 'Na consulta atual, a mesa não está mais cadastrada.'}` });
            } catch (erroConsulta: unknown) {
                if (vigente()) this.atualizar({ ...inicial, numero: mesa.numero, verificar: true,
                    mensagem: `${mensagem} Não foi possível verificar os dados atuais. ${mensagemErro(erroConsulta)}` });
            }
        } finally { if (vigente()) this.controle = null; }
    }
}
