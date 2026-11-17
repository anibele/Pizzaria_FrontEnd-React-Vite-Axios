// Smoke manual: somente memoria, sem banco ou encaminhamento a outro servidor.
import http from 'node:http';
import { spawn } from 'node:child_process';
const produto = { id: 3, nome: 'Pizza de teste', categoria: 'PIZZAS', precoBase: 10.25, ativo: true, qtdEstoque: 20,
    imagemUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="20" y="60" font-size="50">🍕</text></svg>',
    descricao: { breveDescricao: 'Dados sinteticos', tempoMedioPreparo: '20 min', pratoVegano: false, ingredientes: ['Queijo'] } };
const pedido = { id: 15, numeroMesa: 1, dataHora: '2026-11-17T12:00:00', status: 'ABERTO', formaPagamento: null, faturamento: 0, itens: [] };
const registros = new Map(); let chamadas = 0, perdidas = 0; let vite;
const api = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5179');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.end();
    const responder = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks).toString();
    if (req.url === '/__teste/status') return responder(200, { ambiente: 'simulado-4d4', chamadas, operacoes: registros.size, respostasPerdidas: perdidas, unidades: pedido.itens.reduce((s, i) => s + i.quantidade, 0), total: pedido.faturamento });
    if (req.method === 'POST' && req.url === '/auth/login') return responder(200, { token: 'token-sintetico-sem-jwt-real', username: 'mesa01', role: 'MESA' });
    if (req.method === 'GET' && req.url === '/mesas/1') return responder(200, { id: 1, numero: 1, status: 'OCUPADA', ativo: true });
    if (req.method === 'GET' && req.url === '/produtos/ativos') return responder(200, [produto]);
    if (req.method === 'GET' && req.url === '/pedidos/mesa/1/aberto') return responder(200, pedido);
    if (req.method === 'PUT' && req.url === '/pedidos/15/itens') {
        chamadas++; const key = req.headers['idempotency-key'];
        if (!key) return responder(400, { mensagem: 'Chave ausente no teste' });
        const salvo = registros.get(key);
        if (salvo) {
            if (salvo.payload !== body) return responder(409, { mensagem: 'Idempotency-Key ja utilizada com conteudo diferente.' });
            res.statusCode = 200; return res.end(salvo.response);
        }
        for (const item of JSON.parse(body)) {
            pedido.itens.push({ id: pedido.itens.length + 1, produtoId: item.produtoId, produtoNome: produto.nome, quantidade: item.quantidade,
                precoUnitario: produto.precoBase, status: 'PENDENTE', dataHoraInclusao: '2026-11-17T12:00:00', tempoPreparoMinutos: 20, dataHoraConclusao: null });
            pedido.faturamento += item.quantidade * produto.precoBase;
        }
        registros.set(key, { payload: body, response: JSON.stringify(pedido) });
        // Mantem a primeira resposta aberta ate o timeout do Axios, apos confirmar em memoria.
        if (!perdidas) { perdidas++; return; }
        return responder(200, pedido);
    }
    return responder(404, { mensagem: 'Rota nao simulada' });
});
api.on('error', error => { console.error('Nao foi possivel iniciar API isolada:', error.code); process.exitCode = 1; });
api.listen(8080, '127.0.0.1', () => {
    console.log('API_SIMULADA_CONFIRMADA 127.0.0.1:8080; sem banco; sem proxy');
    vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], {
        env: { ...process.env, VITE_BACKEND_IP: '127.0.0.1' }, stdio: 'inherit', windowsHide: true
    });
    vite.on('exit', () => api.close());
});
process.on('SIGINT', () => { vite?.kill(); api.close(); process.exit(0); });
