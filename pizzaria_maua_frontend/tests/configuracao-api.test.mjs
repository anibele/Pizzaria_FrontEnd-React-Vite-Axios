import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { criarApi, resolverBaseURL } from '../src/services/configuracaoApi.ts';
import { ControleHttpSessao } from '../src/services/httpSessao.ts';
import { consultarIdentidade } from '../src/services/identidadeAutenticada.ts';

const ambiente = (url, DEV = false) => ({ VITE_API_BASE_URL: url, DEV });
const adiada = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function cliente(url = 'https://api.exemplo.com', protocolo = 'https:', DEV = false) {
    const dados = new Map([['token', 'jwt-sintetico']]), controle = new ControleHttpSessao();
    const api = criarApi(ambiente(url, DEV), protocolo, { getItem: k => dados.get(k) ?? null }, controle);
    const chamadas = [];
    api.defaults.adapter = async config => { chamadas.push(config); return { status: 200, data: {}, headers: {}, config }; };
    return { api, controle, dados, chamadas };
}

test('HTTPS absoluto, porta personalizada e caminho base sao utilizados pela instancia real', async () => {
    const s = cliente('https://api.exemplo.com:9443/backend/');
    await s.api.get('/mesas');
    assert.equal(s.api.defaults.baseURL, 'https://api.exemplo.com:9443/backend');
    assert.equal(s.api.getUri(s.chamadas[0]), 'https://api.exemplo.com:9443/backend/mesas');
    assert.equal(s.chamadas[0].headers.Authorization, 'Bearer jwt-sintetico');
});

test('HTTP explicito no desenvolvimento preserva host e porta sem substituicao pelo navegador', async () => {
    const s = cliente('http://192.168.1.100:8181', 'http:', true);
    await s.api.post('/auth/login', { username: 'sintetico', senha: 'sintetica' });
    assert.equal(s.api.getUri(s.chamadas[0]), 'http://192.168.1.100:8181/auth/login');
    assert.equal(resolverBaseURL(ambiente('http://localhost:8080', true), 'http:'), 'http://localhost:8080');
});

test('caminho relativo mantem origem e monta endpoints sem barras ou prefixos acidentais', async () => {
    const s = cliente('/api///');
    for (const rota of ['/auth/me', '/pedidos/mesa/7/aberto', '/produtos/ativos', '/mesas']) {
        await s.api.get(rota);
        assert.equal(s.api.getUri(s.chamadas.at(-1)), `/api${rota}`);
    }
    assert.equal(s.api.defaults.baseURL, '/api');
});

test('prefixo real do dashboard e preservado para o proxy retirar apenas o prefixo externo', () => {
    const s = cliente('/backend');
    assert.equal(s.api.getUri({ url: '/api/dashboard/resumo' }), '/backend/api/dashboard/resumo');
    const api = cliente('/api').api;
    assert.equal(api.getUri({ url: '/api/dashboard/resumo' }), '/api/api/dashboard/resumo');
});

test('raiz relativa e barras finais funcionam em HTTP e HTTPS', () => {
    assert.equal(cliente('/').api.getUri({ url: '/auth/me' }), '/auth/me');
    assert.equal(resolverBaseURL(ambiente('/api/', true), 'http:'), '/api');
    assert.equal(resolverBaseURL(ambiente('https://api.exemplo.com///'), 'https:'), 'https://api.exemplo.com');
});

test('HTTPS explicito tem prioridade sobre configuracao legada, mesmo se o legado for invalido', () => {
    assert.equal(resolverBaseURL({ DEV: true, VITE_API_BASE_URL: 'https://api.exemplo.com', VITE_BACKEND_IP: 'legado invalido' }, 'https:'), 'https://api.exemplo.com');
});

test('fallback legado e restrito ao desenvolvimento e aceita somente host', () => {
    for (const host of ['localhost', '192.168.1.100', '[::1]']) {
        assert.equal(resolverBaseURL({ DEV: true, VITE_BACKEND_IP: host }, 'http:'), `http://${host}:8080`);
    }
    for (const host of ['http://localhost', 'localhost:8181', 'localhost/api', 'host com espaco', 'host@outro', '999.999.999.999']) {
        assert.throws(() => resolverBaseURL({ DEV: true, VITE_BACKEND_IP: host }, 'http:'), /Configuração/);
    }
});

test('ausencia de configuracao nao escolhe localhost, origem ou endereco hardcoded', () => {
    for (const DEV of [true, false]) assert.throws(() => resolverBaseURL({ DEV }, 'http:'), /ausente/);
    assert.throws(() => resolverBaseURL({ DEV: false, VITE_BACKEND_IP: 'localhost' }, 'http:'), /somente no desenvolvimento/);
});

test('valor vazio ou invalido explicito nunca utiliza fallback legado', () => {
    for (const valor of ['', ' ', '\thttps://api.exemplo.com', 'https://api.exemplo.com ', 'https://api.exemplo.com/a b']) {
        assert.throws(() => resolverBaseURL({ DEV: true, VITE_API_BASE_URL: valor, VITE_BACKEND_IP: 'localhost' }, 'http:'), /inválida/);
    }
});

test('protocolos nao HTTP, URLs relativas ambiguas e estruturas invalidas sao recusados', () => {
    for (const url of ['javascript:alert(1)', 'file:///tmp/api', 'ftp://api.exemplo.com', 'data:text/plain,teste',
        '//api.exemplo.com', 'api', './api', 'https:api.exemplo.com', 'https://', 'https:///api.exemplo.com', 'https:////api.exemplo.com', 'https://api.exemplo.com:99999',
        'https://api.exemplo.com?opcao=1', '/api#fragmento', '/api?opcao=1', '/api\\externo',
        '/api/../outro', '/api/%2e%2e/outro', '/api/%2fexterno', '/api/%0a', '/api/%zz']) {
        assert.throws(() => resolverBaseURL(ambiente(url), 'https:'), /Configuração/);
    }
});

