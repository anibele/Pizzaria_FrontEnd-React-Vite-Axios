import axios from 'axios';
import { consultarArquivo, consultarFaturamento, consultarDashboard } from '../src/services/consultasOperacionais.ts';
import { dataFinanceira } from '../src/services/dataFinanceira.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Adaptação local ao Node: componentes reais, sem Vite/window e sem transporte de rede.
registerHooks({
    resolve(specifier, context, next) {
        if (/^primereact\/[^/]+$/.test(specifier)) return next(`${specifier}/${specifier.split('/')[1]}.cjs.js`, context);
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url.endsWith('/src/services/api.ts')) return { format: 'module', shortCircuit: true,
            source: 'export default { get: async () => { throw new Error("HTTP indisponivel no teste SSR"); } };' };
        if (/\.(png|jpg|ico)$/.test(url)) return { format: 'module', shortCircuit: true, source: 'export default "imagem-sintetica";' };
        return next(url, context);
    },
});
const { AuthContext } = await import('../src/contexts/AuthContext.tsx');
const { default: Arquivo } = await import('../src/pages/ArquivoCaixa.tsx');
const { default: Caixa } = await import('../src/pages/DashboardCaixa.tsx');
const { default: Painel } = await import('../src/pages/PainelAnalitico.tsx');
const { default: Cardapio } = await import('../src/routes/CardapioCliente.tsx');
const hoje = dataFinanceira;
function cache(t) {
    // Preserva o erro já resolvido no snapshot SSR, sem um retry otimista de montagem.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: Infinity } } });
    t.after(() => client.clear()); return client;
}
async function rejeitar(client,key) {
    await assert.rejects(client.fetchQuery({ queryKey: key, queryFn: async () => { throw { response: { status: 500 } }; } }));
}
function renderizar(componente,client,role = 'CAIXA') {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AuthContext.Provider, { value: { user: { username: 'usuario-sintetico', role, numeroMesa: role === 'MESA' ? 7 : null }, loading: false, authenticated: true, versaoSessao: 0 } },
            createElement(componente))));
}

test('FE013 UI: erro no arquivo nao apresenta lista vazia ou total zero', async t => {
    const c = cache(t); await rejeitar(c,['pedidos','finalizados',hoje()]);
    const html = renderizar(Arquivo,c);
    assert.match(html,/Não foi possível consultar/); assert.match(html,/Indisponível/);
    assert.doesNotMatch(html,/Nenhum pedido finalizado|R\$ 0\.00/);
});
test('FE013 UI: arquivo realmente vazio permanece diferente de erro', t => {
    const c = cache(t); c.setQueryData(['pedidos','finalizados',hoje()],[]);
    const html = renderizar(Arquivo,c);
    assert.match(html,/Nenhum pedido finalizado/); assert.match(html,/R\$ 0\.00/); assert.doesNotMatch(html,/Não foi possível consultar/);
});
test('FE013 UI: erro de fila no caixa nao afirma ausencia de movimento', async t => {
    const c = cache(t); await rejeitar(c,['pedidos-cozinha']);
    const html = renderizar(Caixa,c);
    assert.match(html,/Não foi possível atualizar os pedidos do caixa/); assert.doesNotMatch(html,/Nenhum movimento no momento|Confirmar Recebimento/);
});

test('FE014: DTO invalido vira erro de consulta no arquivo e no caixa, sem quebrar a renderizacao', async t => {
    const invalido = { id: 1, numeroMesa: 7, status: 'AGUARDANDO_PAGAMENTO', itens: [{}] };
    const arquivo = cache(t);
    await assert.rejects(arquivo.fetchQuery({ queryKey: ['pedidos','finalizados',hoje()],
        queryFn: () => consultarArquivo({ get: async () => ({ data: [invalido] }) }, hoje(), new AbortController().signal) }), /incompatíveis/);
    assert.match(renderizar(Arquivo,arquivo), /Não foi possível consultar/);
    const caixa = cache(t);
    caixa.setQueryData(['pedidos-cozinha'],[invalido]);
    assert.match(renderizar(Caixa,caixa), /Não foi possível atualizar os pedidos do caixa/);
});
test('FE013 UI: falha de faturamento nao e mostrada como zero', async t => {
    const c = cache(t); c.setQueryData(['pedidos-cozinha'],[]); await rejeitar(c,['faturamento',hoje()]);
    const html = renderizar(Caixa,c);
    assert.match(html,/Indisponível/); assert.match(html,/Atualizar faturamento/); assert.doesNotMatch(html,/R\$ 0\.00/);
});
test('FE013 UI: painel nao apresenta indicadores financeiros ficticios apos erro', async t => {
    const c = cache(t); await rejeitar(c,['dashboard-indicadores',hoje()]);
    const html = renderizar(Painel,c,'GERENTE');
    assert.match(html,/Não foi possível carregar os indicadores/); assert.doesNotMatch(html,/Faturamento Hoje|R\$/);
});
test('FE013 UI: mesa nao consultada bloqueia cardapio e oferece somente recuperacao de leitura', async t => {
    const c = cache(t); await rejeitar(c,['status-tablet-mesa',7]);
    const html = renderizar(Cardapio,c,'MESA');
    assert.match(html,/Não foi possível atualizar a situação da mesa/); assert.match(html,/Tentar novamente/);
    assert.doesNotMatch(html,/Enviar à Cozinha/);
});

