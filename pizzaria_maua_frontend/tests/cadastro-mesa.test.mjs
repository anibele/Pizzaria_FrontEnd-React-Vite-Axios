import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { prepararCadastroMesa, submeterCadastroMesa } from '../src/services/cadastroMesa.ts';

// Dados sintéticos. O gerente define a senha; nenhum valor é gerado pelo número.
const formulario = (patch = {}) => ({ numero: 11, criarUsuario: true, usarPadrao: true,
    username: '', password: 'Frase-sintetica!74', ...patch });

test('cadastro envia credencial explicita no contrato POST /mesas, sem incluir role ou vinculo manipulavel', async () => {
    const dados = Object.freeze(formulario()); let chamadas = 0;
    const http = axios.create({ adapter: async config => {
        chamadas++;
        assert.equal(config.method, 'post'); assert.equal(config.url, '/mesas');
        const payload = JSON.parse(config.data);
        assert.deepEqual(payload, { numero: 11, criarUsuario: true, username: 'mesa11', password: dados.password });
        assert.notEqual(payload.password, payload.username);
        assert.notEqual(payload.password, String(payload.numero));
        assert.notEqual(payload.password, `mesa${payload.numero}`);
        return { status: 201, data: { id: 5, numero: 11, status: 'LIVRE', ativo: true }, headers: {}, config };
    } });
    assert.equal(await submeterCadastroMesa(dados, [], payload => http.post('/mesas', payload)), null);
    assert.equal(chamadas, 1);
});

test('username personalizado e senha sao enviados sem normalizacao silenciosa', async () => {
    const dados = formulario({ usarPadrao: false, username: 'terminal-sala-11', password: '  Frase-sintetica!74  ' });
    let enviado;
    const erro = await submeterCadastroMesa(dados, [], async payload => { enviado = payload; });
    assert.equal(erro, null);
    assert.equal(enviado.username, dados.username); assert.equal(enviado.password, dados.password);
});

test('criar apenas mesa omite credenciais mesmo se valores antigos permanecerem na memoria do formulario', async () => {
    let enviado;
    assert.equal(await submeterCadastroMesa(formulario({ criarUsuario: false, password: '' }), [], async p => { enviado = p; }), null);
    assert.deepEqual(enviado, { numero: 11, criarUsuario: false });
    assert.equal(Object.hasOwn(enviado, 'password'), false);
    assert.equal(Object.hasOwn(enviado, 'username'), false);
});

test('senha ausente, curta, deterministica ou igual ao username nunca chega a requisicao', async () => {
    const invalidos = [
        formulario({ password: '' }), formulario({ password: ' '.repeat(20) }), formulario({ password: 'mesa11' }),
        formulario({ password: '11' }), formulario({ password: '123456789012' }),
        formulario({ password: 'mesa000000000011' }),
        formulario({ usarPadrao: false, username: 'terminal-sala-11', password: 'terminal-sala-11' }),
        formulario({ usarPadrao: false, username: 'Terminal-Sala-11', password: ' TERMINAL-SALA-11 ' }),
    ];
    for (const dados of invalidos) {
        let chamadas = 0;
        const erro = await submeterCadastroMesa(dados, [], async () => { chamadas++; });
        assert.equal(typeof erro, 'string'); assert.ok(erro.length > 0); assert.equal(chamadas, 0);
        assert.ok(!erro.includes('password:')); // Mensagens de validação não incluem o payload.
    }
});

test('username personalizado vazio impede envio; username padrao continua ligado ao numero', async () => {
    let chamadas = 0;
    assert.ok(await submeterCadastroMesa(formulario({ usarPadrao: false, username: '   ' }), [], async () => { chamadas++; }));
    assert.equal(chamadas, 0);
    assert.equal(prepararCadastroMesa(formulario({ numero: 7 }), []).username, 'mesa7');
});

test('limites de tamanho consideram UTF-8 e preservam senhas validas com acentos', async () => {
    for (const password of ['Árvore-fruta!74', 'a'.repeat(12), 'a'.repeat(72), 'á'.repeat(36)]) {
        const payload = prepararCadastroMesa(formulario({ password }), []);
        assert.equal(payload.password, password);
    }
    for (const password of ['a'.repeat(11), 'a'.repeat(73), 'á'.repeat(37), '  curta  ']) {
        let chamadas = 0;
        assert.ok(await submeterCadastroMesa(formulario({ password }), [], async () => { chamadas++; }));
        assert.equal(chamadas, 0);
    }
});

