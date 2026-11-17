# Fase 4D.4 — adição segura de itens

Integração exclusiva do frontend para `PUT /pedidos/{id}/itens`. Não há alteração no backend ou no banco. O backend necessário é o commit `4c9c09bcad5268728133fbbdf71045d84ee01ff4`, com a tabela já migrada.

## Funcionamento

`usePedidoAdicionarItens` usa `GestorAdicao` e `enviarAdicao`. Uma intenção captura pedido, itens/quantidades na ordem original e UUID, antes do primeiro envio. O snapshot é copiado e congelado; retries ignoram o carrinho atual. O cabeçalho `Idempotency-Key` só é enviado no PUT de adição, conservando URL, Bearer e interceptors existentes. O timeout de 15 segundos vale apenas para essa operação; React Query não faz retries automáticos.

UUID usa `crypto.randomUUID()` ou UUID v4 construído com `crypto.getRandomValues()` quando randomUUID não está disponível, como em alguns tablets acessando HTTP na rede local. Não há fallback para Math.random. Sem gerador seguro ou armazenamento disponível, a adição não é enviada sem proteção.

O guard síncrono do gestor bloqueia reentrância antes do primeiro await; o cardápio também usa useRef para bloquear dois toques na confirmação, incluindo o fluxo anterior de abertura. Botões de quantidade ficam desabilitados enquanto há pendência, e ações de carrinho/pagamento são bloqueadas. Nenhum estilo ou layout existente foi redesenhado.

## Resultado incerto e nova tentativa

Timeout, ausência de resposta, 5xx, 408 ou 429 conservam a chave e o snapshot. A mensagem é:

> Não foi possível confirmar se os itens foram adicionados. Você pode tentar novamente sem duplicar o pedido.

O botão **Tentar novamente** reenvia a mesma intenção; não cria outra chave. A seleção não é apagada em falha. HTTP 409 não inicia outra operação automaticamente nem troca a chave. 401 mantém o redirecionamento já existente ao login; 403 bloqueia novas tentativas naquele contexto.

Uma rejeição definitiva fresca (400/404 ou conflitos reconhecidos de estoque/estado), sem resultado incerto anterior, pode liberar **Revisar seleção** por ação explícita. Isso não envia nada: mantém o carrinho para revisão. Conflito de reutilização de chave ou operação recuperada/incerta não permite esse descarte, para evitar transformar um retry em nova cobrança. Se não for possível resolver, conferir a comanda e solicitar atendimento.

## Sucesso e histórico

Após HTTP 200, o carrinho persistido é removido antes da chave pendente. O estado visual é limpo uma vez. O corpo do replay não é somado nem mesclado ao histórico: são invalidadas as consultas existentes para obter o estado atual por GET. Isso também evita interpretar um snapshot antigo como reabertura de um pedido.

Enquanto a operação está incerta, o total da seleção continua identificado como seleção; o total acumulado que somaria seleção + histórico fica oculto para não apresentar o mesmo consumo duas vezes. Respostas atrasadas de uma tela desmontada não confirmam nem limpam uma operação mais nova.

## Sessão, navegação e reload

`sessionStorage` guarda somente UUID, pedido, snapshot dos itens e contexto mínimo (nonce de sessão, username, role e número da mesa). Nenhum JWT ou senha é copiado para esse registro. O nonce de login, username e role também ficam em um marcador mínimo no localStorage, para invalidar contextos antigos quando outra aba faz logout/login. O payload pendente continua restrito ao sessionStorage da aba. O armazenamento de autenticação anterior permanece como estava; a única adição é o identificador do ciclo de login.

Navegar/remontar/recarregar recupera a pendência na mesma aba, usuário, sessão e mesa. Não há replay automático. Mesmo se o pedido já não estiver ativo, o botão manual usa o ID original, sem chamar POST de abertura. Mesa LIVRE/inativa/reservada não apaga ou esconde a pendência recuperada. Standby/modal não descartam a operação.

Antes e depois de cada tentativa, o contexto é conferido novamente. Outra mesa/usuário/role ou novo ciclo de login não pode utilizar o registro anterior: a operação fica bloqueada para revisão. Logout e o interceptor de 401 encerram o contexto de adição juntamente com a limpeza de autenticação já existente. Uma resposta em trânsito após logout não limpa o carrinho de uma nova sessão.

A persistência é por aba (sessionStorage), não compartilhada entre tablets. Fechar a aba/janela ou sair da conta encerra esse contexto; conferir a comanda antes de repetir intencionalmente itens numa nova sessão. Login direto sobre uma pendência de sessão anterior não a transfere: ela fica bloqueada para atendimento. Não existe deduplicação entre intenções diferentes criadas por outros dispositivos.

O frontend ainda obtém o número da mesa a partir do username no fluxo anterior. Este trabalho não substitui essa regra por um novo contrato de identidade; a autorização efetiva continua sendo aplicada pelo backend à associação persistida. A UI não concede acesso ao alterar o número localmente.

## Testes e verificações

Não havia script/suíte de testes no projeto. Foi adicionado `npm test`, usando Node nativo (`node:test`), TypeScript e React já instalados, sem novas dependências. Validado com Node 26.13.0 e npm 11.20.0.

**28 testes aprovados:** cabeçalho, timeout do PUT, demais métodos sem cabeçalho, snapshot imutável, UUID estável, nova intenção, dois toques, falhas de transporte/5xx, confirmação perdida após commit simulado, recuperação sem envio automático, 409, 401/403, usuário/mesa/role/sessão distintos, logout durante envio, resposta atrasada, storage indisponível/corrompido, fallback criptográfico e renderização dos controles/totais. Os testes de componentes usam renderização React no servidor; não simulam eventos de um navegador.

Também foi feito smoke no navegador real com Vite em `127.0.0.1:5179` e API simulada em memória em `127.0.0.1:8080` (`node tests/api-simulada.mjs`). A API não conecta a banco nem encaminha chamadas. Ela confirma a primeira operação e retém a resposta até o timeout do Axios. Observou-se loading e controles bloqueados, mensagem de incerteza, reload conservando a pendência sem nova chamada, retry manual e carrinho limpo com uma unidade no histórico. Métricas finais: duas chamadas PUT, uma chave/operação confirmada, uma unidade, total R$ 10,25. O simulador foi encerrado após o teste.

Esse smoke não substitui teste ponta a ponta com Spring Boot/MySQL descartáveis. Nenhuma chamada foi enviada ao backend real ou ao banco original.

TypeScript (`tsc -b`) e build Vite aprovados; o build mantém o aviso anterior de chunks grandes. Lint dos sete arquivos TS/TSX alterados aprovou. O lint global já falhava antes: 15 erros + um aviso; após a tarefa, 13 erros + um aviso preexistentes em outros arquivos. Não foram corrigidos componentes alheios à fase. `git diff --check` dos arquivos desta fase aprovado. O comando global aponta cinco espaços finais nas alterações preexistentes de gerarComanda.ts; esse arquivo foi preservado.

## Arquivos preexistentes e pendências

Foram preservadas as alterações locais anteriores em ModalDetalhesPedido.tsx, ArquivoCaixa.tsx e no rename/edição gerarComandaTxt.ts → gerarComanda.ts. Não pertencem ao commit desta fase.

Permanecem: lint global preexistente, ensaio integrado com backend/MySQL descartáveis e política operacional de retenção/limpeza no backend. O cliente não apaga registros idempotentes do servidor. A proteção depende do registro preservado pelo backend e do uso deste fluxo com chave; consumidores legados externos sem cabeçalho continuam sem essa garantia.
