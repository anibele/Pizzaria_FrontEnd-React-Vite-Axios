import type { ProdutoDados } from '../interfaces/ProdutoDados';

export interface ItemCarrinho { produto: ProdutoDados; quantidade: number }
export interface CarrinhoRecuperado { itens: ItemCarrinho[]; erro: string | null }
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const inteiroPositivo = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
function produtoValido(p: unknown): p is ProdutoDados & { id: number } {
    if (!objeto(p) || !inteiroPositivo(p.id) || typeof p.nome !== 'string' || !p.nome.trim()
        || typeof p.categoria !== 'string' || !['PIZZAS', 'BEBIDAS', 'SOBREMESAS', 'ACOMPANHAMENTOS'].includes(p.categoria)
        || typeof p.precoBase !== 'number' || !Number.isFinite(p.precoBase) || p.precoBase < 0
        || typeof p.imagemUrl !== 'string' || typeof p.ativo !== 'boolean'
        || typeof p.qtdEstoque !== 'number' || !Number.isSafeInteger(p.qtdEstoque) || p.qtdEstoque < 0) return false;
    const d = p.descricao;
    return d === undefined || d === null || (objeto(d) && (d.breveDescricao === null || typeof d.breveDescricao === 'string')
        && (d.tempoMedioPreparo === null || typeof d.tempoMedioPreparo === 'string') && typeof d.pratoVegano === 'boolean'
        && (d.ingredientes === null || (Array.isArray(d.ingredientes) && d.ingredientes.every(i => typeof i === 'string'))));
}

// Somente o carrinho comum: nunca lê, remove ou migra guardas e chaves de operações incertas.
export function recuperarCarrinho(raw: string | null): CarrinhoRecuperado {
    if (raw === null) return { itens: [], erro: null };
    try {
        const dados: unknown = JSON.parse(raw);
        if (!Array.isArray(dados)) throw new Error('Estrutura inválida.');
        const itens: ItemCarrinho[] = [];
        const ids = new Set<number>();
        for (const item of dados) {
            if (!objeto(item) || !produtoValido(item.produto) || !inteiroPositivo(item.quantidade) || item.quantidade > 2147483647
                || ids.has(item.produto.id)) throw new Error('Item inválido.');
            ids.add(item.produto.id);
            itens.push({ produto: item.produto, quantidade: item.quantidade });
        }
        return { itens, erro: null };
    } catch { return { itens: [], erro: 'Não foi possível recuperar a seleção salva. Ela não será enviada nem sobrescrita automaticamente.' }; }
}

export interface ProprietarioCarrinho { username: string; numeroMesa: number }
type ArmazenamentoCarrinho = Pick<Storage, 'getItem' | 'setItem'>;
export const chaveCarrinho = (p: ProprietarioCarrinho) => `pizzaria-carrinho:${JSON.stringify([p.username, p.numeroMesa])}`;
const erroContexto = 'A sessão ou a seleção salva mudou. Atualize a página antes de continuar. Nenhum registro foi removido.';

// Instância ligada ao contexto autenticado de uma montagem. Não acessa registros de operações mutáveis.
export class CarrinhoDaIdentidade {
    readonly inicial: CarrinhoRecuperado;
    private readonly proprietario: ProprietarioCarrinho;
    private readonly chave: string;
    private ultimo: string | null = null;
    private leituraValida = false;
    private erro: string | null = null;
    private storage: ArmazenamentoCarrinho;
    private contextoVigente: () => boolean;

    constructor(storage: ArmazenamentoCarrinho, proprietario: ProprietarioCarrinho, contextoVigente: () => boolean) {
        this.storage = storage;
        this.contextoVigente = contextoVigente;
        this.proprietario = { ...proprietario };
        this.chave = chaveCarrinho(this.proprietario);
        let recuperado: CarrinhoRecuperado = { itens: [], erro: null };
        try {
            if (!proprietario.username.trim() || !inteiroPositivo(proprietario.numeroMesa) || !contextoVigente()) throw new Error();
            this.ultimo = storage.getItem(this.chave);
            this.leituraValida = true;
            if (this.ultimo === null) {
                if (storage.getItem(`carrinho_mesa_${proprietario.numeroMesa}`) !== null) {
                    throw new Error('legado');
                }
            } else {
                const registro: unknown = JSON.parse(this.ultimo);
                if (!objeto(registro) || registro.versao !== 1 || !objeto(registro.proprietario)
                    || registro.proprietario.username !== proprietario.username || registro.proprietario.numeroMesa !== proprietario.numeroMesa) throw new Error();
                recuperado = recuperarCarrinho(JSON.stringify(registro.itens));
                if (recuperado.erro) throw new Error();
            }
        } catch {
            recuperado = { itens: [], erro: 'A seleção salva não tem proprietário verificável ou não pôde ser validada. Você pode iniciar uma nova seleção vazia; os itens antigos não serão transferidos.' };
        }
        this.erro = recuperado.erro;
        this.inicial = recuperado;
    }

    conferir = (): string | null => {
        try {
            if (!this.leituraValida || !this.contextoVigente() || this.storage.getItem(this.chave) !== this.ultimo) return this.erro = erroContexto;
            return this.erro;
        } catch { return this.erro = erroContexto; }
    };

    salvar = (itens: ItemCarrinho[]): string | null => {
        if (this.conferir()) return this.erro;
        return this.gravar(itens);
    };

    iniciarNovo = (): string | null => {
        try {
            if (!this.leituraValida || !this.contextoVigente() || this.storage.getItem(this.chave) !== this.ultimo) return this.erro = erroContexto;
            // Decisão explícita: não importa nem apaga o registro legado de proprietário desconhecido.
            return this.gravar([]);
        } catch { return this.erro = erroContexto; }
    };

    private gravar(itens: ItemCarrinho[]): string | null {
        try {
            if (recuperarCarrinho(JSON.stringify(itens)).erro) throw new Error();
            const registro = JSON.stringify({ versao: 1, proprietario: this.proprietario, itens });
            this.storage.setItem(this.chave, registro);
            if (this.storage.getItem(this.chave) !== registro) throw new Error();
            this.ultimo = registro;
            return this.erro = null;
        } catch { return this.erro = 'Não foi possível proteger a seleção no armazenamento. Nenhum pedido será enviado. Atualize a página para recuperar.'; }
    }
}
