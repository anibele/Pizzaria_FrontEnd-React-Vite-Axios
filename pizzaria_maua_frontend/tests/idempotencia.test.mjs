import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PedidoMesa from '../src/componentes/PedidoMesa.tsx';
import { GestorAdicao, enviarAdicao, MENSAGEM_INCERTA } from '../src/services/adicaoPendente.ts';
import { novoUUID, CHAVE_ADICAO_PENDENTE, CHAVE_SESSAO_ADICAO, garantirSessaoAdicao, contextoAtualAdicao, encerrarSessaoAdicao } from '../src/services/sessaoAdicao.ts';
class Memory {
    values = new Map();
    getItem(k) { return this.values.get(k) ?? null; }
    setItem(k, v) { this.values.set(k, String(v)); }
    removeItem(k) { this.values.delete(k); }
}
const contexto = { username: 'mesa01', role: 'MESA', numeroMesa: 1, sessao: 'sessao-sintetica' };
const itens = () => [{ produtoId: 3, quantidade: 2 }, { produtoId: 3, quantidade: 1 }];
const erro = (status, mensagem = 'Conflito') => ({ response: { status, data: { mensagem } } });
function setup(storage = new Memory()) {
    let atual = { ...contexto }, uuids = 0;
    const gestor = new GestorAdicao(storage, atual, () => atual, () => { uuids++; return novoUUID(); });
    return { gestor, storage, get uuids() { return uuids; }, trocar: value => { atual = value; } };
}

