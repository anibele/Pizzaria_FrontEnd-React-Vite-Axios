import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PedidoMesa from '../src/componentes/PedidoMesa.tsx';
import { GestorAbertura, enviarAbertura, consultarAbertura, CHAVE_ABERTURA_PENDENTE, ABERTURA_INCERTA } from '../src/services/aberturaPendente.ts';
import { CHAVE_ADICAO_PENDENTE } from '../src/services/sessaoAdicao.ts';

class Memory {
    values = new Map();
    getItem(k) { return this.values.get(k) ?? null; }
    setItem(k, v) { this.values.set(k, String(v)); }
    removeItem(k) { this.values.delete(k); }
}
const contexto = { username: 'mesa01', role: 'MESA', numeroMesa: 1, sessao: 'sessao-sintetica' };
const itens = () => [{ produtoId: 3, quantidade: 2 }];
const pedido = (id = 15, status = 'ABERTO') => ({ id, numeroMesa: 1, status, itens: [{ produtoId: 3, quantidade: 2 }] });
const erro = (status, mensagem = 'Conflito') => ({ response: { status, data: { mensagem } } });
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(storage = new Memory()) {
    let atual = { ...contexto };
    return { storage, gestor: new GestorAbertura(storage, atual, () => atual), trocar: c => { atual = c; } };
}
const resposta = (config, data, status = 200) => ({ config, data, status, headers: {} });

test('POST real do transporte exige 201, envia snapshot e timeout sem Idempotency-Key', async () => {
    const s = setup(); let limpezas = 0, chamadas = 0;
    s.storage.setItem(CHAVE_ADICAO_PENDENTE, 'pendencia-PUT-nao-alterada');
    const http = axios.create({ adapter: async config => {
        chamadas++;
        assert.equal(config.method, 'post'); assert.equal(config.url, '/pedidos');
        assert.deepEqual(JSON.parse(config.data), { numeroMesa: 1, formaPagamento: 'PENDENTE', itens: itens() });
        assert.equal(config.headers.has('Idempotency-Key'), false); assert.equal(config.timeout, 15000);
        assert.ok(s.storage.getItem(CHAVE_ABERTURA_PENDENTE));
        return resposta(config, pedido(), 201);
    } });
    await s.gestor.enviar(itens(), dados => enviarAbertura(http, dados), () => {
        assert.ok(s.storage.getItem(CHAVE_ABERTURA_PENDENTE)); limpezas++;
    });
    assert.equal(chamadas, 1); assert.equal(limpezas, 1);
    assert.equal(s.gestor.obterEstado().protegida, false);
    assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), null);
    assert.equal(s.storage.getItem(CHAVE_ADICAO_PENDENTE), 'pendencia-PUT-nao-alterada');
});

test('POST lento, polling e toques repetidos nao convertem a selecao em PUT', async () => {
    const s = setup(), espera = defer(), client = new QueryClient();
    const chave = ['pedido-mesa-aberto', 1];
    let posts = 0, puts = 0, limpezas = 0;
    const original = itens();
    const abrir = async dados => { posts++; await espera.promise; assert.deepEqual(dados.itens, itens()); return pedido(); };
    const primeiro = s.gestor.enviar(original, abrir, () => limpezas++);
    original[0].quantidade = 99;
    client.setQueryData(chave, pedido()); // Polling observa o pedido enquanto POST ainda aguarda.
    await s.gestor.enviar(itens(), abrir, () => limpezas++);
    if (!s.gestor.bloqueiaCarrinho() && client.getQueryData(chave)) puts++;
    assert.equal(posts, 1); assert.equal(puts, 0); assert.equal(limpezas, 0);
    assert.equal(s.gestor.obterEstado().processando, true);
    assert.deepEqual(s.gestor.obterEstado().pendente.dados.itens, itens());
    espera.resolve(); await primeiro;
    assert.equal(limpezas, 1); assert.equal(s.gestor.obterEstado().protegida, false);
    client.clear();
});

test('servidor criou pedido e perdeu resposta: polling, consulta e reload nao reenviam itens', async () => {
    const s = setup(), client = new QueryClient(); let posts = 0, puts = 0, estoque = 10;
    const http = axios.create({ adapter: async config => {
        if (config.method === 'post') { posts++; estoque -= 2; throw new Error('resposta perdida depois do commit'); }
        if (config.method === 'put') { puts++; estoque -= 2; }
        return resposta(config, pedido());
    } });
    await s.gestor.enviar(itens(), dados => enviarAbertura(http, dados), () => assert.fail());
    const registro = s.storage.getItem(CHAVE_ABERTURA_PENDENTE);
    client.setQueryData(['pedido-mesa-aberto', 1], pedido());
    for (const gestor of [s.gestor, setup(s.storage).gestor]) {
        await gestor.verificar((numero, signal) => consultarAbertura(http, numero, signal));
        assert.equal(gestor.obterEstado().protegida, true);
        assert.equal(gestor.obterEstado().podeRevisar, false);
        if (!gestor.bloqueiaCarrinho()) await http.put('/pedidos/15/itens', itens());
        await gestor.enviar(itens(), dados => enviarAbertura(http, dados), () => assert.fail());
        assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), registro);
    }
    assert.equal(posts, 1); assert.equal(puts, 0); assert.equal(estoque, 8);
    client.clear();
});

