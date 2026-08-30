# Publicação automática com roteamento seguro

## Objetivo

Publicar automaticamente as ofertas agendadas cuja classificação de canal seja segura. Ofertas ambíguas devem sair da fila automática e receber uma decisão humana explícita de canal no chat de aprovação.

## Fluxo

1. O consumidor limpa ofertas vencidas e busca a próxima oferta agendada.
2. O classificador retorna nicho, confiança, evidência e permissão para automação.
3. Classificação segura publica diretamente no canal correspondente.
4. Classificação incerta muda para aprovação e envia uma mensagem com seleção de canal.
5. O administrador escolhe um canal ou descarta a oferta.
6. A escolha é persistida na oferta, que volta para `scheduled` e é publicada no canal selecionado.

O consumidor processa uma oferta a cada 30 segundos. Falhas transitórias permanecem elegíveis para nova tentativa. Falhas permanentes recebem `failed`; ofertas vencidas recebem `expired`.

## Persistência

Adicionar à tabela `offers`:

- `publication_niche`: nicho escolhido automaticamente ou pelo administrador.
- `publication_niche_source`: `classifier` ou `manual`.

O valor manual sempre prevalece sobre uma nova classificação. A migração deve ser compatível com bancos existentes e usar colunas anuláveis.

## Classificação

Publicação automática exige `automatic: true`. Isso inclui categorias oficiais reconhecidas e regras explicitamente seguras. Resultados com confiança média ou baixa não são publicados automaticamente.

Conflitos entre título e categoria não escolhem silenciosamente um canal especializado. A oferta é encaminhada para aprovação.

## Aprovação no Telegram

A mensagem deve exibir o canal sugerido, confiança e evidência. O teclado terá opções para:

- Hardware
- Eletrônicos
- Eletrodomésticos
- Casa e Cozinha
- Beleza
- Moda e Acessórios
- Ofertas Gerais
- Descartar

O callback precisa ser idempotente. Uma segunda escolha para uma oferta já processada deve responder que ela já foi processada, sem alterar a publicação.

## Publicação

`publishOffer` deve usar `publication_niche` quando definido. Sem escolha persistida, usa o resultado seguro do classificador. Uma oferta incerta sem escolha manual não pode chegar ao gateway de publicação.

O intervalo entre execuções será de 30 segundos. Os limites diário e horário existentes continuam válidos; quando atingidos, a oferta permanece agendada para tentativa posterior.

## Compatibilidade

Os botões atuais de aprovar, editar, revalidar e descartar continuam funcionando para aprovações normais. A seleção de canal é adicionada apenas quando a classificação não permite automação.

Ofertas já agendadas serão reavaliadas: as seguras publicam; as incertas retornam para aprovação de canal.

## Testes

- Oferta segura é publicada sem aprovação.
- Oferta incerta não chama o gateway e vai para aprovação.
- Cada botão persiste o nicho correto e reagenda a oferta.
- Escolha manual prevalece sobre o classificador.
- Callback repetido não altera oferta processada.
- Oferta inválida recebe `failed` e não bloqueia a fila.
- Oferta vencida recebe `expired`.
- Falha transitória permanece agendada.
- Migração funciona em banco existente.
