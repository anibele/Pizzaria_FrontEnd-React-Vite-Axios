import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SolicitacaoPagamento } from '../src/services/solicitacaoPagamento.ts';
import ModalPagamento from '../src/componentes/ModalPagamento.tsx';

const aberto = { id: 15, status: 'ABERTO', formaPagamento: null };
const aguardando = { ...aberto, status: 'AGUARDANDO_PAGAMENTO', formaPagamento: 'PIX' };
const erroHttp = status => ({ response: { status, data: { mensagem: 'Mensagem técnica que não deve ser exibida' } } });
const turno = () => new Promise(resolve => setImmediate(resolve));
function pendente() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
function criar(opcoes = {}) {
    const consultas = [], envios = [], atualizacoes = [];
    const gestor = new SolicitacaoPagamento({
        consultar: signal => {
            consultas.push(signal);
            return opcoes.consultar ? opcoes.consultar(signal, consultas.length) : Promise.resolve(aberto);
        },
        solicitar: (id, forma, signal) => {
            envios.push({ id, forma, signal });
            return opcoes.solicitar ? opcoes.solicitar(id, forma, signal, envios.length) : Promise.resolve(aguardando);
        },
        atualizar: pedido => atualizacoes.push(pedido),
    });
    return { gestor, consultas, envios, atualizacoes };
}
function render(estado, isOpen = true) {
    return renderToStaticMarkup(createElement(ModalPagamento, {
        isOpen, estado, onClose() {}, onSolicitarPagamento: async () => {}, onVerificarPedido: async () => {},
    }));
}

test('sucesso só aparece depois da confirmação HTTP, mantendo o pedido retornado', async () => {
    const resposta = pendente();
    const s = criar({ solicitar: () => resposta.promise });
    const envio = s.gestor.solicitar(15, 'PIX');
    await turno();
    assert.equal(s.gestor.obterEstado().fase, 'processando');
    let html = render(s.gestor.obterEstado());
    assert.ok(!html.includes('Sua solicitação foi enviada'));
    assert.ok(html.includes('role="status"'));
    assert.equal((html.match(/disabled=""/g) || []).length, 4);
    resposta.resolve(aguardando);
    await envio;
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
    assert.deepEqual(s.envios.map(({ id, forma }) => ({ id, forma })), [{ id: 15, forma: 'PIX' }]);
    assert.deepEqual(s.atualizacoes.at(-1), aguardando);
    html = render(s.gestor.obterEstado());
    assert.ok(html.includes('Sua solicitação foi enviada'));
});

test('toques repetidos durante consulta lenta e PATCH lento não criam envios concorrentes', async () => {
    const consulta = pendente(), resposta = pendente();
    const s = criar({ consultar: () => consulta.promise, solicitar: () => resposta.promise });
    const envio = s.gestor.solicitar(15, 'PIX');
    await s.gestor.solicitar(15, 'CARTAO');
    await s.gestor.verificar();
    assert.equal(s.consultas.length, 1);
    assert.equal(s.envios.length, 0);
    consulta.resolve(aberto);
    await turno();
    await s.gestor.solicitar(15, 'DINHEIRO');
    assert.equal(s.envios.length, 1);
    resposta.resolve(aguardando);
    await envio;
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.envios.length, 1);
});

for (const status of [400, 403, 404, 409, 500]) {
    test(`HTTP ${status} não apresenta sucesso falso e libera fechamento após a falha`, async () => {
        const s = criar({ solicitar: async () => { throw erroHttp(status); } });
        await s.gestor.solicitar(15, 'PIX');
        const estado = s.gestor.obterEstado();
        assert.notEqual(estado.fase, 'sucesso');
        assert.notEqual(estado.fase, 'processando');
        assert.equal(s.envios.length, 1);
        assert.equal(s.consultas.length, status === 409 || status === 500 ? 2 : 1);
        const html = render(estado);
        assert.ok(!html.includes('Sua solicitação foi enviada'));
        assert.ok(html.includes('role="alert"'));
        assert.match(html, /<button[^>]*class="btn-modal-fechar"/);
        assert.ok(!html.includes('Mensagem técnica'));
        assert.ok(!html.includes('disabled=""'));
    });
}

for (const [nome, falha] of [['rede', new Error('Network Error')], ['timeout', { code: 'ECONNABORTED' }], ['500', erroHttp(500)], ['409', erroHttp(409)]]) {
    test(`${nome}: resposta perdida é reconciliada por GET sem repetir PATCH`, async () => {
        const s = criar({
            consultar: async (_, tentativa) => tentativa === 1 ? aberto : aguardando,
            solicitar: async () => { throw falha; },
        });
        await s.gestor.solicitar(15, 'PIX');
        assert.equal(s.consultas.length, 2);
        assert.equal(s.envios.length, 1);
        assert.equal(s.gestor.obterEstado().fase, 'sucesso');
        assert.deepEqual(s.atualizacoes.at(-1), aguardando);
    });
}

test('500 com pedido ainda ABERTO exige nova ação e nova consulta antes do retry', async () => {
    const s = criar({ solicitar: async (_, __, ___, tentativa) => {
        if (tentativa === 1) throw erroHttp(500);
        return aguardando;
    } });
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.gestor.obterEstado().fase, 'erro');
    assert.equal(s.envios.length, 1);
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.consultas.length, 3);
    assert.equal(s.envios.length, 2);
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
});

