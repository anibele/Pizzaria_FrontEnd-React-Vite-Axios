import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CardPedidoCozinha from '../src/componentes/CardPedidoCozinha.tsx';
import { CHAVE_COZINHA, ConclusaoCozinha, buscarPedidosCozinha, concluirItemCozinha, preservarItensProntos } from '../src/services/conclusaoCozinha.ts';

function fila(status = 'PENDENTE') {
    return [{ id: 15, numeroMesa: 1, status: 'ABERTO', formaPagamento: null, dataHora: '2026-11-18T12:00:00', itens: [
        { id: 12, produtoId: 3, produtoNome: 'Pizza de teste', quantidade: 1, precoUnitario: 20,
            status, dataHoraInclusao: '2026-11-18T12:00:00', tempoPreparoMinutos: 20 },
        { id: 13, produtoId: 4, produtoNome: 'Suco de teste', quantidade: 1, precoUnitario: 5,
            status: 'EM_PREPARO', dataHoraInclusao: '2026-11-18T12:00:00', tempoPreparoMinutos: 10 },
    ] }];
}
function pendente() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
const turno = () => new Promise(resolve => setImmediate(resolve));
const falha = (status, mensagem = 'Rejeição de teste') => ({ response: { status, data: { mensagem } } });
function criar(t, opcoes = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryDefaults(CHAVE_COZINHA, { structuralSharing: preservarItensProntos });
    client.setQueryData(CHAVE_COZINHA, fila());
    const envios = [], consultas = [];
    const gestor = new ConclusaoCozinha(client, {
        concluir: id => {
            envios.push(id);
            return opcoes.concluir ? opcoes.concluir(id, envios.length) : Promise.resolve();
        },
        consultar: signal => {
            consultas.push(signal);
            return opcoes.consultar ? opcoes.consultar(signal, consultas.length) : Promise.resolve(fila());
        },
    });
    t.after(() => { gestor.limpar(); client.clear(); });
    const dados = () => client.getQueryData(CHAVE_COZINHA);
    const status = id => dados().flatMap(p => p.itens).find(i => i.id === id)?.status;
    const polling = queryFn => client.fetchQuery({ queryKey: CHAVE_COZINHA, queryFn, staleTime: 0,
        retry: false, structuralSharing: preservarItensProntos });
    const html = () => renderToStaticMarkup(createElement(CardPedidoCozinha, {
        pedido: dados()[0], operacoes: gestor.obterEstado(), onMarcarComoEntregue() {}, onVerificar() {},
    }));
    return { client, gestor, envios, consultas, dados, status, polling, html };
}

test('HTTP: PATCH usa PRONTO, timeout e contrato sem corpo; GET permite cancelamento', async () => {
    const chamadas = [];
    const http = axios.create({ adapter: async config => {
        chamadas.push(config);
        return { status: config.method === 'patch' ? 204 : 200, data: config.method === 'patch' ? '' : fila(), headers: {}, config };
    } });
    const controle = new AbortController();
    await concluirItemCozinha(http, 12);
    await buscarPedidosCozinha(http, controle.signal);
    assert.equal(chamadas[0].method, 'patch');
    assert.equal(chamadas[0].url, '/pedidos/itens/12/status');
    assert.deepEqual(chamadas[0].params, { status: 'PRONTO' });
    assert.equal(chamadas[0].data, null);
    assert.equal(chamadas[0].timeout, 15000);
    assert.equal(chamadas[1].url, '/pedidos/cozinha');
    assert.equal(chamadas[1].timeout, 15000);
    assert.equal(chamadas[1].signal, controle.signal);
});

test('PATCH lento mantém item visível e desabilita somente o botão daquele item', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: () => resposta.promise });
    const envio = s.gestor.concluir(12);
    assert.equal(s.status(12), 'PENDENTE');
    assert.equal(s.gestor.obterEstado()[12].processando, true);
    const html = s.html();
    assert.ok(html.includes('Pizza de teste'));
    assert.ok(html.includes('Suco de teste'));
    assert.ok(html.includes('Confirmando o item'));
    assert.equal((html.match(/disabled=""/g) || []).length, 1);
    resposta.resolve();
    await envio;
    assert.equal(s.status(12), 'PRONTO');
    assert.equal(s.status(13), 'EM_PREPARO');
    assert.equal(s.gestor.obterEstado()[12], undefined);
    assert.equal(s.client.getQueryState(CHAVE_COZINHA).isInvalidated, true);
});