const falha = status => ({ response: { status } });
function httpConsultas(responder) {
    const chamadas = [];
    const http = axios.create({ adapter: async config => {
        chamadas.push(config);
        try { return { config, status: 200, headers: {}, data: await responder(config) }; }
        catch (erro) { throw { ...erro, config }; }
    } });
    return { http, chamadas };
}
const resumo = { faturamento: 0, ticketMedio: 0, tempoMedioCozinhaMinutos: 0, taxaBebidas: 0 };
const vazio = config => config.url.endsWith('/resumo') ? resumo : config.url.endsWith('/rankings') ? { topPizzas: [], gargalos: [] } : [];
const consultas = [
    ['arquivo', (http, signal) => consultarArquivo(http,'2026-01-01',signal)],
    ['faturamento', (http, signal) => consultarFaturamento(http,'2026-01-01',signal)],
    ['indicadores', consultarDashboard],
];
for (const [nome, consultar] of consultas) {
    test(`FE013: falhas de ${nome} permanecem erros de QueryClient, sem dados ficticios ou mutacoes`, async () => {
        for (const status of [401,403,500,undefined]) {
            const s = httpConsultas(() => { throw falha(status); }); const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
            await assert.rejects(cache.fetchQuery({ queryKey: [nome], queryFn: ({ signal }) => consultar(s.http, signal) }));
            assert.equal(cache.getQueryState([nome]).status,'error'); assert.equal(cache.getQueryData([nome]),undefined);
            assert.ok(s.chamadas.every(c => c.method === 'get')); cache.clear();
        }
    });
}

test('FE013: lista vazia e zero retornados com sucesso continuam sendo dados reais', async () => {
    const a = httpConsultas(() => []), f = httpConsultas(() => 0), d = httpConsultas(vazio), signal = new AbortController().signal;
    assert.deepEqual(await consultarArquivo(a.http,'2026-01-01',signal),[]);
    assert.equal(await consultarFaturamento(f.http,'2026-01-01',signal),0);
    assert.deepEqual((await consultarDashboard(d.http,signal)).resumo,resumo);
});

test('FE013: payload ausente ou invalido nao vira faturamento zero ou arquivo vazio', async () => {
    const signal = new AbortController().signal;
    await assert.rejects(consultarFaturamento(httpConsultas(() => null).http,'2026-01-01',signal));
    await assert.rejects(consultarArquivo(httpConsultas(() => ({})).http,'2026-01-01',signal));
    await assert.rejects(consultarDashboard(httpConsultas(() => ({})).http,signal));
});

test('FE013: atualizar apos erro mantem valor confirmado e somente muda para zero se servidor o retornar', async () => {
    let falhar = false; const s = httpConsultas(() => { if (falhar) throw falha(500); return 0; });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } }), key = ['faturamento'];
    cache.setQueryData(key,42); falhar = true;
    const opcoes = { queryKey: key, queryFn: ({ signal }) => consultarFaturamento(s.http,'2026-01-01',signal), staleTime: 0 };
    await assert.rejects(cache.fetchQuery(opcoes)); assert.equal(cache.getQueryState(key).status,'error'); assert.equal(cache.getQueryData(key),42);
    falhar = false; assert.equal(await cache.fetchQuery(opcoes),0); assert.equal(cache.getQueryState(key).status,'success');
    assert.ok(s.chamadas.every(c => c.method === 'get')); cache.clear();
});