test('credenciais embutidas sao rejeitadas sem serem reproduzidas na mensagem', () => {
    for (const url of ['https://usuario:senha-sintetica@api.exemplo.com', 'https://usuario@api.exemplo.com', 'https://@api.exemplo.com']) {
        assert.throws(() => resolverBaseURL(ambiente(url), 'https:'), erro => {
            assert.ok(!erro.message.includes('senha-sintetica')); assert.ok(!erro.message.includes(url)); return true;
        });
    }
});

test('frontend HTTPS recusa API HTTP explicita ou legada em qualquer modo', () => {
    for (const DEV of [true, false]) assert.throws(() => resolverBaseURL(ambiente('http://localhost:8080', DEV), 'https:'), /incompatível/);
    assert.throws(() => resolverBaseURL({ DEV: true, VITE_BACKEND_IP: 'localhost' }, 'https:'), /incompatível/);
});

test('publicacao HTTP exige URL explicita e continua sem TLS; HTTPS tambem funciona em pagina HTTP', () => {
    assert.equal(resolverBaseURL(ambiente('http://192.168.1.100:8080'), 'http:'), 'http://192.168.1.100:8080');
    assert.equal(resolverBaseURL(ambiente('https://api.exemplo.com'), 'http:'), 'https://api.exemplo.com');
    assert.throws(() => resolverBaseURL(ambiente('/api'), 'file:'), /Configuração/);
});

test('configuracao invalida falha antes de criar cliente, ler token ou enviar requisicao', () => {
    let leituras = 0, criado = false;
    assert.throws(() => {
        criarApi(ambiente('javascript:destino-inesperado'), 'https:', { getItem: () => { leituras++; return 'jwt-sintetico'; } }, new ControleHttpSessao());
        criado = true;
    }, /Configuração/);
    assert.equal(criado, false); assert.equal(leituras, 0);
});

test('/auth/me usa cliente configurado, token explicito, timeout e signal originais', async () => {
    const s = cliente('https://api.exemplo.com/backend'), controle = new AbortController();
    s.api.defaults.adapter = async config => {
        s.chamadas.push(config);
        return { status: 200, headers: {}, config, data: { username: 'clienteA', role: 'MESA', numeroMesa: 7 } };
    };
    assert.deepEqual(await consultarIdentidade(s.api, 'jwt-candidato', controle.signal), { username: 'clienteA', role: 'MESA', numeroMesa: 7 });
    const config = s.chamadas[0];
    assert.equal(s.api.getUri(config), 'https://api.exemplo.com/backend/auth/me');
    assert.equal(config.headers.Authorization, 'Bearer jwt-candidato'); assert.equal(config.timeout, 15000);
    assert.equal(config.signal, controle.signal);
});

test('timeout por chamada e Idempotency-Key permanecem intactos no PUT', async () => {
    const s = cliente('/api');
    await s.api.put('/pedidos/15/itens', [{ produtoId: 3, quantidade: 1 }], { timeout: 12000, headers: { 'Idempotency-Key': 'chave-sintetica' } });
    assert.equal(s.chamadas[0].timeout, 12000);
    assert.equal(s.chamadas[0].headers['Idempotency-Key'], 'chave-sintetica');
    assert.equal(s.chamadas[0].headers.Authorization, 'Bearer jwt-sintetico');
    assert.equal(s.api.getUri(s.chamadas[0]), '/api/pedidos/15/itens');
});

test('401 corrente preserva gerenciamento global; 401 de login e identidade nao provoca redirect global', async () => {
    const s = cliente('/api'); let expiracoes = 0; s.controle.expirar = () => { expiracoes++; };
    s.api.defaults.adapter = async config => { throw { config, response: { status: 401 } }; };
    await assert.rejects(s.api.get('/mesas')); assert.equal(expiracoes, 1);
    await assert.rejects(s.api.post('/auth/login', {})); await assert.rejects(s.api.get('/auth/me'));
    assert.equal(expiracoes, 1);
});

for (const status of [200, 401]) {
    test(`resposta antiga ${status} continua descartada apos troca de sessao com nova baseURL`, async () => {
        const s = cliente('/api'), pendente = adiada(); let expiracoes = 0;
        s.controle.expirar = () => { expiracoes++; };
        s.api.defaults.adapter = async config => {
            await pendente.promise;
            if (status === 401) throw { config, response: { status } };
            return { config, status, headers: {}, data: { numero: 1 } };
        };
        const consulta = s.api.get('/mesas/1').catch(e => e);
        s.controle.avancar(); s.dados.set('token', 'jwt-novo'); pendente.resolve();
        assert.ok(axios.isCancel(await consulta)); assert.equal(expiracoes, 0);
    });
}

test('cancelamento da consulta de identidade permanece funcional com transporte configurado', async () => {
    const s = cliente('/api'), pendente = adiada(), controle = new AbortController();
    s.api.defaults.adapter = async config => { await pendente.promise; return { config, status: 200, headers: {}, data: {} }; };
    const consulta = consultarIdentidade(s.api, 'jwt-candidato', controle.signal).catch(e => e);
    controle.abort(); pendente.resolve(); assert.ok(axios.isCancel(await consulta));
});
