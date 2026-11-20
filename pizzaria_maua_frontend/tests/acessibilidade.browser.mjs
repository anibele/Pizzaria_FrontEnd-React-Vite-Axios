// Execução explícita: node tests/acessibilidade.browser.mjs
// Casos isolados: --regressao-escape ou --regressao-standby
// Chrome instalado + CDP nativo do Node; sem API real, credenciais reais ou dependências novas.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const modo = process.argv.includes('--regressao-escape') ? 'escape' : process.argv.includes('--regressao-standby') ? 'standby' : null;
const destino = mkdtempSync(path.join(tmpdir(), 'pizzaria-fe017-'));
const chromeBin = process.env.CHROME_BIN || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chromeBin) throw new Error('Informe CHROME_BIN com um Chrome/Edge instalado. Nenhuma instalação é feita pelo roteiro.');
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
async function portaLivre() {
    const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const porta = server.address().port; await new Promise(resolve => server.close(resolve)); return porta;
}
const porta = await portaLivre(), debug = await portaLivre(), origem = `http://127.0.0.1:${porta}`;
const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(porta), '--strictPort'],
    { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, VITE_API_BASE_URL: `${origem}/fixture-api` } });
const chrome = spawn(chromeBin, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', `--remote-debugging-port=${debug}`, `--user-data-dir=${path.join(destino, 'profile')}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
let socket;
const resultados = [], falhas = [], erros = [];
let mutacoes = 0, chamadas = 0, verificacoes = 0, externasBloqueadas = 0, perfil = 'MESA', livre = false;
const mutacoesPendentes = [];
try {
    async function esperarHTTP(url) {
        for (let i = 0; i < 100; i++) {
            try { const r = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (r.ok) return r; } catch { /* servidor iniciando */ }
            await pausa(100);
        }
        throw new Error('Servidor local não iniciou.');
    }
    await esperarHTTP(origem);
    const tabs = await (await esperarHTTP(`http://127.0.0.1:${debug}/json`)).json();
    socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    const pendentes = new Map(); let sequencia = 0;
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequencia, timer = setTimeout(() => { pendentes.delete(id); reject(new Error(`Timeout CDP: ${method}`)); }, 20000);
        pendentes.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const produtos = Array.from({ length: 6 }, (_, i) => ({ id: i + 4, nome: `Pizza Especial da Casa ${i + 1} com Queijos, Tomates e Manjericão`,
        categoria: 'PIZZAS', descricao: { breveDescricao: 'Pizza tradicional preparada na hora.', tempoMedioPreparo: '20 minutos', pratoVegano: i === 0,
            ingredientes: ['Queijo', 'Tomate', 'Manjericão'] }, precoBase: 35 + i, imagemUrl: '/src/assets/LogoPizzaria.png', ativo: true, qtdEstoque: 20 }));
    const pedido = { id: 15, numeroMesa: 7, dataHora: '2026-11-19T19:00:00', formaPagamento: null, faturamento: 210, status: 'ABERTO',
        itens: produtos.map((p, i) => ({ id: 31 + i, produtoId: p.id, produtoNome: p.nome, quantidade: i + 1, precoUnitario: p.precoBase,
            status: i % 2 ? 'EM_PREPARO' : 'PENDENTE', dataHoraInclusao: '2026-11-19T19:00:00', tempoPreparoMinutos: i % 2 ? 40 : 15, dataHoraConclusao: null })) };
    socket.addEventListener('message', event => {
        const m = JSON.parse(event.data);
        if (m.id) { const p = pendentes.get(m.id); pendentes.delete(m.id); if (m.error) p?.reject(m.error); else p?.resolve(m.result); return; }
        if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.text);
        if (m.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = m.params, url = new URL(request.url);
        // Fontes remotas ou scripts injetados pelo ambiente nunca saem para a rede.
        if (url.origin !== origem) {
            externasBloqueadas++;
            void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
                .catch(() => { erros.push('Falha ao bloquear recurso externo.'); }); return;
        }
        if (url.origin === origem && !url.pathname.startsWith('/fixture-api') && request.method === 'GET') {
            void cdp('Fetch.continueRequest', { requestId }).catch(() => {}); return;
        }
        chamadas++;
        if (!['GET', 'OPTIONS'].includes(request.method)) {
            if (!(request.method === 'PATCH' && url.pathname.endsWith('/pedidos/15/finalizar'))
                && !(request.method === 'DELETE' && url.pathname.endsWith('/mesas/7'))) {
                erros.push('Mutação fora das fixtures previstas.');
                void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {}); return;
            }
            mutacoes++; mutacoesPendentes.push({requestId, method:request.method, caminho:url.pathname}); return;
        }
        const p = url.pathname; let data = [];
        if (p.endsWith('/auth/me')) data = { username: 'usuario-sintetico', role: perfil, numeroMesa: perfil === 'MESA' ? 7 : null };
        else if (/\/mesas\/7$/.test(p)) data = { id: 7, numero: 7, status: livre ? 'LIVRE' : 'OCUPADA', ativo: true };
        else if (p.endsWith('/mesas')) data = [{ id: 7, numero: 7, status: 'OCUPADA', ativo: true }, { id: 8, numero: 8, status: 'LIVRE', ativo: true }];
        else if (p.includes('/produtos')) data = produtos;
        else if (p.endsWith('/aberto')) data = pedido;
        else if (p.endsWith('/cozinha')) data = [pedido];
        else if (p.endsWith('/finalizados')) data = [{ ...pedido, status: 'FINALIZADO', formaPagamento: 'PIX' }];
        else if (p.endsWith('/faturamento')) data = 210;
        else if (p.endsWith('/resumo')) data = { faturamento: 210, ticketMedio: 35, tempoMedioCozinhaMinutos: 20, taxaBebidas: 0 };
        else if (p.endsWith('/rankings')) data = { topPizzas: [], gargalos: [] };
        else if (p.endsWith('/vendas-hora') || p.endsWith('/pagamentos')) data = [];
        else {
            erros.push('Consulta fora das fixtures previstas.');
            void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {}); return;
        }
        void cdp('Fetch.fulfillRequest', { requestId, responseCode: p.endsWith('/aberto') && livre ? 404 : 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }).catch(() => {});
    });
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    const avaliar = async expression => {
        const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error('Falha na avaliação do DOM.'); return r.result?.value;
    };
    async function aguardar(seletor) {
        for (let i = 0; i < 100; i++) { if (await avaliar(`!!document.querySelector(${JSON.stringify(seletor)})`)) {
            await avaliar(`Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))]).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
            await pausa(350); return;
        } await pausa(100); }
        throw new Error(`Elemento não carregado: ${seletor}`);
    }
    let inicializador;
    async function navegar(role, rota, cheio = false, aviso = '') {
        perfil = role;
        if (inicializador) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: inicializador });
        const itens = cheio ? produtos.slice(0, 4).map((produto, i) => ({ produto, quantidade: i + 1 })) : [];
        inicializador = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
            const timeoutOriginal=window.setTimeout, cancelarOriginal=window.clearTimeout;
            window.__cronometrosAtivos=new Map();window.__iniciosCronometro=0;
            window.setTimeout=(callback,ms,...args)=>{
                if(ms!==180000)return timeoutOriginal(callback,ms,...args);
                let id;const executar=()=>{if(!window.__cronometrosAtivos.has(id))return;window.__cronometrosAtivos.delete(id);cancelarOriginal(id);callback(...args)};
                id=timeoutOriginal(executar,ms);window.__cronometrosAtivos.set(id,executar);window.__iniciosCronometro++;
                window.__ativarStandby=executar;return id;
            };
            window.clearTimeout=id=>{window.__cronometrosAtivos.delete(id);cancelarOriginal(id)};
            localStorage.clear();sessionStorage.clear();localStorage.setItem('token','token-sintetico');sessionStorage.setItem('pizzaria_tutorial_concluido','true');localStorage.setItem('pizzaria-carrinho:'+JSON.stringify(['usuario-sintetico',7]),${JSON.stringify(JSON.stringify({ versao: 1, proprietario: { username: 'usuario-sintetico', numeroMesa: 7 }, itens }))});${aviso === 'pendencia' ? "sessionStorage.setItem('pizzaria-abertura-pendente','{');" : ''}${aviso === 'carrinho' ? "localStorage.setItem('pizzaria-carrinho:'+JSON.stringify(['usuario-sintetico',7]),'{');" : ''}` })).identifier;
        await cdp('Page.navigate', { url: origem + rota });
    }
    const verificar = (ok, nome, dados) => { verificacoes++; if (!ok) falhas.push({ nome, dados }); };
    async function captura(nome) { const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(destino, `${nome}.png`), Buffer.from(r.data, 'base64')); }
    const medidas = async () => avaliar(`(()=>{const rect=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().toJSON():null};return{viewport:innerWidth,scroll:document.documentElement.scrollWidth,produtos:rect('.coluna-cardapio'),carrinho:rect('.coluna-pedido'),card:rect('.card-produto'),cards:[...document.querySelectorAll('.card-produto,.card-cozinha')].map(e=>e.getBoundingClientRect().toJSON()),botoes:[...document.querySelectorAll('.btn-entregar,.btn-qty')].map(e=>e.getBoundingClientRect().toJSON())}})()`);
    async function tecla(key, shift = false) {
        const codigos = { Tab: 9, Enter: 13, ' ': 32, Escape: 27 };
        const base = { key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: codigos[key], modifiers: shift ? 8 : 0 };
        await cdp('Input.dispatchKeyEvent', { ...base, type: 'keyDown', ...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{}) });
        await cdp('Input.dispatchKeyEvent', { ...base, type: 'keyUp' }); await pausa(40);
    }
    async function focar(seletor) { await avaliar(`document.querySelector(${JSON.stringify(seletor)}).focus()`); }
    async function abrir(seletor) { await focar(seletor); await tecla('Enter'); await aguardar('[role=dialog]'); }
    const dentro = () => avaliar(`!!document.activeElement.closest('[role=dialog]')`);
    async function conter(nome) {
        verificar(await dentro(),`${nome}: foco inicial dentro`,{});
        const semantica = await avaliar(`(()=>{const e=document.querySelector('[role=dialog]');return{modal:e.getAttribute('aria-modal'),titulo:document.getElementById(e.getAttribute('aria-labelledby'))?.textContent}})()`);
        verificar(semantica.modal === 'true' && !!semantica.titulo?.trim(),`${nome}: título associado`,semantica);
        const ax = await cdp('Accessibility.getFullAXTree');
        verificar(ax.nodes.some(n=>n.role?.value === 'dialog' && !!n.name?.value),`${nome}: diálogo nomeado na árvore acessível`,{});
        for (let i=0;i<7;i++) { await tecla('Tab'); verificar(await dentro(),`${nome}: Tab ${i}`,{}); }
        for (let i=0;i<7;i++) { await tecla('Tab',true); verificar(await dentro(),`${nome}: Shift+Tab ${i}`,{}); }
        await avaliar(`document.querySelector('.nav-avatar')?.focus()`);
        verificar(await dentro(),`${nome}: fundo não mantém foco programático`,{});
    }
    async function esperarMutacao() {
        for(let i=0;i<100;i++){ if(mutacoesPendentes.length)return; await pausa(50); }
        throw new Error('Mutação sintética esperada não iniciou.');
    }
    async function liberar(status, data = null) {
        const m=mutacoesPendentes.shift(); if(!m)throw new Error('Sem requisição pendente');
        await cdp('Fetch.fulfillRequest',{requestId:m.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],
            ...(status===204?{}:{body:Buffer.from(JSON.stringify(data)).toString('base64')})});
    }
    if (!modo) {
    for(const [w,h] of [[390,844],[768,1024],[833,1024],[1366,768]]) {
        await cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
        livre=false;
        await navegar('GERENTE','/mesas');await aguardar('.nav-avatar');
        await tecla('Tab');verificar(await avaliar(`document.activeElement.matches('.nav-avatar')`),`Avatar alcançável por Tab ${w}`,{});
        for(const key of ['Enter',' ']) {
            await tecla(key);verificar(await avaliar(`document.querySelector('.nav-avatar').getAttribute('aria-expanded')==='true'`),`Avatar abre uma vez com ${key} ${w}`,{});
            await tecla('Tab');await tecla('Escape');
            verificar(await avaliar(`document.activeElement.matches('.nav-avatar')&&document.activeElement.getAttribute('aria-expanded')==='false'`),`Escape retorna ao avatar ${w}`,{});
        }
        await tecla('Enter');await tecla('Tab');await tecla('Enter');await aguardar('input[type=password]');
        verificar(await avaliar(`location.pathname==='/login'`),`Logout por teclado ${w}`,{});
        await navegar('MESA','/cardapio');await aguardar('.btn-detalhes');
        const antes=mutacoes;
        await abrir('.btn-detalhes');await conter(`Produto ${w}`);
        await tecla('Escape');await pausa(70);
        verificar(await avaliar(`!document.querySelector('[role=dialog]')&&document.activeElement.matches('.btn-detalhes')`),`Produto retorna ao acionador ${w}`,{});
        verificar(await avaliar(`document.body.style.overflow===''`),`Scroll restaurado ${w}`,{});
        // Fechar por backdrop não ativa o produto ou ação por trás.
        await abrir('.btn-detalhes');await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:3,y:3,button:'left',clickCount:1});
        await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:3,y:3,button:'left',clickCount:1});await pausa(70);
        verificar(await avaliar(`!document.querySelector('[role=dialog]')`),`Backdrop somente fecha leitura ${w}`,{});
        // Dois estados de diálogo existentes podem coexistir; só o último controla o teclado.
        if(w===768) {
            await abrir('.btn-detalhes');
            await avaliar(`document.querySelector('.btn-fechamento').click()`);await aguardar('.btn-opcao-pagamento');
            verificar(await avaliar(`document.querySelectorAll('[role=dialog]').length===2&&document.querySelector('.modal-detalhes-card').inert`),'Diálogo inferior isolado enquanto o superior está aberto',{});
            await tecla('Tab');verificar(await avaliar(`document.activeElement.closest('[role=dialog]').querySelector('.btn-opcao-pagamento')!==null`),'Só o diálogo superior recebe Tab',{});
            await tecla('Escape');verificar(await avaliar(`document.querySelectorAll('[role=dialog]').length===1&&!document.querySelector('.modal-detalhes-card').inert`),'Um Escape fecha somente o diálogo superior',{});
            await tecla('Escape');verificar(await avaliar(`document.activeElement.matches('.btn-detalhes')`),'Fechar pilha restaura acionador original',{});
        }
        // Pagamento é iniciado apenas pela ativação explícita de um botão, com PATCH retido na fixture.
        await abrir('.btn-fechamento');await conter(`Pagamento ${w}`);
        await focar('.btn-opcao-pagamento');await tecla('Enter');await esperarMutacao();await aguardar('[role=dialog][aria-busy=true]');
        const n=mutacoes;
        await tecla('Escape');await tecla('Enter');await tecla(' ');
        await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:3,y:3,button:'left',clickCount:1});
        await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:3,y:3,button:'left',clickCount:1});
        verificar(await avaliar(`!!document.querySelector('[role=dialog][aria-busy=true]')&&document.querySelector('.btn-modal-fechar').disabled`),`Pagamento pendente não fecha ${w}`,{});
        verificar(mutacoes===n&&n===antes+1,`Pagamento não duplica por teclado ${w}`,{mutacoes});
        await tecla('Tab');verificar(await dentro(),`Pagamento sem controles habilitados mantém foco ${w}`,{});
        await liberar(500,{mensagem:'Falha sintética'});await aguardar('.btn-modal-fechar:not(:disabled)');await tecla('Escape');
        verificar(await avaliar(`!document.querySelector('[role=dialog]')&&document.activeElement.matches('.btn-fechamento')`),`Pagamento recuperado fecha e retorna ${w}`,{});
        verificar(mutacoes===n,`Reconciliação não repete PATCH ${w}`,{});
        if(w===768) {
            await abrir('.btn-fechamento');await focar('.btn-opcao-pagamento');await tecla('Enter');await esperarMutacao();
            pedido.status='AGUARDANDO_PAGAMENTO';await liberar(200,{...pedido,formaPagamento:'PIX'});await aguardar('.sucesso-container');
            await tecla('Tab');await tecla('Escape');
            verificar(await dentro(),'Pagamento confirmado preserva tela de sucesso original',{});
            await avaliar(`window.__retornoAntigo=0;document.querySelector('.btn-fechamento').addEventListener('focus',()=>window.__retornoAntigo++);localStorage.removeItem('token');window.dispatchEvent(new StorageEvent('storage',{key:'token',newValue:null,storageArea:localStorage}))`);
            await aguardar('input[type=password]');
            verificar(await avaliar(`window.__retornoAntigo===0&&!document.querySelector('[role=dialog]')`),'Troca de sessão não restaura foco antigo',{});
            pedido.status='ABERTO';
        }
        // Aviso de descarte e pagamento são diálogos encadeados.
        await navegar('MESA','/cardapio',true);await aguardar('.btn-fechamento');await abrir('.btn-fechamento');
        await conter(`Aviso do carrinho ${w}`);await focar('.modal-aviso-actions .btn-danger');await tecla('Enter');await aguardar('.btn-opcao-pagamento');
        verificar(await avaliar(`document.querySelectorAll('[role=dialog]').length===1`),`Encadeamento sem dois diálogos ativos ${w}`,{});
        await tecla('Escape');verificar(await avaliar(`document.activeElement.matches('.btn-fechamento')`),`Encadeamento restaura acionador original ${w}`,{});
        // Administração: foco inicial nunca é ação destrutiva; Escape não contorna operação em curso.
        await navegar('GERENTE','/mesas');await aguardar('.btn-deletar-mesa');await abrir('.btn-deletar-mesa');await conter(`Ações de mesa ${w}`);
        verificar(await avaliar(`!document.activeElement.matches('.card-excluir,.card-desativar')`),`Ação destrutiva não recebe foco inicial ${w}`,{});
        await focar('.card-excluir');await tecla('Enter');await esperarMutacao();const adm=mutacoes;
        await tecla('Escape');await tecla('Enter');
        verificar(await avaliar(`!!document.querySelector('[role=dialog][aria-busy=true]')&&document.querySelector('.btn-fechar-modal-X').disabled`),`Mesa pendente não fecha ${w}`,{});
        verificar(mutacoes===adm,`Administração sem DELETE repetido ${w}`,{});
        await liberar(409,{mensagem:'Conflito sintético de negócio'});await aguardar('.btn-fechar-modal-X:not(:disabled)');await tecla('Escape');
        verificar(await avaliar(`!document.querySelector('[role=dialog]')&&document.activeElement.matches('.btn-deletar-mesa')`),`Mesa retorna após rejeição ${w}`,{});
        verificar(mutacoes===adm,`DELETE rejeitado não dispara PATCH ${w}`,{});
        const alvos=await avaliar(`({detalhe:null,remover:document.querySelector('.btn-deletar-mesa').getBoundingClientRect().toJSON()})`);
        // A animação pode produzir diferenças subpixel na subtração dos limites geométricos.
        verificar(Math.round(alvos.remover.width*1000)/1000>=44&&Math.round(alvos.remover.height*1000)/1000>=44,`Alvo administrativo ampliado ${w}`,alvos);
        await navegar('CAIXA','/caixa/arquivo');await aguardar('.btn-alternador');
        await avaliar(`[...document.querySelectorAll('.btn-alternador')].find(e=>e.textContent.includes('Tabela')).click()`);await aguardar('.p-datatable');
        const botao=await avaliar(`(()=>{const e=document.querySelector('.p-datatable button[title]');return e?.getAttribute('title')})()`);
        // O botão da coluna de ações já fornece acesso por teclado ao modal existente.
        if(!botao)throw new Error('Acionador de detalhes não encontrado na tabela');
        await abrir('.p-datatable button[title]');await conter(`Detalhes do pedido ${w}`);await tecla('Escape');
        verificar(await avaliar(`!!document.activeElement.closest('.p-datatable')`),`Detalhes retornam à tabela ${w}`,{});
        await navegar('MESA','/cardapio');await aguardar('.btn-detalhes');
        const alvo=await avaliar(`document.querySelector('.btn-detalhes').getBoundingClientRect().toJSON()`);
        verificar(Math.round(alvo.height*1000)/1000>=44,`Alvo de detalhes ampliado ${w}`,alvo);
        resultados.push({w,h,alvos,alvo});
        await captura(`teclado-${w}`);
    }
    // Início e standby: Enter/Espaço nativos, foco visível e sem foco nos controles cobertos.
    for(const [w,h] of [[390,844],[768,1024],[1366,768]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
    for(const key of ['Enter',' ']) {
        livre=true;await navegar('MESA','/cardapio');await aguardar('.tela-inicio-fullscreen-container');
        await tecla('Tab');verificar(await avaliar(`document.activeElement.matches('.tela-inicio-fullscreen-container')&&getComputedStyle(document.activeElement).outlineStyle!=='none'`),`Tela inicial foco visível ${key}`,{});
        await tecla(key);await aguardar('.onboarding-modal');verificar(await dentro(),`Início por ${key} abre boas-vindas uma vez`,{});
        await tecla('Escape');await pausa(100);verificar(await avaliar(`!document.querySelector('.onboarding-modal')&&!!document.querySelector('.card-produto')`),`Boas-vindas fecha sem ação destrutiva ${key}`,{});
        // Controla apenas o relógio de inatividade da aplicação real; não espera três minutos reais.
        await avaliar(`window.__ativarStandby()`);await aguardar('.standby-fullscreen-container');await tecla('Tab');
        verificar(await avaliar(`document.activeElement.matches('.standby-fullscreen-container')`),`Standby alcançável ${key}`,{});
        await tecla(key);await aguardar('.card-produto');verificar(await avaliar(`!document.querySelector('.standby-fullscreen-container')`),`Retorno por ${key}`,{});
    }
    // Mouse e toque exercitam os mesmos botões nativos sem listeners globais duplicados.
    for(const toque of [false,true]) {
        livre=true;await navegar('MESA','/cardapio');await aguardar('.tela-inicio-fullscreen-container');
        const ativar=async()=>{
            if(toque) {
                await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
                await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:w/2,y:h/2}]});
                await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            } else {
                await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:w/2,y:h/2,button:'left',clickCount:1});
                await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:w/2,y:h/2,button:'left',clickCount:1});
            }
        };
        await ativar();await aguardar('.onboarding-modal');
        verificar(await dentro(),`Início preservado por ${toque?'toque':'mouse'} ${w}`,{});
        await tecla('Escape');await avaliar(`window.__ativarStandby()`);await aguardar('.standby-fullscreen-container');
        await ativar();await aguardar('.card-produto');
        verificar(await avaliar(`!document.querySelector('.standby-fullscreen-container')`),`Retorno preservado por ${toque?'toque':'mouse'} ${w}`,{});
        await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
    }
    }
    }
    if (!modo || modo === 'escape') {
        livre=false;await cdp('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
        await navegar('MESA','/cardapio');await aguardar('.btn-fechamento');
        verificar(await avaliar(`window.__cronometrosAtivos.size===1`),'Strict Mode mantém um cronômetro ativo',{});
        await abrir('.btn-fechamento');await focar('.btn-opcao-pagamento');await tecla('Enter');await esperarMutacao();await aguardar('[role=dialog][aria-busy=true]');
        const antes=mutacoes;
        for(const key of ['Escape','Tab','Enter',' ']) {
            await avaliar(`window.__antesAtividade=window.__iniciosCronometro`);await tecla(key);
            const estado=await avaliar(`({reinicios:window.__iniciosCronometro-window.__antesAtividade,ativos:window.__cronometrosAtivos.size,protegido:!!document.querySelector('[role=dialog][aria-busy=true]'),focoDentro:!!document.activeElement.closest('[role=dialog]')})`);
            verificar(estado.reinicios===1&&estado.ativos===1,`${key}: registra atividade uma vez`,estado);
            verificar(estado.protegido&&estado.focoDentro&&mutacoes===antes,`${key}: preserva operação pendente sem repetir PATCH`,estado);
        }
        await liberar(500,{mensagem:'Falha sintética'});await aguardar('.btn-modal-fechar:not(:disabled)');await tecla('Escape');
        verificar(await avaliar(`document.activeElement.matches('.btn-fechamento')`),'Recuperação normal ainda restaura o acionador',{});
        await avaliar(`window.__timerAntigo=window.__ativarStandby;localStorage.removeItem('token');window.dispatchEvent(new StorageEvent('storage',{key:'token',newValue:null,storageArea:localStorage}))`);
        await aguardar('input[type=password]');
        verificar(await avaliar(`window.__cronometrosAtivos.size===0`),'Logout cancela cronômetro antigo',{});
        await avaliar(`window.__antesAtividade=window.__iniciosCronometro;window.__timerAntigo()`);await tecla('Tab');
        verificar(await avaliar(`window.__iniciosCronometro===window.__antesAtividade&&location.pathname==='/login'`),'Sessão antiga não mantém callback ou listener de atividade',{});
    }
    if (!modo || modo === 'standby') {
        livre=false;await cdp('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
        for(const comDialogo of [false,true]) {
            await navegar('MESA','/cardapio');await aguardar('.btn-detalhes');if(comDialogo)await abrir('.btn-detalhes');
            if(comDialogo)verificar(await dentro(),'Diálogo recebe foco antes da transição',{});
            await avaliar(`window.__ativarStandby()`);await aguardar('.standby-fullscreen-container');
            const estado=await avaliar(`({noStandby:document.activeElement.matches('.standby-fullscreen-container'),noBody:document.activeElement===document.body,ativos:window.__cronometrosAtivos.size,dialogos:document.querySelectorAll('[role=dialog]').length})`);
            verificar(estado.noStandby&&!estado.noBody,`Standby mantém foco após desmontagem, diálogo=${comDialogo}`,estado);
            verificar(estado.ativos===0&&estado.dialogos===0,'Transição limpa cronômetro e diálogo anterior',estado);
            await avaliar(`new Promise(r=>queueMicrotask(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
            verificar(await avaliar(`document.activeElement.matches('.standby-fullscreen-container')&&document.body.style.overflow===''`),'Restauração tardia não rouba foco nem mantém scroll bloqueado',{});
            await tecla('Tab',true);verificar(await avaliar(`document.activeElement.matches('.standby-fullscreen-container')`),'Sem listener órfão do diálogo após standby',{});
        }
        // Um acionador indisponível não deve ser escolhido na recuperação.
        for(const condicao of ['disabled','hidden','inert','removido']) {
            await navegar('MESA','/cardapio');await aguardar('.btn-detalhes');await abrir('.btn-detalhes');
            await avaliar(`(()=>{const e=document.querySelector('.btn-detalhes');window.__acionadorAnterior=e;${condicao==='removido'?'e.remove()':`e.${condicao}=true`}})()`);
            await tecla('Escape');
            verificar(await avaliar(`document.activeElement!==window.__acionadorAnterior&&document.activeElement!==document.body&&document.activeElement.matches('button,a[href],input,select,textarea')&&!document.activeElement.closest('[hidden],[inert]')&&!document.activeElement.matches(':disabled')`),`Acionador ${condicao}: destino interativo disponível`,{});
        }
    }
    verificar(mutacoesPendentes.length===0,'Todas as mutações simuladas foram resolvidas',{});
    verificar(erros.length===0,'Sem exceções de execução',erros);
    writeFileSync(path.join(destino,'medidas.json'),JSON.stringify({resultados,verificacoes,falhas,erros,chamadas,externasBloqueadas,mutacoesSimuladas:mutacoes},null,2));
    console.log(JSON.stringify({evidencias:destino,verificacoes,falhas,erros,externasBloqueadas,mutacoesSimuladas:mutacoes}));
    if(falhas.length)process.exitCode=1;
    await cdp('Browser.close').catch(()=>{});
} finally {socket?.close();chrome.kill();vite.kill();}
