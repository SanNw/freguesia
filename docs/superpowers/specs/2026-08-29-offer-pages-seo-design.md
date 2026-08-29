# Páginas de oferta e SEO

## Objetivo

Criar páginas individuais, compartilháveis e indexáveis para as promoções da Freguesia. Cada página deve aumentar a descoberta orgânica, preservar links após o encerramento da promoção e manter o rastreamento de cliques afiliados já existente.

## URL e renderização

- A URL pública será `/oferta/:slug`.
- A página será renderizada por uma Cloudflare Pages Function usando o D1 existente.
- O HTML inicial conterá todo o conteúdo essencial e os metadados; a página não dependerá de JavaScript para ser compreendida por buscadores ou serviços de compartilhamento.
- A página inicial continuará estática e seus cards passarão a apontar para a página individual.

## Conteúdo da página

Cada oferta ativa exibirá:

- galeria com todas as imagens válidas disponíveis;
- título, loja e categoria;
- preço atual, preço anterior e desconto quando existirem;
- data da última verificação;
- aviso sobre variação de preço e comissão afiliada;
- botão rastreado `Comprar com desconto`;
- compartilhamento para WhatsApp e Threads;
- ofertas relacionadas ativas da mesma categoria.

O botão de compra continuará chamando `POST /api/clicks`. A origem será `offer_page` e parâmetros `utm_source` e `utm_campaign` recebidos na URL serão preservados no registro.

## Ofertas expiradas

- A URL continuará respondendo após a oferta expirar ou ser desativada.
- A página mostrará claramente que a promoção terminou.
- O botão de compra será removido.
- Ofertas relacionadas ativas serão exibidas como próxima ação.
- Ofertas inexistentes retornarão uma página 404 com status HTTP 404.

Para isso, o repositório terá uma consulta pública por `slug` capaz de recuperar também registros inativos ou expirados, sem expor o link afiliado de uma promoção encerrada.

## SEO e compartilhamento

Cada página terá:

- título e descrição específicos;
- URL canonical absoluta;
- Open Graph com título, descrição, imagem e URL;
- Twitter Card compatível com compartilhamentos;
- JSON-LD usando `Product` e `Offer` quando a promoção estiver ativa;
- `noindex` apenas para páginas inválidas, nunca para ofertas expiradas existentes.

O site terá um `sitemap.xml` dinâmico contendo a página inicial e todas as ofertas conhecidas. A data `lastmod` virá da última atualização da oferta.

## Imagens e interação

- A primeira imagem será carregada com prioridade; as demais usarão carregamento tardio.
- Imagens quebradas serão substituídas pelo símbolo da Freguesia.
- A galeria funcionará por toque, teclado e mouse.
- O zoom-out existente será preservado.
- O layout seguirá os tokens e breakpoints atuais da marca.
- Animações respeitarão `prefers-reduced-motion`.

## Fluxo de dados

1. O visitante abre `/oferta/:slug`.
2. A Pages Function consulta a oferta no D1 pelo `slug`.
3. A função determina se a oferta está ativa ou encerrada.
4. A função consulta até seis ofertas relacionadas ativas da mesma categoria.
5. O servidor monta o HTML e os metadados.
6. Em uma compra, o navegador registra o clique na API e segue para o link afiliado retornado.

## Falhas e segurança

- Falha temporária no D1 retornará uma página controlada com status 503.
- Link afiliado nunca será incluído diretamente no HTML; continuará protegido atrás de `/api/clicks`.
- Títulos, lojas, URLs e textos vindos do banco serão escapados antes de entrar no HTML.
- URLs de imagem serão aceitas apenas quando usarem HTTPS.
- Falha no registro da métrica não impedirá o redirecionamento, preservando o comportamento atual.

## Testes

- renderização de oferta ativa;
- renderização de oferta expirada sem ação de compra;
- resposta 404 para `slug` inexistente;
- resposta 503 para falha do repositório;
- escape de conteúdo vindo do banco;
- metadados canonical, Open Graph e JSON-LD;
- sitemap com ofertas conhecidas;
- rastreamento com origem e campanha;
- galeria acessível e fallback de imagem;
- build, typecheck e testes existentes sem regressões.

## Fora do escopo

- histórico de preços;
- alertas personalizados por produto;
- comentários ou avaliações;
- login de usuários;
- painel administrativo;
- armazenamento ou proxy próprio de imagens.

Esses itens só serão considerados após haver dados de audiência e conversão que justifiquem a complexidade.
