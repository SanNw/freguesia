# Assistente de compras do Freguesia

## Objetivo aprovado

Permitir que qualquer usuário acompanhe um produto de uma publicação ou de um link enviado no privado, receba novas promoções com os links de afiliado do Freguesia e compare produtos por nome ou seleção. Priorizar botões, RichText e interações efêmeras sem mensagens públicas de atendimento.

## Fluxos

1. As publicações novas terão Comprar, Acompanhar e Comparar. Comprar preserva o link atual. Acompanhar/Comparar usam callbacks públicos específicos `shop:`; nunca as ações administrativas `offer:`.
2. No canal, a resposta ao clique é uma mensagem efêmera destinada a `callback.from.id`, com o `callback_query_id` real. Se o usuário não iniciou o privado, o botão abre o bot com `start=watch_UUID` ou `start=compare_UUID`. Nenhum interesse pessoal é publicado no canal.
3. No privado, `/start` mostra o menu com Alertas, Acompanhar, Comparar e Canais. O usuário pode enviar diretamente um único link HTTPS de produto suportado. `/alertas` lista seus acompanhamentos e oferece botões para remover; `/comparar A vs B` compara os dois produtos. O menu também inicia a seleção em duas etapas, sem exigir comandos digitados.
4. As confirmações importantes e os alertas no privado são persistentes; avisos de interface usam callbacks/efêmeras. Menus existentes podem ser editados. Mensagens efêmeras não substituem a entrega durável de promoções, pois não há garantia de entrega a usuários offline.

## Identidade e ofertas

Correspondência por produto exato, nunca por título parecido. Reconhecer item/loja da Shopee, anúncio/catálogo do Mercado Livre, ASIN da Amazon, produto KaBuM e identificador AliExpress. Preservar uma variação explícita; não confundi-la com outra opção. Links curtos suportados podem ser resolvidos, limitados a hosts autorizados, HTTPS, porta padrão, sem credenciais e DNS público. Rejeitar destinos privados, redirecionamentos para domínios não permitidos, carrinho/login/páginas que não identifiquem produto.

O link recebido identifica o desejo do usuário, não o afiliado da notificação. Usar exclusivamente links já aprovados do catálogo do Freguesia ou gerados pelas credenciais do próprio projeto.

Ofertas aprovadas/agendadas/publicadas, não expiradas, com preço positivo, estoque e afiliado válido podem alimentar alertas. Ofertas rejeitadas, pendentes de aprovação ou de link não podem ser enviadas. Na assinatura por publicação, registrar a condição atual como referência para não reenviar imediatamente a mesma promoção. Deduplicar preço/cupom por usuário e produto, incluindo chamadas concorrentes e retries. Nunca avisar preço superior como queda. Alertar uma nova condição promocional, preço menor ou cupom diferente; repetir a oferta idêntica não é uma nova promoção.

## Consulta e disponibilidade

Fazer consultas em lotes pequenos por produto, compartilhadas entre seus assinantes. A API Shopee aceita `productOfferV2(itemId, shopId)`; esses argumentos foram confirmados na conta do projeto em 09/10/2026. Validar identidade retornada, preço, estoque/tempo e eventual faixa de variantes; gerar link próprio. Para lojas sem consulta direta disponível, acompanhar as ofertas identificadas pelo catálogo existente. O cadastro e a interface devem distinguir consulta direta de espera por oferta nas fontes monitoradas. Bloqueio/CAPTCHA/credenciais ausentes viram estado indisponível, não preço zero ou sucesso fictício.

O WF-011 consulta/despacha a cada cinco minutos, no máximo 20 produtos e 20 entregas por execução. Limite inicial: 20 acompanhamentos ativos por usuário. Cada usuário só acessa/remove seus próprios registros. Um bloqueio explícito do bot desativa entregas ao destinatário até nova interação no privado.

A consulta direta Shopee confirma uma oferta afiliada listada, não o estoque físico. Um alerta de preço com identidade/variação exata, preço válido, período ativo e link próprio pode ser enviado com estoque desconhecido explicitamente indicado: “Confira estoque e variação na loja”. Nunca declarar `in_stock` sem evidência; rejeitar estoque sabidamente esgotado. As ofertas do catálogo continuam respeitando os critérios existentes de aprovação e estoque.

## Comparação

Separar especificações verificadas de informações de anúncios. Mostrar nomes, características disponíveis, preços e condições de ofertas válidas do catálogo e fontes. Implementar o exemplo RX 550 vs GTX 1050 Ti com fontes primárias e data de verificação. Não inventar FPS, percentuais de desempenho, estoque, preços ou uma oferta quando não houver dados. Características dependentes do fabricante/variante ficam qualificadas. Outros produtos podem ser comparados pelos dados disponíveis; lacunas devem ser explícitas.

Quando houver ofertas verificadas, incluir botões Comprar e Acompanhar para o item exato. Sem oferta, permitir enviar um link; não criar acompanhamento genérico por nome sem escolha do produto.

## Persistência e ativação

Tabelas novas para usuários do assistente, acompanhamentos, sessões curtas de seleção e fila/histórico de alertas. Nenhum dado privado é versionado. Default público desativado; configuração com username do próprio bot e importação do WF-011. Preservar aprovações administrativas, publicações e relatórios existentes. Backups antes da migration e configuração de produção. Commit/push via GitHub MCP após verificação e revisão; sem publicações fictícias nos canais durante testes.

## Aceitação

- Usuário não administrador pode cadastrar/remover apenas seus interesses no privado.
- Clique em canal usa destinatário efêmero correto e não concede ações administrativas.
- Escolher publicação e enviar URL equivalente produzem a mesma identidade.
- URLs externas/privadas e variação errada são recusadas.
- Uma oferta igual gera no máximo uma notificação; link de outro afiliado enviado pelo usuário não é reutilizado.
- RX 550 vs GTX 1050 Ti produz RichText com fontes, sem inventar preço/FPS.
- Relatórios e aprovações existentes continuam passando nos testes.