test('primeiro PUT envia UUID, payload, URL e timeout sem mudar outros requests', async () => {
    const seen = []; const http = axios.create({ adapter: async c => { seen.push(c); return { data: { id: 15 }, status: 200, headers: {}, config: c }; } });
    const s = setup(); await s.gestor.enviar(15, itens(), op => enviarAdicao(http, op), () => {});
    assert.equal(seen[0].method, 'put'); assert.equal(seen[0].url, '/pedidos/15/itens'); assert.match(seen[0].headers.get('Idempotency-Key'), /^[0-9a-f-]{36}$/);
    assert.deepEqual(JSON.parse(seen[0].data), itens()); assert.equal(seen[0].timeout, 15000);
    await http.post('/pedidos', { numeroMesa: 1, itens: itens() }); await http.get('/pedidos/mesa/1/aberto');
    assert.equal(seen[1].headers.has('Idempotency-Key'), false); assert.equal(seen[2].headers.has('Idempotency-Key'), false);
});
for (const [nome, falha] of [['timeout', { code: 'ECONNABORTED' }], ['rede', new Error('Network Error')], ['500', erro(500)], ['408', erro(408)]]) {
    test(`${nome} conserva UUID e snapshot mesmo se o carrinho mudar`, async () => {
        const s = setup(); const original = itens(); let primeira;
        await s.gestor.enviar(15, original, async op => { primeira = op; throw falha; }, () => assert.fail());
        assert.equal(s.gestor.obterEstado().mensagem, MENSAGEM_INCERTA); assert.equal(s.gestor.obterEstado().podeRevisar, false);
        original.reverse(); original[0].quantidade = 900;
        let confirmadas = 0;
        await s.gestor.enviar(99, [{ produtoId: 99, quantidade: 9 }], async op => {
            assert.equal(op.chave, primeira.chave); assert.equal(op.pedidoId, 15); assert.deepEqual(op.itens, itens());
        }, () => confirmadas++);
        assert.equal(confirmadas, 1); assert.equal(s.uuids, 1); assert.equal(s.storage.getItem(CHAVE_ADICAO_PENDENTE), null);
    });
}
test('duplo toque gera somente uma chamada e um UUID', async () => {
    const s = setup(); let release; const waiting = new Promise(resolve => { release = resolve; }); let chamadas = 0, confirmadas = 0;
    const executar = async () => { chamadas++; await waiting; };
    const a = s.gestor.enviar(15, itens(), executar, () => confirmadas++);
    const b = s.gestor.enviar(15, itens(), executar, () => confirmadas++);
    assert.equal(s.gestor.obterEstado().enviando, true); assert.equal(chamadas, 1); assert.equal(s.uuids, 1);
    release(); await Promise.all([a, b]); assert.equal(confirmadas, 1); assert.equal(s.gestor.obterEstado().enviando, false);
});
test('nova intencao depois do sucesso gera outra chave', async () => {
    const s = setup(); const keys = []; for (let i = 0; i < 2; i++) await s.gestor.enviar(15, itens(), async op => { keys.push(op.chave); }, () => {});
    assert.notEqual(keys[0], keys[1]); assert.equal(s.uuids, 2);
});
test('snapshot persistido antes da primeira chamada e nao guarda credenciais', async () => {
    const s = setup(); await s.gestor.enviar(15, itens(), async op => {
        const saved = JSON.parse(s.storage.getItem(CHAVE_ADICAO_PENDENTE)); assert.equal(saved.chave, op.chave);
        assert.deepEqual(Object.keys(saved).sort(), ['chave', 'contexto', 'itens', 'pedidoId']);
        assert.deepEqual(Object.keys(saved.contexto).sort(), ['numeroMesa', 'role', 'sessao', 'username']);
        assert.ok(Object.isFrozen(op)); assert.ok(Object.isFrozen(op.itens[0]));
    }, () => {});
});
test('backend confirmou mas resposta se perdeu: reload e retry nao duplicam efeito ou total', async () => {
    const s = setup(); const concluidas = new Map(); let unidades = 0, total = 0, primeira = true;
    const servidor = async op => {
        if (!concluidas.has(op.chave)) { unidades += 3; total += 30.75; concluidas.set(op.chave, { faturamento: total }); }
        if (primeira) { primeira = false; throw new Error('resposta perdida depois do commit'); }
        return concluidas.get(op.chave);
    };
    await s.gestor.enviar(15, itens(), servidor, () => assert.fail());
    let calls = 0; const recuperado = new GestorAdicao(s.storage, contexto, () => contexto);
    assert.equal(calls, 0); assert.ok(recuperado.obterEstado().pendente); // Recuperacao nao envia.
    await recuperado.enviar(99, [], async op => { calls++; return servidor(op); }, () => {});
    assert.equal(calls, 1); assert.equal(unidades, 3); assert.equal(total, 30.75); assert.equal(recuperado.obterEstado().pendente, null);
});
test('409 de chave divergente nao gera nova intencao nem limpa selecao', async () => {
    const s = setup(); let calls = 0;
    await s.gestor.enviar(15, itens(), async () => { calls++; throw erro(409, 'Idempotency-Key ja utilizada com conteudo diferente.'); }, () => assert.fail());
    assert.equal(calls, 1); assert.equal(s.uuids, 1); assert.equal(s.gestor.obterEstado().podeRevisar, false); assert.ok(s.gestor.obterEstado().pendente);
});
test('rejeicao definitiva nova permite revisar somente por acao explicita', async () => {
    const s = setup(); await s.gestor.enviar(15, itens(), async () => { throw erro(409, 'Estoque insuficiente para o produto'); }, () => assert.fail());
    assert.ok(s.gestor.obterEstado().pendente); assert.equal(s.gestor.obterEstado().podeRevisar, true);
    s.gestor.revisarRejeitada(); assert.equal(s.gestor.obterEstado().pendente, null);
});
test('409 depois de resultado incerto nao libera nova intencao', async () => {
    const s = setup(); await s.gestor.enviar(15, itens(), async () => { throw new Error('rede'); }, () => {});
    await s.gestor.enviar(15, itens(), async () => { throw erro(409, 'Estoque insuficiente'); }, () => {});
    assert.equal(s.gestor.obterEstado().podeRevisar, false); s.gestor.revisarRejeitada(); assert.ok(s.gestor.obterEstado().pendente);
});
for (const status of [401, 403]) test(`${status} respeita autenticacao sem retry automatico`, async () => {
    const s = setup(); let calls = 0; await s.gestor.enviar(15, itens(), async () => { calls++; throw erro(status); }, () => assert.fail());
    await s.gestor.enviar(15, itens(), async () => { calls++; }, () => assert.fail());
    assert.equal(calls, 1); assert.equal(s.gestor.obterEstado().bloqueada, true);
});
for (const patch of [{ username: 'mesa02' }, { numeroMesa: 2 }, { sessao: 'nova-sessao' }, { role: 'GERENTE' }]) test(`outro contexto nao recupera/reenvia: ${Object.keys(patch)[0]}`, async () => {
    const s = setup(); await s.gestor.enviar(15, itens(), async () => { throw new Error('rede'); }, () => {});
    const outro = { ...contexto, ...patch }; const gestor = new GestorAdicao(s.storage, outro, () => outro);
    await gestor.enviar(15, itens(), () => assert.fail(), () => assert.fail()); assert.equal(gestor.obterEstado().bloqueada, true);
});
test('logout ou troca durante request nao confirma carrinho de outro usuario', async () => {
    const s = setup(); let release; const wait = new Promise(resolve => { release = resolve; });
    const p = s.gestor.enviar(15, itens(), async () => { await wait; }, () => assert.fail()); s.trocar(null); release(); await p;
    assert.equal(s.gestor.obterEstado().bloqueada, true);
});
test('resposta atrasada de tela desmontada nao limpa uma nova operacao', async () => {
    const s = setup(); let release; const wait = new Promise(resolve => { release = resolve; });
    const antiga = s.gestor.enviar(15, itens(), async () => { await wait; }, () => assert.fail());
    const nova = new GestorAdicao(s.storage, contexto, () => contexto);
    await nova.enviar(15, [], async () => {}, () => {}); // Confirma o replay antes da resposta antiga.
    const novoEnvio = nova.enviar(15, itens(), async () => { throw new Error('rede'); }, () => assert.fail()); await novoEnvio;
    const key = nova.obterEstado().pendente.chave; release(); await antiga;
    assert.equal(JSON.parse(s.storage.getItem(CHAVE_ADICAO_PENDENTE)).chave, key);
});
test('armazenamento indisponivel impede envio sem chave duravel', async () => {
    const s = setup({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
    await s.gestor.enviar(15, itens(), () => assert.fail(), () => assert.fail()); assert.ok(s.gestor.obterEstado().pendente);
});
test('registro corrompido bloqueia novos envios', async () => {
    const storage = new Memory(); storage.setItem(CHAVE_ADICAO_PENDENTE, '{quebrado'); const s = setup(storage);
    await s.gestor.enviar(15, itens(), () => assert.fail(), () => assert.fail()); assert.equal(s.gestor.obterEstado().bloqueada, true);
});
test('fallback UUID usa getRandomValues com versao/variante corretas', () => {
    const k = novoUUID({ getRandomValues: v => crypto.getRandomValues(v) }); assert.match(k, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('sessao sobrevive ao reload, nova autenticacao muda nonce e logout limpa pendencia', async () => {
    const oldLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), oldSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    const local = new Memory(), session = new Memory();
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true }); Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
    try {
        local.setItem('token', 'credencial-apenas-no-storage-ja-existente'); local.setItem('user', JSON.stringify({ username: 'mesa01', role: 'MESA' }));
        garantirSessaoAdicao({ username: 'mesa01', role: 'MESA' }); const first = contextoAtualAdicao(1);
        garantirSessaoAdicao({ username: 'mesa01', role: 'MESA' }); assert.deepEqual(contextoAtualAdicao(1), first);
        garantirSessaoAdicao({ username: 'mesa01', role: 'MESA' }, true); assert.notEqual(contextoAtualAdicao(1).sessao, first.sessao);
        const atual = contextoAtualAdicao(1);
        const pendente = new GestorAdicao(session, atual, () => contextoAtualAdicao(1));
        // Um novo login, inclusive em outra aba, muda o marcador compartilhado.
        garantirSessaoAdicao({ username: 'mesa01', role: 'MESA' }, true);
        assert.notEqual(contextoAtualAdicao(1).sessao, atual.sessao);
        assert.equal(local.getItem(CHAVE_SESSAO_ADICAO) !== null, true);
        await pendente.enviar(15, itens(), () => assert.fail(), () => assert.fail());
        assert.equal(pendente.obterEstado().bloqueada, true);
        session.setItem(CHAVE_ADICAO_PENDENTE, '{}'); encerrarSessaoAdicao(); assert.equal(contextoAtualAdicao(1), null);
        assert.equal(local.getItem(CHAVE_SESSAO_ADICAO), null); assert.equal(session.getItem(CHAVE_ADICAO_PENDENTE), null);
    } finally {
        if (oldLocal) Object.defineProperty(globalThis, 'localStorage', oldLocal); else delete globalThis.localStorage;
        if (oldSession) Object.defineProperty(globalThis, 'sessionStorage', oldSession); else delete globalThis.sessionStorage;
    }
});
const produto = { id: 3, nome: 'Pizza', precoBase: 10.25 };
const props = { carrinho: [{ produto, quantidade: 2 }], criando: false, adicionando: false, pedidoAtivo: { id: 15 },
    itensConsumidos: [{ id: 1, produtoNome: 'Pizza', quantidade: 2, precoUnitario: 10.25, status: 'PENDENTE' }],
    possuiItensConsumidos: true, todosItensProntos: false, onAdicionarAoCarrinho() {}, onRemoverOuDiminuir() {}, onEnviarParaCozinha() {}, onAbrirPagamento() {}, onRevisarAdicao() {},
    adicaoPendente: true, mensagemAdicao: MENSAGEM_INCERTA, reenvioPermitido: true, podeRevisarAdicao: false };
test('UI incerta oferece retry e nao duplica total da selecao com comanda', () => {
    const html = renderToStaticMarkup(createElement(PedidoMesa, props)); assert.ok(html.includes('Tentar novamente')); assert.ok(html.includes(MENSAGEM_INCERTA));
    assert.ok(!html.includes('Total acumulado da conta:')); assert.ok(!html.includes('Enviar à Cozinha')); assert.ok(html.includes('disabled=""'));
});
test('UI durante envio bloqueia retry e mantem loading', () => {
    const html = renderToStaticMarkup(createElement(PedidoMesa, { ...props, adicionando: true })); assert.match(html, /disabled=""[^>]*>Enviando/);
});
test('UI apos confirmacao usa historico recebido sem acrescimo local', () => {
    const html = renderToStaticMarkup(createElement(PedidoMesa, { ...props, carrinho: [], adicaoPendente: false, mensagemAdicao: null, reenvioPermitido: false }));
    assert.ok(!html.includes('Tentar novamente')); assert.ok(!html.includes('Total acumulado da conta:')); assert.ok(html.includes('Pizza'));
});

test('falha ao criar novo marcador de login nao conserva sessao anterior', () => {
    const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); const local = new Memory();
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
    try {
        local.setItem('token', 'token-sintetico'); local.setItem('user', JSON.stringify({ username: 'mesa01', role: 'MESA' }));
        garantirSessaoAdicao({ username: 'mesa01', role: 'MESA' }); assert.ok(contextoAtualAdicao(1));
        local.setItem = () => { throw new Error('quota'); }; garantirSessaoAdicao({ username: 'mesa01', role: 'MESA' }, true);
        assert.equal(contextoAtualAdicao(1), null);
    } finally { if (old) Object.defineProperty(globalThis, 'localStorage', old); else delete globalThis.localStorage; }
});