for (const [nome, falha] of [['rede', new Error('rede')], ['timeout', { code: 'ECONNABORTED' }], ['500', erro(500)], ['408', erro(408)]]) {
    test(`${nome}: snapshot e protecao sobrevivem ao reload sem nova abertura`, async () => {
        const s = setup(); let chamadas = 0;
        await s.gestor.enviar(itens(), async () => { chamadas++; throw falha; }, () => assert.fail());
        assert.equal(s.gestor.obterEstado().mensagem, ABERTURA_INCERTA);
        const op = s.gestor.obterEstado().pendente;
        const nova = setup(s.storage);
        assert.deepEqual(nova.gestor.obterEstado().pendente, op);
        nova.gestor.revisarRejeitada();
        await nova.gestor.enviar([{ produtoId: 99, quantidade: 9 }], async () => { chamadas++; }, () => assert.fail());
        assert.equal(chamadas, 1); assert.equal(nova.gestor.bloqueiaCarrinho(), true);
    });
}

for (const [status, mensagem] of [[400, 'Produto inativo ou não encontrado.'], [404, 'Mesa nao encontrada.'],
    [409, 'A mesa já possui um pedido ativo.'], [409, 'A abertura exige uma mesa ativa e LIVRE. Revise a disponibilidade da mesa.'],
    [409, 'Estoque insuficiente para o produto: Pizza']]) {
    test(`rejeicao ${status}: ${mensagem} exige revisao explicita e sobrevive ao reload`, async () => {
        const s = setup();
        await s.gestor.enviar(itens(), async () => { throw erro(status, mensagem); }, () => assert.fail());
        const nova = setup(s.storage), idAnterior = nova.gestor.obterEstado().pendente.idLocal;
        assert.equal(nova.gestor.obterEstado().podeRevisar, true);
        assert.equal(nova.gestor.bloqueiaCarrinho(), true);
        assert.ok(nova.gestor.obterEstado().mensagem.includes(mensagem));
        nova.gestor.revisarRejeitada();
        assert.equal(nova.gestor.bloqueiaCarrinho(), false);
        await nova.gestor.enviar([{ produtoId: 3, quantidade: 1 }], async dados => {
            assert.notEqual(nova.gestor.obterEstado().pendente.idLocal, idAnterior);
            assert.equal(dados.itens[0].quantidade, 1);
        }, () => {});
    });
}

test('409 desconhecido nao autoriza revisar nem transformar a abertura em nova intencao', async () => {
    const s = setup();
    await s.gestor.enviar(itens(), async () => { throw erro(409, 'Operacao concorrente em andamento. Atualize os dados e tente novamente.'); }, () => assert.fail());
    const nova = setup(s.storage);
    nova.gestor.revisarRejeitada();
    assert.equal(nova.gestor.obterEstado().podeRevisar, false);
    assert.ok(s.storage.getItem(CHAVE_ABERTURA_PENDENTE));
});

test('consulta de pedido alheio, aguardando pagamento ou ausencia apos encerramento nao prova origem', async () => {
    for (const observado of [pedido(99), pedido(99, 'AGUARDANDO_PAGAMENTO'), null]) {
        const s = setup();
        await s.gestor.enviar(itens(), async () => { throw new Error('rede'); }, () => assert.fail());
        const registro = s.storage.getItem(CHAVE_ABERTURA_PENDENTE);
        await s.gestor.verificar(async () => observado);
        assert.match(s.gestor.obterEstado().mensagem, /não identifica a abertura original/);
        assert.equal(s.gestor.bloqueiaCarrinho(), true);
        assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), registro);
    }
});

test('GET com 404 retorna ausencia; 500 ou rede nao sao interpretados como ausencia', async () => {
    for (const status of [404, 500, undefined]) {
        const http = axios.create({ adapter: async config => {
            assert.equal(config.url, '/pedidos/mesa/1/aberto'); assert.equal(config.timeout, 15000);
            assert.ok(config.signal); throw status ? erro(status) : new Error('rede');
        } });
        const consultar = () => consultarAbertura(http, 1, new AbortController().signal);
        if (status === 404) assert.equal(await consultar(), null);
        else await assert.rejects(consultar);
    }
});

