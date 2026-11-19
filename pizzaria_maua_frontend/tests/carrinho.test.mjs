import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CarrinhoDaIdentidade, chaveCarrinho } from '../src/services/carrinhoPersistido.ts';
import { CHAVE_SESSAO_ADICAO, definirVinculoAutenticado } from '../src/services/sessaoAdicao.ts';
import { controleHttpSessao } from '../src/services/httpSessao.ts';
import { GestorAdicao } from '../src/services/adicaoPendente.ts';
import { GestorAbertura } from '../src/services/aberturaPendente.ts';

// Só adapta o snapshot SSR: os gestores e as decisões de produção continuam reais.
registerHooks({ load(url, context, next) {
    if (url.endsWith('/src/services/api.ts')) return { format: 'module', shortCircuit: true,
        source: 'export default { get: async () => { throw new Error("Sem rede no teste"); } };' };
    if (/\.(png|jpg|ico)$/.test(url)) return { format: 'module', shortCircuit: true, source: 'export default "imagem";' };
    if (/\/src\/hooks\/usePedido(Criar|AdicionarItens|Finalizar)\.ts$/.test(url)) {
        const source = readFileSync(fileURLToPath(url), 'utf8').replaceAll('useSyncExternalStore(gestor.assinar, gestor.obterEstado)',
            'useSyncExternalStore(gestor.assinar, gestor.obterEstado, gestor.obterEstado)');
        return { format: 'module', shortCircuit: true, source: ts.transpileModule(source,
            { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText };
    }
    return next(url, context);
} });
const { AuthContext } = await import('../src/contexts/AuthContext.tsx');
const { default: Cardapio } = await import('../src/routes/CardapioCliente.tsx');
const A = { username: 'cliente personalizado A', numeroMesa: 7 };
const B = { username: 'tabletPrincipal', numeroMesa: 7 };
const produto = { id: 4, nome: 'Pizza sintética', categoria: 'PIZZAS', descricao: null, precoBase: 10,
    imagemUrl: '/imagem.png', ativo: true, qtdEstoque: 10 };
const itens = [{ produto, quantidade: 3 }];
function memoria() {
    const dados = new Map(); return { dados, getItem: k => dados.get(k) ?? null,
        setItem: (k,v) => dados.set(k,v), removeItem: k => dados.delete(k) };
}
const gestor = (s, p = A, atual = () => true) => new CarrinhoDaIdentidade(s,p,atual);

test('carrinho: A e B na mesma mesa ficam isolados; A recupera seleção e outra mesa não a reutiliza', () => {
    const s = memoria(); assert.equal(gestor(s).salvar(itens),null);
    const original = s.getItem(chaveCarrinho(A));
    assert.deepEqual(gestor(s,B).inicial,{ itens: [], erro: null });
    assert.equal(gestor(s,B).salvar([{ produto, quantidade: 1 }]),null);
    assert.deepEqual(gestor(s).inicial.itens,itens);
    assert.deepEqual(gestor(s,{ ...A, numeroMesa: 8 }).inicial.itens,[]);
    assert.equal(s.getItem(chaveCarrinho(A)),original);
});

test('carrinho: legado nunca é atribuído nem apagado; ação explícita começa vazio', () => {
    const s = memoria(), legado = JSON.stringify(itens); s.setItem('carrinho_mesa_7',legado);
    for (const p of [A,B]) {
        const g = gestor(s,p); assert.ok(g.inicial.erro); assert.deepEqual(g.inicial.itens,[]);
        assert.ok(g.salvar([])); assert.equal(s.getItem(chaveCarrinho(p)),null);
        assert.equal(g.iniciarNovo(),null); assert.deepEqual(gestor(s,p).inicial.itens,[]);
    }
    assert.equal(s.getItem('carrinho_mesa_7'),legado);
});

test('carrinho: JSON, payload e proprietário incompatíveis bloqueiam escrita automática', () => {
    for (const raw of ['{', '[]', JSON.stringify({ versao: 1, proprietario: B, itens }),
        JSON.stringify({ versao: 1, proprietario: A, itens: [{}] }), JSON.stringify({ versao: 1, proprietario: { ...A, numeroMesa: 8 }, itens })]) {
        const s = memoria(); s.setItem(chaveCarrinho(A),raw); const g = gestor(s);
        assert.ok(g.inicial.erro); assert.ok(g.salvar([])); assert.equal(s.getItem(chaveCarrinho(A)),raw);
    }
});

test('carrinho: montagem e remontagem não escrevem seleção vazia sobre registro válido', () => {
    const s = memoria(); gestor(s).salvar(itens); const raw = s.getItem(chaveCarrinho(A));
    for (let i=0;i<2;i++) { const g = gestor(s); assert.deepEqual(g.inicial.itens,itens); assert.equal(g.salvar(g.inicial.itens),null); }
    assert.equal(s.getItem(chaveCarrinho(A)),raw);
});

test('carrinho: efeito ou limpeza atrasados de sessão A não escrevem em A nem B após troca', () => {
    const s = memoria(); let sessao = 'A'; const antigo = gestor(s,A,()=>sessao==='A'); antigo.salvar(itens);
    sessao = 'B'; const novo = gestor(s,B,()=>sessao==='B'); novo.salvar([{ produto, quantidade: 1 }]);
    const antes = new Map(s.dados);
    assert.ok(antigo.salvar([])); assert.ok(antigo.iniciarNovo()); assert.deepEqual(s.dados,antes);
});

test('carrinho: atualização de outra aba invalida instância antiga antes de persistir ou limpar', () => {
    const s = memoria(); gestor(s).salvar(itens); const antigo = gestor(s), novo = gestor(s);
    novo.salvar([{ produto, quantidade: 2 }]); const raw = s.getItem(chaveCarrinho(A));
    assert.ok(antigo.conferir()); assert.ok(antigo.salvar([])); assert.ok(antigo.iniciarNovo());
    assert.equal(s.getItem(chaveCarrinho(A)),raw);
});

test('carrinho: leitura ou escrita indisponíveis recusam recuperação e submissão protegida', () => {
    const leitura = gestor({ getItem() { throw new Error(); }, setItem() { assert.fail(); } });
    assert.ok(leitura.inicial.erro); assert.ok(leitura.salvar(itens)); assert.ok(leitura.iniciarNovo());
    const s = memoria(); let falhar = true;
    const g = gestor({ ...s, setItem(k,v) { if (falhar) throw new Error(); s.setItem(k,v); } });
    assert.ok(g.salvar(itens)); assert.ok(g.conferir()); assert.equal(s.getItem(chaveCarrinho(A)),null);
    falhar = false; assert.equal(g.iniciarNovo(),null); assert.deepEqual(gestor(s).inicial.itens,[]);
});

test('carrinho: revisão do carrinho não apaga abertura ou adição incertas', async () => {
    const s = memoria(), contexto = { ...A, role: 'MESA', sessao: 'original' };
    const abertura = new GestorAbertura(s,contexto,()=>contexto), adicao = new GestorAdicao(s,contexto,()=>contexto);
    await abertura.enviar([{ produtoId: 4, quantidade: 3 }], async()=>{ throw new Error('rede'); },()=>assert.fail());
    await adicao.enviar(15,[{ produtoId: 4, quantidade: 3 }],async()=>{ throw new Error('rede'); },()=>assert.fail());
    const pendentes = new Map(s.dados); s.setItem('carrinho_mesa_7',JSON.stringify(itens));
    assert.equal(gestor(s).iniciarNovo(),null);
    for (const [key,raw] of pendentes) assert.equal(s.getItem(key),raw);
    assert.equal(abertura.obterEstado().protegida,true); assert.ok(adicao.obterEstado().pendente);
});

function renderizar(s, p, status = 'OCUPADA') {
    globalThis.localStorage = s; globalThis.sessionStorage = memoria();
    const user = { ...p, role: 'MESA' }; s.setItem('token','token-sintetico'); s.setItem('user',JSON.stringify(user));
    s.setItem(CHAVE_SESSAO_ADICAO,JSON.stringify({ username: p.username, role: 'MESA', sessao: `sessao-${p.username}` }));
    definirVinculoAutenticado({ ...user, token: 'token-sintetico' });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    cache.setQueryData(['status-tablet-mesa',p.numeroMesa],{ id: 7, numero: p.numeroMesa, status, ativo: true });
    cache.setQueryData(['produtos-ativos'],[produto]);
    cache.setQueryData(['pedido-mesa-aberto',p.numeroMesa], status === 'LIVRE' ? null : { id: 15, numeroMesa: p.numeroMesa,
        status: 'ABERTO', itens: [], dataHora: '2026-11-19T19:00:00', formaPagamento: null, faturamento: 0 });
    try { return renderToStaticMarkup(createElement(QueryClientProvider,{ client: cache },createElement(AuthContext.Provider,
        { value: { user, loading: false, authenticated: true, versaoSessao: controleHttpSessao.geracao } }, createElement(Cardapio)))); }
    finally { cache.clear(); definirVinculoAutenticado(null); delete globalThis.localStorage; delete globalThis.sessionStorage; }
}

test('carrinho UI: reprodução original com dois usuários não oferece a B o envio da seleção de A', () => {
    const s = memoria(); gestor(s).salvar(itens); const raw = s.getItem(chaveCarrinho(A));
    const htmlA = renderizar(s,A), htmlB = renderizar(s,B);
    assert.match(htmlA,/3x<\/strong>/); assert.match(htmlA,/Enviar à Cozinha/);
    assert.doesNotMatch(htmlB,/3x<\/strong>|Enviar à Cozinha/);
    assert.equal(s.getItem(chaveCarrinho(A)),raw);
});

test('carrinho UI: legado e metadados inválidos exibem revisão sem revelar itens ou liberar envio', () => {
    const s = memoria(); s.setItem('carrinho_mesa_7',JSON.stringify(itens)); const antes = s.getItem('carrinho_mesa_7');
    const html = renderizar(s,B); assert.match(html,/Iniciar nova seleção vazia/);
    assert.doesNotMatch(html,/Pizza sintética|Enviar à Cozinha/); assert.equal(s.getItem('carrinho_mesa_7'),antes);
    s.setItem(chaveCarrinho(B),JSON.stringify({ versao: 1, proprietario: A, itens }));
    assert.doesNotMatch(renderizar(s,B),/Pizza sintética|Enviar à Cozinha/);
});