test('toques repetidos enviam um PATCH por item; outros itens continuam utilizáveis', async t => {
    const a = pendente(), b = pendente();
    const s = criar(t, { concluir: id => id === 12 ? a.promise : b.promise });
    const primeiro = s.gestor.concluir(12);
    await s.gestor.concluir(12);
    await s.gestor.verificar(12);
    const segundo = s.gestor.concluir(13);
    assert.deepEqual(s.envios, [12, 13]);
    assert.equal(s.consultas.length, 0);
    a.resolve(); await primeiro;
    assert.equal(s.gestor.obterEstado()[13].processando, true);
    b.resolve(); await segundo;
    assert.equal(s.status(12), 'PRONTO');
    assert.equal(s.status(13), 'PRONTO');
});

for (const status of [400, 401, 403, 404, 409, 500]) {
    test(`HTTP ${status}: item não confirmado permanece na fila e não fica bloqueado em loading`, async t => {
        const s = criar(t, { concluir: async () => { throw falha(status); } });
        await s.gestor.concluir(12);
        assert.equal(s.status(12), 'PENDENTE');
        assert.equal(s.gestor.obterEstado()[12].processando, false);
        assert.equal(s.gestor.obterEstado()[12].verificar, status === 401 || status === 403);
        assert.equal(s.consultas.length, status === 401 || status === 403 ? 0 : 1);
        assert.equal(s.envios.length, 1);
        assert.ok(s.html().includes('Pizza de teste'));
        assert.ok(s.html().includes('role="alert"'));
        assert.ok(!s.html().includes('disabled=""'));
    });
}

for (const mensagem of ['Operacao concorrente em andamento.', 'Pedidos encerrados nao permitem alterar o preparo dos itens.']) {
    test(`409 preserva a explicação do backend: ${mensagem}`, async t => {
        const s = criar(t, { concluir: async () => { throw falha(409, mensagem); } });
        await s.gestor.concluir(12);
        assert.ok(s.gestor.obterEstado()[12].mensagem.includes(mensagem));
        assert.equal(s.status(12), 'PENDENTE');
    });
}

for (const [nome, erro] of [['rede', new Error('Network Error')], ['timeout', { code: 'ECONNABORTED' }], ['500', falha(500)], ['409', falha(409)]]) {
    test(`${nome} após confirmação no servidor: reconcilia PRONTO sem repetir PATCH`, async t => {
        const s = criar(t, { concluir: async () => { throw erro; }, consultar: async () => fila('PRONTO') });
        await s.gestor.concluir(12);
        assert.equal(s.status(12), 'PRONTO');
        assert.equal(s.envios.length, 1);
        assert.equal(s.consultas.length, 1);
        assert.equal(s.gestor.obterEstado()[12], undefined);
    });
}

test('falha com servidor PENDENTE permite somente retry explícito, precedido de nova consulta', async t => {
    const s = criar(t, { concluir: async (_, n) => { if (n === 1) throw new Error('rede'); } });
    await s.gestor.concluir(12);
    assert.equal(s.status(12), 'PENDENTE');
    assert.equal(s.envios.length, 1);
    await s.gestor.concluir(12);
    assert.equal(s.consultas.length, 2);
    assert.equal(s.envios.length, 2);
    assert.equal(s.status(12), 'PRONTO');
});

test('retry não envia outro PATCH se a consulta já informa PRONTO', async t => {
    const s = criar(t, { concluir: async () => { throw falha(500); },
        consultar: async (_, n) => fila(n === 1 ? 'PENDENTE' : 'PRONTO') });
    await s.gestor.concluir(12);
    await s.gestor.concluir(12);
    assert.equal(s.envios.length, 1);
    assert.equal(s.status(12), 'PRONTO');
});

test('mudança concorrente entre consulta e retry é reconciliada após 409', async t => {
    const s = criar(t, { concluir: async (_, n) => { throw falha(n === 1 ? 500 : 409); },
        consultar: async (_, n) => fila(n < 3 ? 'PENDENTE' : 'PRONTO') });
    await s.gestor.concluir(12);
    await s.gestor.concluir(12);
    assert.equal(s.consultas.length, 3);
    assert.equal(s.envios.length, 2);
    assert.equal(s.status(12), 'PRONTO');
});

