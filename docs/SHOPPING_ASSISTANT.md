# Assistente de compras no Telegram

## Ativação

1. Faça backup do PostgreSQL e execute `docker compose exec worker npm run db:migrate` na imagem atualizada.
2. Configure `SHOPPING_ASSISTANT_ENABLED=true` e `TELEGRAM_BOT_USERNAME` com o nome do seu bot, sem `@`. Recrie o worker.
3. Importe `n8n/workflows/011-product-watch-alerts.json`, confira o endereço interno e o token do worker, e só então ative o WF-011. Ele consulta até 20 produtos e entrega até 20 alertas por execução, a cada cinco minutos. Catálogos grandes são processados em rodízio: cinco minutos não é garantia de frequência para cada item.
4. Abra seu bot no privado e envie `/start`. Nos novos posts publicados pelo worker aparecem Acompanhar produto e Comparar. Posts antigos não são alterados automaticamente.

Os recursos não exigem permissões de administrador. Aprovações continuam no fluxo administrativo existente. Cada usuário só pode listar e remover os próprios alertas, com limite de 20 produtos. `/start` registra o consentimento para mensagens privadas; bloquear o bot suspende a entrega.

## Uso

- **Novo alerta:** botão no menu ou `/acompanhar https://...`. Também é possível enviar o link HTTPS diretamente depois de iniciar o bot.
- **Meus alertas:** botão ou `/alertas`; cada item tem Remover.
- **Comparar:** botão ou `/comparar RX 550 vs GTX 1050 Ti`. A seleção pelo menu expira após 15 minutos.
- **Publicações:** ao clicar no canal, uma mensagem efêmera dirigida ao usuário oferece o link para continuar no privado. Ela não modifica a publicação para os demais inscritos. Se o cliente/API não conseguir exibi-la, há uma instrução temporária para abrir o bot manualmente.

Menus privados são editados no lugar quando acionados por botões. Confirmações importantes e alertas de novas condições ficam no histórico; não são efêmeros.

## Cobertura e limites

Links identificáveis de Shopee, Mercado Livre, Amazon Brasil, KaBuM e AliExpress são aceitos, incluindo determinados encurtadores oficiais. Resolução de links limita redirecionamentos, valida HTTPS e hosts, rejeita destinos privados e fixa o endereço DNS verificado para evitar SSRF.

**Shopee:** quando a API afiliada configurada permite consultar o item exato, o worker verifica o preço atual e gera um link com as credenciais afiliadas da instalação. Itens com faixa de preço/variante não identificada não geram um alerta pelo menor preço. A API não comprova estoque físico; a mensagem pede conferir estoque e variação na loja. Uma consulta atual válida prevalece sobre observações antigas, mesmo quando o preço aumentou.

**Outras lojas ou variantes não consultáveis:** o alerta aguarda o produto exato entrar no catálogo elegível da instalação. Isso não é monitoramento de todos os anúncios dessas lojas. Preços de catálogo precisam ter observação nas últimas 24 horas, estoque conhecido, moeda BRL e nenhuma observação posterior; ofertas vencidas são excluídas. Publicações antigas ainda permitem acompanhar o produto, mas o preço vencido não aparece como preço atual.

O alerta registra uma condição inicial e entrega a primeira condição elegível encontrada, uma queda de preço ou um novo cupom no mesmo preço. Preço maior ou condição repetida não dispara. Envio com resultado incerto é registrado e não repetido automaticamente para evitar duplicações. Recusas explícitas podem ser reavaliadas; bloqueio do destinatário suspende novas tentativas.

**Comparação:** fichas técnicas verificadas inicialmente para RX 550 (referência AMD) e GTX 1050 Ti 4G (MSI). Outras comparações mostram nomes, preços e ofertas disponíveis, com lacunas explícitas. Não há inventário de benchmarks, FPS ou indicação automática de vencedora. As fichas de referência não substituem conferir a variante real do anúncio. Ofertas são filtradas para evitar acessórios e modelos parecidos, como RX 5500 no lugar de RX 550.

Todos os botões de compra usam links afiliados gerados ou armazenados pela própria instalação; o link recebido do usuário serve para identificar o produto, não é usado como seu link de compra.

## Dados e operação

As tabelas `shopper_users`, `shopper_sessions`, `product_watches` e `product_watch_notifications` guardam consentimento, seleção temporária, produtos e histórico de entrega. A rota `POST /v1/product-watches/dispatch` exige o token de serviço existente, não aceita destinatário fornecido no corpo e limita o lote a 20. Desativar a flag e o workflow suspende o recurso sem apagar os dados.

Fichas oficiais: [AMD RX 550](https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-600-500-400/radeon-rx-500-series/radeon-rx-550.html), [MSI GTX 1050 Ti 4G](https://storage-asset.msi.com/datasheet/vga/global/GeForce-GTX-1050-Ti-4G.pdf). Mensagens RichText e efêmeras usam a [Bot API do Telegram](https://core.telegram.org/bots/api).