test('consulta indisponivel preserva registro e permite nova consulta sem repetir POST', async () => {
    const s = setup(); let posts = 0, gets = 0;
    await s.gestor.enviar(itens(), async () => { posts++; throw new Error('timeout'); }, () => assert.fail());
    const registro = s.storage.getItem(CHAVE_ABERTURA_PENDENTE);
    await s.gestor.verificar(async () => { gets++; throw erro(500); });
    assert.match(s.gestor.obterEstado().mensagem, /Não foi possível consultar/);
    assert.equal(s.gestor.obterEstado().processando, false);
    await s.gestor.verificar(async () => { gets++; return pedido(); });
    assert.equal(gets, 2); assert.equal(posts, 1);
    assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), registro);
});

test('consulta antiga nao escreve sobre estado mais recente do cache de polling', async () => {
    const s = setup(), espera = defer(), client = new QueryClient();
    await s.gestor.enviar(itens(), async () => { throw new Error('rede'); }, () => {});
    const consulta = s.gestor.verificar(() => espera.promise);
    const atual = pedido(99, 'AGUARDANDO_PAGAMENTO');
    client.setQueryData(['pedido-mesa-aberto', 1], atual);
    espera.resolve(pedido()); await consulta;
    assert.equal(client.getQueryData(['pedido-mesa-aberto', 1]), atual);
    assert.equal(s.gestor.bloqueiaCarrinho(), true);
    client.clear();
});

test('outro usuario, sessao ou mesa nao recupera nem confirma a abertura anterior', async () => {
    const s = setup(), espera = defer(); let limpezas = 0;
    const envio = s.gestor.enviar(itens(), () => espera.promise, () => limpezas++);
    s.trocar(null); espera.resolve(pedido()); await envio;
    assert.equal(limpezas, 0);
    const registro = s.storage.getItem(CHAVE_ABERTURA_PENDENTE);
    for (const patch of [{ username: 'mesa02' }, { numeroMesa: 2 }, { sessao: 'nova' }, { role: 'GERENTE' }]) {
        const outro = { ...contexto, ...patch };
        const gestor = new GestorAbertura(s.storage, outro, () => outro);
        let envios = 0, consultas = 0;
        await gestor.enviar(itens(), async () => { envios++; }, () => {});
        await gestor.verificar(async () => { consultas++; return null; });
        assert.equal(envios, 0); assert.equal(consultas, 0);
        assert.equal(gestor.bloqueiaCarrinho(), true);
        assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), registro);
    }
});

test('registros invalidos e armazenamento ilegivel mantem protecao conservadora', async () => {
    for (const raw of ['{quebrado', '{}', '{"idLocal":"invalido"}']) {
        const storage = new Memory(); storage.setItem(CHAVE_ABERTURA_PENDENTE, raw);
        const s = setup(storage);
        await s.gestor.enviar(itens(), () => assert.fail(), () => assert.fail());
        assert.equal(s.gestor.bloqueiaCarrinho(), true);
        assert.equal(storage.getItem(CHAVE_ABERTURA_PENDENTE), raw);
    }
    const s = setup({ getItem: () => { throw new Error('storage'); }, setItem: () => assert.fail(), removeItem: () => assert.fail() });
    await s.gestor.enviar(itens(), () => assert.fail(), () => assert.fail());
    assert.equal(s.gestor.obterEstado().protegida, true);
});

test('falha na gravacao impede POST; falha na limpeza nao libera operacao ja enviada', async () => {
    const s = setup(); s.storage.setItem = () => { throw new Error('quota'); };
    await s.gestor.enviar(itens(), () => assert.fail(), () => assert.fail());
    assert.equal(s.gestor.obterEstado().protegida, true);
    const outra = setup(); let posts = 0;
    outra.storage.removeItem = () => { throw new Error('storage'); };
    await outra.gestor.enviar(itens(), async () => { posts++; return pedido(); }, () => {});
    await outra.gestor.enviar(itens(), () => assert.fail(), () => assert.fail());
    assert.equal(posts, 1); assert.ok(outra.storage.getItem(CHAVE_ABERTURA_PENDENTE));
    assert.match(outra.gestor.obterEstado().mensagem, /abertura foi confirmada/);
});

test('falha na limpeza do carrinho depois de 201 nao vira rejeicao nem libera nova abertura', async () => {
    const s = setup(); let posts = 0;
    await s.gestor.enviar(itens(), async () => { posts++; return pedido(); }, () => { throw erro(400, 'Falha local'); });
    assert.equal(s.gestor.obterEstado().podeRevisar, false);
    assert.match(s.gestor.obterEstado().mensagem, /abertura foi confirmada/);
    const nova = setup(s.storage);
    await nova.gestor.enviar(itens(), async () => { posts++; }, () => {});
    assert.equal(posts, 1);
    assert.equal(nova.gestor.bloqueiaCarrinho(), true);
});