test('resultado desconhecido e GET indisponível mantêm item visível e oferecem verificação sem PATCH', async t => {
    let online = false;
    const s = criar(t, { concluir: async () => { throw new Error('rede'); }, consultar: async () => {
        if (!online) throw new Error('offline');
        return fila();
    } });
    await s.gestor.concluir(12);
    assert.equal(s.gestor.obterEstado()[12].verificar, true);
    assert.ok(s.html().includes('Verificar estado do item'));
    assert.equal(s.status(12), 'PENDENTE');
    await s.gestor.concluir(12);
    assert.equal(s.envios.length, 1);
    online = true;
    await s.gestor.verificar(12);
    assert.equal(s.gestor.obterEstado()[12].verificar, false);
    assert.equal(s.envios.length, 1);
    assert.equal(s.status(12), 'PENDENTE');
});

test('pedido que saiu da fila ativa após 409 é removido pela consulta, sem falsa confirmação local', async t => {
    const s = criar(t, { concluir: async () => { throw falha(409); }, consultar: async () => [] });
    await s.gestor.concluir(12);
    assert.deepEqual(s.dados(), []);
    assert.equal(s.gestor.obterEstado()[12], undefined);
    assert.equal(s.envios.length, 1);
});

test('dois operadores com caches diferentes concluem o mesmo item sem inconsistência', async t => {
    let servidorPronto = false, efeitos = 0;
    const concluir = async () => { if (!servidorPronto) { servidorPronto = true; efeitos++; } };
    const a = criar(t, { concluir }), b = criar(t, { concluir });
    await a.gestor.concluir(12);
    assert.equal(b.status(12), 'PENDENTE');
    await b.gestor.concluir(12);
    assert.equal(efeitos, 1);
    assert.equal(a.status(12), 'PRONTO');
    assert.equal(b.status(12), 'PRONTO');
});

test('polling durante PATCH pendente mantém item visível; confirmação posterior prevalece', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: () => resposta.promise });
    const envio = s.gestor.concluir(12);
    await s.polling(async () => fila());
    assert.equal(s.status(12), 'PENDENTE');
    assert.equal(s.gestor.obterEstado()[12].processando, true);
    resposta.resolve(); await envio;
    assert.equal(s.status(12), 'PRONTO');
});

test('GET anterior pendente é cancelado antes de publicar PRONTO e resposta tardia não restaura item', async t => {
    const resposta = pendente();
    const s = criar(t);
    let signal;
    const polling = s.polling(contexto => { signal = contexto.signal; return resposta.promise; }).catch(() => {});
    await s.gestor.concluir(12);
    assert.equal(signal.aborted, true);
    resposta.resolve(fila()); await polling; await turno();
    assert.equal(s.status(12), 'PRONTO');
});

test('snapshot antigo posterior não regride PRONTO e preserva novos itens do polling', async t => {
    const s = criar(t);
    await s.gestor.concluir(12);
    const recebidos = fila();
    recebidos[0].itens.push({ ...recebidos[0].itens[1], id: 14 });
    await s.polling(async () => recebidos);
    assert.equal(s.status(12), 'PRONTO');
    assert.equal(s.status(14), 'EM_PREPARO');
    await s.polling(async () => []);
    assert.deepEqual(s.dados(), []);
});

test('polling que confirma PRONTO durante PATCH impede mensagem enganosa de falha', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: () => resposta.promise });
    const envio = s.gestor.concluir(12);
    await s.polling(async () => fila('PRONTO'));
    resposta.reject(new Error('resposta perdida')); await envio;
    assert.equal(s.status(12), 'PRONTO');
    assert.equal(s.consultas.length, 0);
    assert.equal(s.gestor.obterEstado()[12], undefined);
});

test('QueryObserver recebe a confirmação e refaz consulta ativa sem restaurar status antigo', async t => {
    const s = criar(t);
    let leituras = 0;
    const observer = new QueryObserver(s.client, { queryKey: CHAVE_COZINHA,
        queryFn: async () => { leituras++; return fila(); }, structuralSharing: preservarItensProntos,
        staleTime: Infinity });
    const recebidos = [];
    const desligar = observer.subscribe(resultado => recebidos.push(resultado.data));
    t.after(desligar);
    await s.gestor.concluir(12); await turno();
    assert.ok(leituras >= 1);
    assert.equal(s.status(12), 'PRONTO');
    assert.ok(recebidos.some(pedidos => pedidos?.[0].itens[0].status === 'PRONTO'));
});

