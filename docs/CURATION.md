# Classificação e variedade de ofertas

## Comportamento

O classificador v2 utiliza título e categoria. Tipos específicos prevalecem sobre categorias amplas; notebooks e computadores completos seguem para Eletrônicos, componentes e periféricos para Hardware. Uma categoria reconhecida é usada como fallback quando o título não contém evidência específica suficiente.

Grafias com/sem hífen, acentos e espaços repetidos são normalizadas. As regras usam palavras/expressões delimitadas, evitando encontrar `pote` dentro de `potência`. Há tratamento de contexto para embalagens, potes para freezer, acessórios de notebook, mousepads, brinquedos e produtos capilares. Kits com evidências de diferentes nichos continuam em revisão.

Produtos claros podem ser automáticos mesmo sem categoria. Alta/média/baixa são níveis de evidência das regras, **não probabilidades estatísticas de acerto**. Os testes de qualidade são uma base dirigida de regressão; não representam a distribuição completa do catálogo.

## Aprovação e decisões reutilizáveis

Escolher o canal salva a preferência na oferta. Novas ofertas do mesmo identificador da mesma fonte podem reaproveitá-la. Entre fontes, o reaproveitamento requer igualdade de GTIN com comprimento e dígito verificador válidos; títulos semelhantes não criam regras automáticas amplas. A escolha manual mais recente prevalece, e escolhas de ofertas rejeitadas não são usadas.

Escolher um canal não libera republicação. O cooldown, o preço, a disponibilidade, a imagem e os limites de publicação permanecem ativos. Diferentes tamanhos, capacidades e variantes não são fundidos por aproximação de marca/modelo.

As mensagens de revisão incluem motivo em português e termos reconhecidos. Os eventos de solicitação guardam a decisão com versão e termos; decisões automáticas também aparecem no log `Product channel classified`. Estes logs ajudam a auditar regras; não equivalem a uma taxa de acerto medida.

## Descoberta e equilíbrio

Nas categorias previstas em `mercadolivre-discovery-plan.ts`, dois ciclos de descoberta usam buscas por famílias e o terceiro consulta os destaques. A escolha acompanha blocos de 20 minutos, iguais ao agendamento do WF-001. Uma consulta explícita `query` não é substituída. Categorias desconhecidas continuam usando destaques.

As buscas de famílias são textuais: a API pode retornar itens relacionados. O classificador continua responsável pelo canal de destino. Nenhuma oferta é publicada apenas porque pertence a uma busca planejada.

A fila considera os 100 candidatos elegíveis mais antigos, prioriza o nicho há mais tempo sem publicação e escolhe o maior score dentro dele. Em empate de atividade, prioriza o nicho com a oferta mais antiga. Isso melhora a distribuição, mas não garante cotas: um canal sem oferta válida continua sem publicação.

Repetição é verificada por identificador da fonte, título normalizado exato ou GTIN validado. A consulta também normaliza títulos históricos em português. Não há deduplicação semântica de todos os anúncios possíveis; não se deve esperar que toda variação de marketing seja reconhecida.

## Instalação e atualização

Configure seus próprios IDs de canais, tokens e fontes no `.env`, seguindo `.env.example`. Não copie sessões nem credenciais de outra instalação. Para atualizar o Worker:

```bash
cd apps/worker
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
cd ../..
docker compose up -d --build worker
```

Esta atualização não exige nova tabela nem migração destrutiva. O banco existente mantém escolhas e publicações. Ofertas já em aprovação não são liberadas em massa automaticamente: reavaliá-las exige conferir validade, link e histórico de envio.

O WF-001 inclui isolamento de erros por busca, de modo que uma fonte indisponível não impeça as seguintes. Em instalações existentes, atualize o workflow no n8n e publique a versão. Importar um arquivo pode desativar o workflow; publique-o novamente e reinicie o n8n quando usar a CLI:

```bash
docker compose exec n8n n8n import:workflow --input=/home/node/.n8n/workflows/001-discover-offers.json
docker compose exec n8n n8n publish:workflow --id=7ad096a9-78d9-40ec-8cee-985c86b5e90e
docker compose restart n8n
```

Se sua instalação usa outro ID de workflow, utilize o ID local em vez do exemplo.

## Gerador de links Mercado Livre no Docker (opcional)

OAuth da API e a sessão do portal de afiliados são credenciais diferentes. O serviço opcional precisa de uma sessão autenticada **da sua conta afiliada**. Ele não cria essa sessão automaticamente.

Em uma máquina com ambiente gráfico:

```bash
cd apps/worker
npx playwright install chromium
npm run auth:mercadolivre-affiliate
cd ../..
```

Depois do login, copie apenas a sessão gerada para o volume privado:

```bash
docker compose cp apps/worker/data/auth/mercadolivre-affiliate.json worker:/app/data/auth/mercadolivre-affiliate.json
docker compose exec worker chmod 600 /app/data/auth/mercadolivre-affiliate.json
docker compose -f compose.yaml -f infra/compose.affiliate-queue.yaml up -d --build worker affiliate-queue
```

`FREGUESIA_WORKER_IMAGE` define a imagem compartilhada dos dois serviços. O Worker deve estar saudável e acessível como `worker:3001`. O serviço consulta a fila a cada dois minutos após concluir o ciclo anterior. Utiliza display virtual e não abre janelas na área de trabalho.

Confira `docker compose -f compose.yaml -f infra/compose.affiliate-queue.yaml logs affiliate-queue`. Se a sessão expirar, autentique novamente e substitua o arquivo privado. O DOM do portal pode mudar e exigir atualização do script. Nunca publique esse JSON: ele pode permitir acesso à conta.

## Verificação

- `product-niche-quality.test.ts`: exemplos positivos, negativos, grafias e conflitos.
- `product-identity.test.ts`: normalização e validação de GTIN.
- `process-scheduled-offer.test.ts`: reaproveitamento manual e cooldown independente.
- `publication-variety.test.ts`: alternância entre nichos e seleção por qualidade.
- `discovery-variety.test.ts`: rotação de famílias e manutenção dos destaques.

Compare janelas semelhantes de produtos únicos publicados, distribuição por canal, revisões e correções humanas. Maior volume, isoladamente, não comprova melhor qualidade.
