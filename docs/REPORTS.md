# Relatórios privados de desempenho

O WF-010 envia um relatório semanal na segunda-feira às 09:00 e um mensal no dia 1 às 09:00, no fuso `America/Sao_Paulo`. O semanal cobre a semana anterior, de segunda a domingo; o mensal cobre o mês anterior completo. Cada relatório compara os resultados com o período imediatamente anterior.

Os relatórios usam RichText nativo do Telegram (`sendRichMessage`), com cabeçalhos, tabelas de resultados e comissões, destaques, canais e produtos mais vendidos quando disponíveis. As limitações das métricas ficam em um rodapé. A prévia da API retorna o documento em Rich Markdown; nomes de produtos são escapados para não inserir links ou marcação no relatório.

## Ativação em uma nova instalação

1. Inicie uma conversa com seu próprio bot no Telegram usando `/start`.
2. Configure `TELEGRAM_ADMIN_USER_IDS` com o ID numérico do administrador. Defina `TELEGRAM_REPORT_CHAT_ID` com esse mesmo ID; se ficar vazio, o primeiro administrador será usado. IDs de grupos ou destinatários fora da lista de administradores são recusados.
3. Configure `AWIN_PUBLISHER_ID` e `AWIN_API_TOKEN` e/ou as credenciais existentes da Shopee (`SHOPEE_APP_ID`, `SHOPEE_SECRET`, `SHOPEE_AFFILIATE_API_URL`). Cada pessoa precisa usar suas próprias contas.
4. Defina `PERFORMANCE_REPORTS_ENABLED=true`, recrie o Worker e execute `docker compose exec worker npm run db:migrate`.
5. Importe `n8n/workflows/010-private-performance-reports.json` no n8n e publique/ative o workflow. Ele é versionado desativado para evitar envios antes da configuração.

Para testar o mesmo caminho semanal usado pelo agendamento, o WF-010 também aceita execução sob demanda. Com o workflow importado, execute `docker compose exec -e N8N_RUNNERS_BROKER_PORT=5680 n8n n8n execute --id=62c074ba-1e6c-4d34-b5f8-f8473c85c01d`. Isso envia o relatório semanal ao privado configurado. A porta separada evita conflito com o broker do n8n em execução; nenhum nó de código ou runner Python é usado pelo relatório.

Os endpoints usam a autenticação interna por `WORKER_SERVICE_TOKEN`:

- `GET /v1/reports/performance?period=weekly` ou `period=monthly`: consulta os dados e o texto sem enviar mensagens.
- `POST /v1/reports/performance/send`, corpo `{"period":"weekly"}` ou `{"period":"monthly"}`: envia ao destinatário configurado.
- `referenceDate` opcional em ISO 8601 seleciona uma data de referência para consultar um período encerrado. Não é permitido informar um destinatário no corpo da requisição.

## O que é medido

| Dado | Origem e limite |
| --- | --- |
| Publicações por canal | Registros com status `published` e data dentro do período no PostgreSQL. Não contam ofertas apenas descobertas ou agendadas. |
| Cliques Awin | Relatório oficial de programas brasileiros em BRL. São cliques, não visitantes únicos. |
| Compras Awin | Transações dos tipos `Sale`, `Mobile Sale` e `Mobile App Purchase`. Bônus, leads e pagamentos por clique não são compras. Valores em moedas diferentes ficam separados. |
| Compras Shopee | Todos os pedidos do relatório de conversões, com paginação e deduplicação por pedido. Separam-se pendentes, concluídos, cancelados e não pagos. |
| Comissão Shopee | Estimada; pedido concluído não prova que a comissão foi validada ou paga. A comissão confirmada permanece indisponível nesta integração. |
| Cliques Shopee | O relatório de conversões não fornece o total de cliques; não se usa a quantidade de conversões como substituto. |
| Mercado Livre e vitrine | As métricas ainda não estão conectadas ao coletor; aparecem como indisponíveis. |

As métricas de compras e cliques correspondem às contas afiliadas consultadas, inclusive links divulgados fora do bot. Não existe atribuição desses cliques e compras por canal do Telegram nesta versão. Produtos mais vendidos aparecem quando a plataforma fornece os itens da compra. API sem acesso, falha ou resposta inválida é diferente de uma consulta válida com zero resultados.

## Histórico e repetição de envios

A tabela `performance_reports` guarda o período, o destinatário, os dados usados, o status e o ID da mensagem entregue. A reserva única impede envios repetidos do mesmo tipo, período e destinatário, inclusive em chamadas concorrentes.

Falhas de rede durante o envio podem acontecer depois de o Telegram aceitar a mensagem. Nessa situação, o status fica `unknown`; uma nova chamada não reenvia automaticamente. Consulte o privado antes de reconciliar esse registro. Se um processo for interrompido durante o envio, o registro pode permanecer `sending`, também reservado. Os retries de rede e de HTTP 5xx ficam desativados exclusivamente para essas mensagens; as promoções mantêm o comportamento existente.

As comissões pendentes podem mudar depois do envio. O relatório registra a situação consultada naquele momento, não uma promessa de pagamento.

Uma recusa explícita do Telegram (por exemplo, o administrador ainda não enviou `/start`) libera a reserva para uma nova tentativa. Isso é diferente de um timeout: na recusa, a API informa que não entregou a mensagem.
# Atividade do assistente

Os relatórios incluem novos usuários (primeiro `/start`), alertas criados e notificações com entrega confirmada ou incerta. A consulta usa o mesmo período fechado em Brasília das métricas financeiras, com início inclusivo e fim exclusivo. Notificações são agrupadas pela criação da tentativa e pelo status conhecido na consulta; envios incertos não são somados às entregas confirmadas. Um alerta reativado não conta como nova criação. Falhas de consulta aparecem como indisponibilidade, nunca como zero.

Esses indicadores não representam cliques, compras nem usuários ativos. Comparações realizadas e crescimento dos canais ainda exigem coleta específica; não há histórico retroativo inventado.