test('preparacao repetida e alteracoes de numero, username e opcao nao geram nem substituem a senha', () => {
    const dados = Object.freeze(formulario());
    for (let i = 0; i < 5; i++) assert.equal(prepararCadastroMesa(dados, []).password, dados.password);
    assert.equal(prepararCadastroMesa({ ...dados, numero: 12 }, []).password, dados.password);
    assert.equal(prepararCadastroMesa({ ...dados, usarPadrao: false, username: 'terminal-12' }, []).password, dados.password);
    prepararCadastroMesa({ ...dados, criarUsuario: false }, []);
    assert.equal(prepararCadastroMesa(dados, []).password, dados.password);
});

test('cadastros independentes preservam as escolhas explicitas de cada gerente', async () => {
    const a = formulario(), b = formulario({ numero: 12, password: 'Outra-frase!85' });
    const enviados = [];
    for (const dados of [a, b]) assert.equal(await submeterCadastroMesa(dados, [], async p => { enviados.push(p); }), null);
    assert.equal(enviados[0].password, a.password); assert.equal(enviados[1].password, b.password);
    assert.notEqual(enviados[0].password, enviados[1].password);
});

test('numero ausente, invalido ou mesa duplicada nao envia credenciais', async () => {
    for (const [numero, existentes] of [['', []], [0, []], [1.5, []], [11, [11]]]) {
        let chamadas = 0;
        assert.ok(await submeterCadastroMesa(formulario({ numero }), existentes, async () => { chamadas++; }));
        assert.equal(chamadas, 0);
    }
});

test('falha HTTP nao e sucesso e nao expoe senha ou dados tecnicos; nova tentativa preserva os campos', async () => {
    const dados = Object.freeze(formulario()); let chamadas = 0;
    const erro = await submeterCadastroMesa(dados, [], async () => {
        chamadas++;
        throw { response: { status: 409, data: { mensagem: `detalhe sintetico ${dados.password}` } }, config: { data: dados } };
    });
    assert.equal(chamadas, 1); assert.equal(typeof erro, 'string');
    assert.ok(!erro.includes(dados.password)); assert.ok(!erro.includes('detalhe sintetico'));
    assert.equal(await submeterCadastroMesa(dados, [], async payload => {
        chamadas++; assert.equal(payload.password, dados.password); assert.equal(payload.username, 'mesa11');
    }), null);
    assert.equal(chamadas, 2);
});

test('falha de rede nao repete automaticamente nem modifica os dados definidos', async () => {
    const dados = Object.freeze(formulario()); let chamadas = 0;
    const erro = await submeterCadastroMesa(dados, [], async () => { chamadas++; throw new Error('rede'); });
    assert.equal(chamadas, 1); assert.equal(typeof erro, 'string');
    assert.equal(dados.password, formulario().password);
});

test('cadastro lento so retorna sucesso depois da confirmacao', async () => {
    let concluir, terminou = false;
    const resultado = submeterCadastroMesa(formulario(), [], () => new Promise(resolve => { concluir = resolve; }))
        .then(erro => { terminou = true; return erro; });
    await Promise.resolve(); assert.equal(terminou, false);
    concluir(); assert.equal(await resultado, null); assert.equal(terminou, true);
});

