# FE-018: medição e regressões

Executar os comandos abaixo na pasta `pizzaria_maua_frontend`, com Node, dependências existentes e Chrome/Edge instalado. O roteiro aceita `CHROME_BIN` quando necessário. Nenhuma dependência adicional é instalada.

## Build comparável

Para comparar versões, utilizar a mesma configuração pública de teste durante ambos os builds, em um processo PowerShell separado:

```powershell
$env:VITE_API_BASE_URL='/fixture-api'
npm run build
node tests/rotas-bundle.browser.mjs
```

Isso altera somente o ambiente do processo e o build ignorado pelo Git; não edita `.env`. Para publicar, reconstruir com a URL de API correta disponível durante o build.

O roteiro inicia seu próprio `vite preview` em porta local livre, usa perfil temporário de navegador, desativa o cache e intercepta a API antes de navegar. Recursos de outras origens são bloqueados; consultas e mutações fora das fixtures falham. As fixtures de login e abertura são sintéticas. Uma falha de asserção encerra com código não zero. Os processos são encerrados no `finally`. Evidências JSON são gravadas no diretório temporário indicado na saída, fora do repositório.

Para medir somente a entrada MESA, inclusive em uma cópia do build anterior:

```powershell
node tests/rotas-bundle.browser.mjs --medir-apenas --dist CAMINHO_DO_BUILD
```

O resumo contém os JavaScripts realmente solicitados pela página e a soma de `Network.loadingFinished.encodedDataLength` dessas requisições, incluindo overhead HTTP. Essa medida depende da compressão do servidor preview. Não representa tempo de carregamento, latência real nem homologação de tablet.

Para tamanhos determinísticos dos artefatos e gzip padrão do Node:

```powershell
node --input-type=module -e "import fs from 'node:fs'; import {gzipSync} from 'node:zlib'; for(const n of fs.readdirSync('dist/assets').filter(n=>/\.(js|css)$/.test(n))){const b=fs.readFileSync('dist/assets/'+n);console.log(n,b.length,gzipSync(b).length)}"
```

## Resultado registrado

Comparação com `VITE_API_BASE_URL=/fixture-api`, sem alteração da configuração Vite. Antes: rotas antecipadas no HEAD `ef26f2076f3282af7c5529a7837646568ed6893d` (o ajuste do lint não altera o JavaScript emitido). Depois: somente dashboard gerencial e arquivo financeiro sob demanda.

| Artefato JavaScript | Antes: bytes / gzip | Depois: bytes / gzip |
|---|---:|---:|
| Principal | 896.592 / 254.993 | 516.500 / 157.456 |
| Chart.js (`auto`) | 203.086 / 68.978 | 203.086 / 68.978 |
| Tabela compartilhada (`column.esm`) | incluída no principal | 347.565 / 91.170 |
| Dashboard gerencial | incluído no principal | 28.275 / 9.137 |
| Arquivo financeiro | incluído no principal | 5.834 / 2.092 |

- JavaScript inicial MESA: apenas o principal nos dois casos. Os chunks administrativos e Chart.js não são solicitados na entrada MESA.
- Transferência JavaScript inicial observada: 255.558 → 157.942 bytes (aproximadamente -38,2%), com cache desativado e mesmo preview.
- Número de arquivos JavaScript: 2 → 5. Total JavaScript emitido: 1.099.678 → 1.101.260 bytes. A mudança adia código; não elimina todo esse código do produto.
- CSS inicial: 242.194 / 31.298 gzip → 236.429 / 30.159 gzip. CSS sob demanda: dashboard 3.008 / 978 gzip; arquivo 2.855 / 894 gzip. Total CSS: 242.194 → 242.292 bytes.
- O aviso de chunk maior que 500 kB permanece no principal. Nenhum limite de aviso ou chunk manual foi configurado.
- No primeiro acesso administrativo há requisições adicionais do módulo de rota, tabela compartilhada e CSS. Chart.js continua sendo solicitado quando o gráfico é montado. Não foi medido tempo em rede lenta.

## Segurança e cobertura

A guarda de autenticação/perfil permanece fora de `RotaSobDemanda`. O fallback é apenas de carregamento; o estado de erro é descartado na mudança de rota ou geração de sessão. A recuperação após falha de chunk exige clique explícito em “Recarregar tela”, sem repetir mutações automaticamente. O reload revalida a identidade pelo fluxo existente.

O roteiro verifica login e `/auth/me` dos quatro perfis, cardápio/carrinho/produto/standby, abertura explícita, cozinha, caixa/arquivo, dashboard/mesas/produtos, perfil inadequado, anonimato, reload, logout durante importação pendente, chunk tardio, erro de chunk e recuperação. A aba analítica exercita os gráficos reais com dados sintéticos.

As suítes FE-016 e FE-017 continuam independentes e validam geometria e foco no servidor de desenvolvimento. O novo roteiro usa o build de produção para conferir os chunks realmente solicitados.

## Pendências fora do FE-018

- Conferir funcionalmente data congelada e fallback financeiro zero em `DashboardGerente` antes de encerrar a auditoria/merge; esse arquivo não foi alterado.
- Validar com backend real em ambiente seguro, tablet físico, teclado virtual e leitor de tela.
- As imagens grandes permanecem intactas. Presença no `dist` não prova download inicial de todas elas; otimização de mídia fica para avaliação própria, com medidas de transferência por experiência.