test('falha de polling preserva os últimos itens e verificação offline não dispara PATCH adicional', async t => {
    const s = criar(t, { concluir: async () => { throw new Error('rede'); },
        consultar: async () => { throw new Error('offline'); } });
    const observer = new QueryObserver(s.client, { queryKey: CHAVE_COZINHA,
        queryFn: async () => { throw new Error('polling offline'); }, retry: false, staleTime: Infinity,
        structuralSharing: preservarItensProntos });
    const desligar = observer.subscribe(() => {});
    t.after(desligar);
    await observer.refetch();
    assert.equal(observer.getCurrentResult().isError, true);
    assert.equal(observer.getCurrentResult().data[0].itens[0].status, 'PENDENTE');
    await s.gestor.concluir(12);
    assert.equal(s.gestor.obterEstado()[12].verificar, true);
    await s.gestor.verificar(12);
    assert.equal(s.envios.length, 1);
    assert.equal(s.consultas.length, 2);
    assert.equal(s.status(12), 'PENDENTE');
    assert.equal(s.gestor.obterEstado()[12].processando, false);
});

test('desmontagem durante PATCH ignora sucesso tardio; retorno usa consulta atualizada', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: () => resposta.promise });
    const envio = s.gestor.concluir(12);
    s.gestor.limpar();
    let eventos = 0;
    const desligar = s.gestor.assinar(() => eventos++);
    resposta.resolve(); await envio;
    assert.equal(eventos, 0);
    assert.equal(s.status(12), 'PENDENTE');
    assert.deepEqual(s.gestor.obterEstado(), {});
    await s.polling(async () => fila('PRONTO'));
    assert.equal(s.status(12), 'PRONTO');
    desligar();
});

test('reconciliação antiga não ressuscita conta retirada por polling durante a consulta', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: async () => { throw new Error('rede'); }, consultar: () => resposta.promise });
    const envio = s.gestor.concluir(12); await turno();
    await s.polling(async () => []);
    resposta.resolve(fila()); await envio;
    assert.deepEqual(s.dados(), []);
    assert.equal(s.envios.length, 1);
});

test('reconciliação sobreposta a outra atualização mantém dados novos e exige nova verificação', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: async () => { throw new Error('rede'); }, consultar: () => resposta.promise });
    const envio = s.gestor.concluir(12); await turno();
    const atualizados = fila();
    atualizados[0].itens.push({ ...atualizados[0].itens[1], id: 14 });
    await s.polling(async () => atualizados);
    resposta.resolve(fila()); await envio;
    assert.equal(s.status(14), 'EM_PREPARO');
    assert.equal(s.status(12), 'PENDENTE');
    assert.equal(s.gestor.obterEstado()[12].verificar, true);
    assert.ok(s.gestor.obterEstado()[12].mensagem.includes('A fila mudou'));
    assert.equal(s.envios.length, 1);
});

test('desmontagem durante reconciliação aborta GET e ignora resposta tardia no cache', async t => {
    const resposta = pendente();
    const s = criar(t, { concluir: async () => { throw new Error('timeout'); }, consultar: () => resposta.promise });
    const envio = s.gestor.concluir(12); await turno();
    assert.equal(s.consultas.length, 1);
    s.gestor.limpar();
    assert.equal(s.consultas[0].aborted, true);
    resposta.resolve(fila('PRONTO')); await envio;
    assert.equal(s.status(12), 'PENDENTE');
    assert.deepEqual(s.gestor.obterEstado(), {});
});

test('resposta de montagem anterior não libera bloqueio nem altera operação nova do mesmo item', async t => {
    const antiga = pendente(), nova = pendente();
    const s = criar(t, { concluir: (_, n) => n === 1 ? antiga.promise : nova.promise });
    const envioAntigo = s.gestor.concluir(12);
    s.gestor.limpar();
    const envioNovo = s.gestor.concluir(12);
    antiga.reject(falha(500)); await envioAntigo;
    assert.equal(s.gestor.obterEstado()[12].processando, true);
    assert.equal(s.consultas.length, 0);
    nova.resolve(); await envioNovo;
    assert.equal(s.status(12), 'PRONTO');
});