test('POST ou GET com pedido invalido nao confirmam abertura de outra mesa', async () => {
    for (const dado of [null, { ...pedido(), id: null }, { ...pedido(), numeroMesa: 2 }, { ...pedido(), status: 'FINALIZADO' }]) {
        const http = axios.create({ adapter: async config => resposta(config, dado, config.method === 'post' ? 201 : 200) });
        await assert.rejects(() => enviarAbertura(http, { numeroMesa: 1, formaPagamento: 'PENDENTE', itens: itens() }));
        await assert.rejects(() => consultarAbertura(http, 1, new AbortController().signal));
    }
});

test('revisao antiga nao apaga outra abertura iniciada por instancia diferente', async () => {
    const s = setup();
    await s.gestor.enviar(itens(), async () => { throw erro(400, 'Produto inativo ou não encontrado.'); }, () => {});
    const a = setup(s.storage), b = setup(s.storage);
    a.gestor.revisarRejeitada(); const espera = defer();
    const novo = a.gestor.enviar(itens(), () => espera.promise, () => {});
    const registro = s.storage.getItem(CHAVE_ABERTURA_PENDENTE);
    b.gestor.revisarRejeitada();
    assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), registro);
    assert.equal(b.gestor.obterEstado().podeRevisar, false);
    espera.resolve(pedido()); await novo;
});

test('desmontagem durante POST preserva registro e ignora confirmacao tardia', async () => {
    const s = setup(), espera = defer();
    const envio = s.gestor.enviar(itens(), () => espera.promise, () => assert.fail());
    const registro = s.storage.getItem(CHAVE_ABERTURA_PENDENTE);
    s.gestor.desmontar(); const estado = s.gestor.obterEstado();
    espera.resolve(pedido()); await envio;
    assert.equal(s.gestor.obterEstado(), estado);
    assert.equal(s.storage.getItem(CHAVE_ABERTURA_PENDENTE), registro);
    assert.equal(setup(s.storage).gestor.bloqueiaCarrinho(), true);
});

test('desmontagem cancela consulta e ignora resposta tardia', async () => {
    const s = setup(), espera = defer(); let sinal;
    await s.gestor.enviar(itens(), async () => { throw new Error('rede'); }, () => {});
    const consulta = s.gestor.verificar((_, signal) => { sinal = signal; return espera.promise; });
    s.gestor.desmontar(); const estado = s.gestor.obterEstado();
    assert.equal(sinal.aborted, true);
    espera.resolve(pedido()); await consulta;
    assert.equal(s.gestor.obterEstado(), estado);
});

test('confirmacao HTTP inesperada e 401/403 nao limpam selecao nem reenviam', async () => {
    for (const falha of [erro(401), erro(403), new Error('Confirmação inesperada')]) {
        const s = setup();
        await s.gestor.enviar(itens(), async () => { throw falha; }, () => assert.fail());
        assert.equal(s.gestor.obterEstado().podeRevisar, false);
        await s.gestor.enviar(itens(), () => assert.fail(), () => assert.fail());
    }
    const http = axios.create({ adapter: async config => resposta(config, pedido(), 200) });
    await assert.rejects(() => enviarAbertura(http, { numeroMesa: 1, formaPagamento: 'PENDENTE', itens: itens() }));
});

test('UI da abertura incerta oferece consulta e preserva selecao sem retry ou soma duplicada', () => {
    const html = renderToStaticMarkup(createElement(PedidoMesa, {
        carrinho: [{ produto: { id: 3, nome: 'Pizza', precoBase: 10 }, quantidade: 2 }],
        criando: false, adicionando: false, adicaoPendente: true, mensagemAdicao: ABERTURA_INCERTA,
        reenvioPermitido: false, podeRevisarAdicao: false, onVerificarAbertura() {},
        pedidoAtivo: pedido(), itensConsumidos: [{ id: 1, produtoNome: 'Pizza', quantidade: 2, precoUnitario: 10, status: 'PENDENTE' }],
        possuiItensConsumidos: true, todosItensProntos: false,
    }));
    assert.ok(html.includes('Verificar pedido')); assert.ok(html.includes(ABERTURA_INCERTA));
    assert.ok(!html.includes('Tentar novamente')); assert.ok(!html.includes('Enviar à Cozinha'));
    assert.ok(!html.includes('Total acumulado da conta:')); assert.ok(html.includes('disabled=""'));
});