test('fluxo real de submissao nao le nem grava senha em armazenamento do navegador', async () => {
    const anteriores = ['localStorage', 'sessionStorage'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
    let acessos = 0;
    try {
        for (const [key] of anteriores) Object.defineProperty(globalThis, key, { configurable: true,
            get: () => { acessos++; throw new Error('armazenamento nao deve ser acessado'); } });
        assert.equal(await submeterCadastroMesa(formulario(), [], async () => {}), null);
        assert.equal(acessos, 0);
    } finally {
        for (const [key, descriptor] of anteriores) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
});

test('regressao FE-003: separadores e formatacao invisivel nao liberam padroes previsiveis', async () => {
    for (const password of ['1234 5678 9012', 'mesa 12345678', 'm e s a 12345678', 'mesa 0000 0000 0011',
        '1234\u00a05678\u20079012', 'm\u2009e\u202fs\u3000a 12345678', 'mesa—1234_5678',
        'mesa.1234.5678', 'mesa\u200b12345678', 'm\u200de\u2060s\u00ada12345678', '1234\u034f5678\u200e9012']) {
        let chamadas = 0;
        const erro = await submeterCadastroMesa(formulario({ password }), [], async () => { chamadas++; });
        assert.equal(typeof erro, 'string'); assert.equal(chamadas, 0);
    }
});

test('regressao FE-003: digitos decimais Unicode e caracteres de compatibilidade nao burlam a politica', async () => {
    for (const password of ['１２３４５６７８９０１２', '١٢٣٤٥٦٧٨٩٠١٢', '१२३४५६७८९०१२',
        'ｍｅｓａ１２３４５６７８', '𝕞𝕖𝕤𝕒12345678', 'mesa١٢٣٤٥٦٧٨', '１２３４ ٥٦٧٨ ९०१२']) {
        let chamadas = 0;
        const erro = await submeterCadastroMesa(formulario({ password }), [], async () => { chamadas++; });
        assert.equal(typeof erro, 'string'); assert.equal(chamadas, 0);
    }
});

test('regressao FE-003: senha equivalente ao username em NFC, NFD ou compatibilidade e rejeitada', async () => {
    for (const [username, password] of [
        ['café-terminal', 'café-terminal'.normalize('NFD')],
        ['café-terminal'.normalize('NFD'), 'CAFÉ-TERMINAL'],
        ['terminal-sala-11', 'ｔｅｒｍｉｎａｌ-ｓａｌａ-１１'],
        ['terminal-sala-11', 'terminal sala 11'],
    ]) {
        let chamadas = 0;
        const erro = await submeterCadastroMesa(formulario({ usarPadrao: false, username, password }), [], async () => { chamadas++; });
        assert.equal(typeof erro, 'string'); assert.equal(chamadas, 0);
    }
});

test('regressao FE-003: UTF-16, combinacoes e formatacao invisivel nao inflam o minimo de grafemas', async () => {
    for (const password of ['🍕'.repeat(6), 'e\u0301'.repeat(6), '👍🏽'.repeat(6), '👨‍👩‍👧‍👦'.repeat(2),
        'a'.repeat(11) + '\u200b', '\u200b'.repeat(12), '\u200b' + ' '.repeat(10) + 'ab\u200b']) {
        let chamadas = 0;
        const erro = await submeterCadastroMesa(formulario({ password }), [], async () => { chamadas++; });
        assert.equal(typeof erro, 'string'); assert.equal(chamadas, 0);
    }
});

test('doze grafemas e senhas complexas com espacos e Unicode preservam os valores originais no payload', async () => {
    for (const password of ['á'.repeat(12), 'e\u0301'.repeat(12), '🍕'.repeat(12), '👍🏽' + 'a'.repeat(11),
        '  Árvore azul e açaí!74  ', 'Frase\u200b complexa e única!74', 'Senha ｄｅ ｔｅｓｔｅ!74']) {
        const dados = Object.freeze(formulario({ usarPadrao: false, username: 'Café-Terminal'.normalize('NFD'), password }));
        let enviado;
        assert.equal(await submeterCadastroMesa(dados, [], async payload => { enviado = payload; }), null);
        assert.equal(enviado.password, password); assert.equal(enviado.username, dados.username);
        assert.equal(dados.password, password);
    }
});

test('limite de 72 bytes usa a senha original e nao a representacao NFKC', async () => {
    for (const password of ['Ａ'.repeat(24), 'e\u0301'.repeat(24), '🍕'.repeat(18)]) {
        assert.equal(new TextEncoder().encode(password).length, 72);
        let enviado;
        assert.equal(await submeterCadastroMesa(formulario({ password }), [], async payload => { enviado = payload; }), null);
        assert.equal(enviado.password, password);
    }
    for (const password of ['Ａ'.repeat(25), 'e\u0301'.repeat(25), '🍕'.repeat(19)]) {
        let chamadas = 0;
        assert.ok(await submeterCadastroMesa(formulario({ password }), [], async () => { chamadas++; }));
        assert.equal(chamadas, 0);
    }
});

test('sem Intl.Segmenter o cadastro de credencial e recusado com orientacao sem afetar mesa sem usuario', async () => {
    const anterior = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    try {
        Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
        let chamadas = 0;
        const erro = await submeterCadastroMesa(formulario(), [], async () => { chamadas++; });
        assert.equal(typeof erro, 'string'); assert.match(erro, /navegador/i); assert.equal(chamadas, 0);
        assert.equal(await submeterCadastroMesa(formulario({ criarUsuario: false }), [], async () => { chamadas++; }), null);
        assert.equal(chamadas, 1);
    } finally { Object.defineProperty(Intl, 'Segmenter', anterior); }
});

test('trocar numero ou username nao altera a senha Unicode validada', () => {
    const dados = Object.freeze(formulario({ password: '  Açaí e limão!74  '.normalize('NFD') }));
    for (const alteracao of [{}, { numero: 12 }, { usarPadrao: false, username: 'terminal-12' }]) {
        const payload = prepararCadastroMesa({ ...dados, ...alteracao }, []);
        assert.equal(payload.password, dados.password);
    }
});