test('rejeição 400 permite corrigir a forma e tentar novamente após verificar o pedido', async () => {
    const s = criar({ solicitar: async (_, forma, __, tentativa) => {
        if (tentativa === 1) throw erroHttp(400);
        return { ...aguardando, formaPagamento: forma };
    } });
    await s.gestor.solicitar(15, 'PIX');
    await s.gestor.solicitar(15, 'CARTAO');
    assert.equal(s.consultas.length, 2);
    assert.equal(s.envios[1].forma, 'CARTAO');
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
});

test('resultado incerto e consulta indisponível oferecem apenas verificação, sem reenvio', async () => {
    let estadoServidor = 'offline';
    const s = criar({
        consultar: async (_, tentativa) => {
            if (tentativa === 1) return aberto;
            if (estadoServidor === 'offline') throw new Error('rede');
            return estadoServidor === 'pago' ? aguardando : aberto;
        },
        solicitar: async () => { throw new Error('resposta perdida'); },
    });
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.gestor.obterEstado().fase, 'verificar');
    assert.ok(render(s.gestor.obterEstado()).includes('Verificar pedido'));
    assert.ok(!render(s.gestor.obterEstado()).includes('> Pix'));
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.envios.length, 1);
    estadoServidor = 'pago';
    await s.gestor.verificar();
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
    assert.equal(s.envios.length, 1);
});

test('verificação manual de resultado incerto permite recuperação quando continua ABERTO', async () => {
    let recuperar = false;
    const s = criar({
        consultar: async (_, n) => {
            if (n === 2 && !recuperar) throw new Error('offline');
            return aberto;
        },
        solicitar: async (_, __, ___, n) => {
            if (n === 1) throw new Error('timeout');
            return aguardando;
        },
    });
    await s.gestor.solicitar(15, 'PIX');
    recuperar = true;
    await s.gestor.verificar();
    assert.equal(s.gestor.obterEstado().fase, 'erro');
    assert.equal(s.envios.length, 1);
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
    assert.equal(s.envios.length, 2);
});

test('pedido já AGUARDANDO_PAGAMENTO após reabrir não recebe outro PATCH', async () => {
    const s = criar({ consultar: async () => aguardando });
    await s.gestor.solicitar(15, 'CARTAO');
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
    assert.equal(s.envios.length, 0);
});

for (const pedido of [null, { ...aberto, status: 'FINALIZADO' }, { ...aberto, id: 99 }]) {
    test(`conta ausente, encerrada ou trocada impede solicitar: ${JSON.stringify(pedido)}`, async () => {
        const s = criar({ consultar: async () => pedido });
        await s.gestor.solicitar(15, 'PIX');
        assert.equal(s.gestor.obterEstado().fase, 'encerrado');
        assert.equal(s.envios.length, 0);
        assert.ok(!render(s.gestor.obterEstado()).includes('Sua solicitação foi enviada'));
    });
}

test('falha da consulta inicial não dispara PATCH; verificação posterior também não envia', async () => {
    const s = criar({ consultar: async (_, n) => {
        if (n === 1) throw erroHttp(500);
        return aberto;
    } });
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.gestor.obterEstado().fase, 'verificar');
    await s.gestor.verificar();
    assert.equal(s.gestor.obterEstado().fase, 'erro');
    assert.equal(s.envios.length, 0);
});

test('2xx com confirmação inesperada exige consulta e não produz sucesso falso', async () => {
    const s = criar({ solicitar: async () => aberto });
    await s.gestor.solicitar(15, 'PIX');
    assert.equal(s.gestor.obterEstado().fase, 'erro');
    assert.equal(s.consultas.length, 2);
    assert.equal(s.envios.length, 1);
});

test('limpeza durante PATCH aborta e ignora resposta antiga após reiniciar', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const resposta = pendente();
    const s = criar({ solicitar: () => resposta.promise });
    const envio = s.gestor.solicitar(15, 'PIX');
    await turno();
    const eventos = [];
    const remover = s.gestor.assinar(() => eventos.push(s.gestor.obterEstado().fase));
    s.gestor.reiniciar();
    assert.equal(s.envios[0].signal.aborted, true);
    assert.equal(s.gestor.obterEstado().fase, 'selecao');
    remover();
    resposta.resolve(aguardando);
    await envio;
    t.mock.timers.tick(1000);
    assert.equal(s.gestor.obterEstado().fase, 'selecao');
    assert.deepEqual(eventos, ['selecao']);
    assert.deepEqual(s.atualizacoes, [aberto]);
    assert.equal(render(s.gestor.obterEstado(), false), '');
});

test('limpeza durante GET impede PATCH tardio e permite novo ciclo após remontagem', async () => {
    const consulta = pendente();
    const s = criar({ consultar: (_, n) => n === 1 ? consulta.promise : Promise.resolve(aberto) });
    const antigo = s.gestor.solicitar(15, 'PIX');
    s.gestor.reiniciar();
    assert.equal(s.consultas[0].aborted, true);
    await s.gestor.solicitar(15, 'PIX');
    consulta.resolve(aberto);
    await antigo;
    assert.equal(s.envios.length, 1);
    assert.equal(s.gestor.obterEstado().fase, 'sucesso');
});
