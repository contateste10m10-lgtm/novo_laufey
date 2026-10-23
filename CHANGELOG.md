# Changelog

## V0.22 — auditoria metodológica da Sample Entropy

- O núcleo agora usa os mesmos `N-m` inícios de template para `B(m)` e `A(m+1)`, conforme a convenção de Richman & Moorman (2000); auto-pares permanecem excluídos e `A` passa a ser subconjunto de `B`.
- A tabela, tooltips e CSV apresentam contagens `A/B` e um intervalo aproximado de 95% baseado na aproximação t descrita no artigo, transformado pela função `-ln(p)`. Casos de limite e intervalos sem limite superior são sinalizados explicitamente.
- Adicionado diagnóstico da amostragem temporal: tempos duplicados, recuos na ordem do arquivo, cadência mediana, CV de intervalos, lacunas maiores que 3× a mediana (heurística) e pontos excluídos por tempo/fluxo inválidos. Nenhuma observação é removida/interpolada por esse diagnóstico.
- O mapa de sensibilidade exporta também o status e os limites do intervalo aproximado para cada célula.
- Incluídos testes de contagem com a convenção `N-m`, limites do intervalo, duplicatas/lacunas temporais e benchmark IID uniforme contra a probabilidade condicional teórica.
- Documentada a distinção entre a definição do artigo, a convenção de desvio-padrão populacional utilizada pelo laboratório e a validação externa ainda pendente.


## V0.21 — exportação de dados e integração curva + métricas

- O painel “Dados carregados” inclui um botão para baixar um CSV longo de tempo, banda, fluxo e incerteza, antes do cálculo principal.
- O mapa de sensibilidade `m × r` agora apresenta botões de exportação PNG e CSV somente depois de calcular uma grade válida; uma nova análise invalida o mapa antigo.
- A galeria avançada tem um atalho de integração no topo para usar a curva carregada, integrar curva + métricas e baixar o CSV combinado.
- A integração combinada preserva tempo e fluxo em cada observação e grava métricas globais uma vez por banda, sem multiplicar artificialmente os resultados. A SampEn temporal por janela continua sendo um produto separado e exige seu próprio cálculo/dados.
- Melhorado o contraste da legenda de SampEn média por banda.
- Testes de contrato adicionados para os novos controles e fluxos de exportação.

## V0.20 — ponte de dados, seletor de sensibilidade e tela cheia

- Corrigido o seletor do mapa de sensibilidade para escolher uma banda elegível mesmo se a seleção anterior estiver vazia ou inválida. O mapa usa uma amostra sistemática de até 1.200 pontos apenas para a análise de sensibilidade.
- Adicionado o botão direto **Desenhar gráfico X × Y** para CSV genérico, respeitando a escolha manual mesmo quando outras colunas científicas também são detectadas.
- Mantida a transferência da análise principal para a galeria avançada e a exportação de CSV para curvas brutas ou métricas por banda.
- Reforçado o CSS de canvas/tela cheia para manter o gráfico dentro do próprio painel e utilizar a largura disponível.

## V0.19 — Galeria multifonte demonstrativa e mapeamento robusto

- Tornado o painel “Modos avançados” visualmente clicável e acessível por teclado.
- Adicionados dados multifonte sintéticos com um clique e opção de baixar CSV demonstrativo (9 fontes × 8 bandas × 8 janelas).
- Corrigido o fluxo da galeria para abrir as visualizações avançadas após gerar.
- Adicionado gráfico exploratório X × Y para duas colunas numéricas genéricas em CSV sem cabeçalhos científicos reconhecidos. O gráfico é identificado como exploratório e não inventa Sample Entropy.
- Melhorada a detecção das colunas de tempo, fluxo/RATE e SampEn; o mapeamento automático limpa duplicações entre os campos científicos.
- Incluída licença MIT na raiz e instruções mais seguras para preservar a estrutura no upload pelo GitHub web.
- O carregador tenta bibliotecas locais em `assets/vendor/` e usa fallback CDN com SRI se ausentes. Para ficar offline, é preciso copiar os três arquivos JS licenciados para essa pasta.

# V0.18 — Correções de auditoria V0.17

- Corrigido o estado do botão de cálculo fixo para celular depois de uma análise: `dataset.busy` agora é comparado explicitamente com a string `'true'`.
- Corrigidos `canonical`, `og:url`, `og:image`, links do repositório e de feedback para `https://contateste10m10-lgtm.github.io/novo_laufey/` e o repositório `contateste10m10-lgtm/novo_laufey`.
- O botão “Topo” é ocultado enquanto a barra fixa de cálculo está visível; área inferior e safe area evitam que a barra esconda o conteúdo.
- Mapeamento de colunas e status de validação passaram a ser recolhíveis; o primeiro fica fechado por padrão.
- Aumentados alvos de toque e textos informativos em telas pequenas; primeira coluna das tabelas fica fixa durante rolagem horizontal móvel.
- `batchBuildBins` usa `ceil(sqrt(N))` bins até ao máximo de 30.
- Perfil por banda preserva as médias com amostras pequenas, mas só desenha faixa ±1 DP quando cada banda tem ao menos quatro fontes.
- Tolerância de coincidência no painel temporal passou a ser configurável (valor inicial 0,001, diferença absoluta de SampEn); legenda e nota identificam o losango como média do grupo.
- Adicionada citação BibTeX do software e metadados `CITATION.cff`.
- Adicionado teste de fumaça Playwright em 390 px ao CI.
- Chart.js, Hammer.js e plugin de zoom agora têm integridade SRI (incluindo dependências que antes não tinham); ainda são remotos e exigem internet. Hospedagem local permanece pendente porque os pacotes não puderam ser obtidos de forma verificável neste ambiente.

# Histórico de versões

## V0.17 — Gráficos científicos multifonte
- O histograma por classe usa bordas compartilhadas, 30 intervalos e densidade normalizada por classe; linhas de média e mediana são sobrepostas com indicação numérica dos valores.
- O perfil por banda passou de barras para curvas individuais das fontes, linha de média entre fontes e faixa ±1 desvio-padrão. Primeiro resume cada fonte × banda, depois dá peso igual às fontes.
- A escala do heatmap foi trocada por uma paleta contínua inspirada em Viridis.
- Adicionado painel temporal 3 × 3 para até nove fontes e oito bandas, com escala Y comum e marcadores de coincidência. Um marcador só combina bandas da mesma fonte/janela cujo máximo menos mínimo de SampEn não excede 0,001; o diamante representa a média do grupo, não uma medição adicional.
- A dispersão SampEn × variabilidade robusta passa a colorir por fonte quando há até dez fontes e a exibir metadados de σ, r absoluto e N de pontos no hover, se mapeados.
- Adicionados campos opcionais `sigma`, `r_absoluto` e `n_pontos` no importador/exportação multifonte.
- Incluídos testes de contrato visual, responsividade e tolerância das coincidências. A CI também executa um teste de fumaça Playwright em viewport móvel de 390 px.


## V0.16 — Atualização orientada pela revisão de experiência e rigor científico
- Ajustados alvos de toque, tipografia, contraste, breakpoints de tablet/celular, tela cheia com `100dvh`/safe areas, impressão e redução de movimento.
- Cards individuais para mapear taxa/erro por banda em telas estreitas; incluídos preview rápido da série e resumo de validação antes de calcular.
- Fluxo de etapas com foco/rolagem para o painel atual e botão Calcular fixo no celular; navegação de seções e voltar ao topo.
- Clarificado o papel de `m`, `r`, `σ`, SampEn e modulação intrínseca; o rótulo da tabela usa “Modulação intrínseca (%)” para não confundir com a dimensão `m` da SampEn.
- Adicionado painel de proveniência (origem, tipo de dados, identificador do arquivo, parâmetros, algoritmo e horário), importação de sessão JSON e metadados aos exports.
- Adicionado auto-teste científico local simples e mapa de sensibilidade `m × r`, que recalcula a série selecionada sem substituir a análise principal. Esses recursos não equivalem à validação independente por EntropyHub nem a testes com dados observacionais.
- A camada de padrões semelhantes (m e m+1) e a política de gráficos adaptativos da V0.10 foram mantidas.
- Removidas as chamadas a Google Fonts; `pako` fica local no repositório. Chart.js, Hammer e plugin de zoom continuam via jsDelivr: por isso a V0.16 ainda não é totalmente offline e o browser faz requisições ao CDN.
- Corrigida a detecção de tempos repetidos para evitar matrizes temporárias grandes; o mapa de sensibilidade usa os pontos exatos da última análise e consulta as células via mapa.
- Adicionados favicon SVG e imagem de prévia social; corrigida a URL de feedback para o repositório correto.

## Limitações mantidas após esta entrega
- Equivalência completa com EntropyHub e validação com curvas Swift-BAT reais ainda precisam ser executadas antes de uso como resultado de publicação.
- Intervalos de confiança bootstrap e séries substitutas não foram ativados nesta versão: exigem escolhas metodológicas, testes de referência e explicação de dependência/cadência antes de reportar significância.
- Importação por URL continua sujeita à política CORS do servidor de origem. Não foi adicionado proxy, Worker nem Cloudflare.

## V0.15 — Experiência integrada
- Consolidadas as melhorias na base visual/científica da V0.10: gráficos adaptativos e correspondências de padrões da SampEn permanecem disponíveis.
- Organizado o fluxo em três etapas: Dados, Configuração e Resultados, com navegação guiada e estados de etapa.
- Destacada uma demonstração sintética com cálculo automático opcional, rotulada para não ser confundida com observação real.
- Adicionado resumo de validação após leitura, com linhas, colunas, bandas com pontos suficientes e avisos de qualidade.
- Incluídas explicações recolhíveis de formatos e conceitos de SampEn/modulação, um botão para restaurar os parâmetros de referência e exportação de sessão JSON sem dados brutos.
- Adicionado progresso da análise por banda, usando um Web Worker local do projeto quando disponível; nenhum backend, proxy ou Cloudflare foi adicionado.
- A leitura de tabelas ASCII e tabelas FITS cede tempo ao navegador em lotes para atualizar o progresso em arquivos grandes.
- Mantida a regra de gráficos adaptativos; séries detalhadas são construídas quando abertas e animações dos gráficos foram reduzidas.
- A importação direta por URL continua condicionada a CORS do servidor remoto.

## V0.10 — Seleção adaptativa de gráficos (patch)
- Mantida a base visual da V0.10 e a camada opcional de correspondências de Sample Entropy; nenhuma fórmula científica ou contador A/B foi alterado.
- A tela principal passou a priorizar histograma global, perfil multibanda e heatmap quando há amostra suficiente; os demais gráficos ficam recolhidos em “Exploração avançada”.
- Histogramas, dispersões, bolhas, rankings e comparações por classe agora têm limites mínimos de quantidade, variedade e número de fontes/classes. Amostras insuficientes permanecem acessíveis na tabela sem receber destaque gráfico artificial.
- Comparações de classe usam um seletor de métrica; em poucas classes ou grupos pequenos, mostram tabela em vez de barras.
- Os gráficos avançados da análise multifonte e as correlações são construídos apenas quando a seção é aberta. Dispersões e bolhas limitam os pontos desenhados em catálogos enormes, mantendo todas as linhas para tabela, exportação e estatísticas.
- O heatmap usa consulta por mapa em vez de procurar cada célula repetidamente e é omitido quando a grade ficaria excessiva. Algumas reduções de pontos são apenas visuais; os cálculos e os dados exportados mantêm a amostra completa.
- Atualizadas as notas da interface para explicar por que uma visualização foi omitida.

## V0.10 + Correspondências da SampEn
- Mantida a interface original da V0.10; mudanças posteriores de layout e navegação não foram incorporadas.
- O núcleo científico pode retornar uma amostra limitada e reproduzível de pares que realmente correspondem nas dimensões m e m+1, sem alterar os contadores completos A/B nem o resultado da Sample Entropy.
- Adicionada uma camada opcional no gráfico sobreposto das oito bandas. O usuário seleciona uma banda para destacar as correspondências; linhas tracejadas indicam pares de dimensão m e linhas contínuas indicam extensões que também correspondem em m+1.
- A camada usa amostragem limitada de pares para manter o gráfico legível e não acumular dezenas de datasets extras no Chart.js.
- O tooltip do gráfico de SampEn por energia agora exibe os contadores B e A por banda.
- Adicionados testes para validar a correspondência dos pares mostrados, o limite de amostras e a preservação dos valores A/B.

## V0.9 — Fusão científica + recursos V0.8

- Preservada a interface e a galeria multifonte da versão V0.8, incluindo aba de colagem de URL, biblioteca Swift-BAT/NASA, análise temporal, controles de zoom, histogramas, heatmaps e gráficos por classe.
- Adicionado `analysis-core.js` para centralizar Sample Entropy e índice de modulação intrínseco.
- A análise principal e a SampEn temporal passaram a usar o mesmo núcleo científico.
- Adicionado cálculo do índice de modulação intrínseco por banda, utilizando a coluna de incerteza selecionada e reportando pontos excluídos por erro ausente/inválido.
- Adicionados gráfico independente de modulação, métrica média por bandas válidas e exportação PNG específica.
- Ampliada a tabela e exportação CSV para incluir SampEn, A/B, variâncias observada/ruído/intrínseca, índice de modulação e estados de qualidade.
- Incluídos testes automáticos e GitHub Actions para testar o núcleo e verificar a ligação entre HTML e JavaScript.
- A validação automatizada cobre dados sintéticos. A equivalência completa com EntropyHub v2.0 e a validação com arquivos reais Swift-BAT continuam pendentes.

## V0.8

- Removidos os painéis e números pré-carregados; o site funciona como laboratório independente, orientado aos dados que a pessoa importa.
- Adicionados controles de zoom, redefinição de escala e download PNG em cada gráfico Chart.js; controles próprios para ampliar/reduzir as células do heatmap.
- Incluído zoom por roda/pinça e seleção por arraste quando o plugin do navegador carregar; os botões manuais continuam disponíveis como alternativa.
- Ampliado o cálculo de Sample Entropy temporal para janelas de 100, 200, 300, 500, 800 e 1000 pontos.
- Otimizada a contagem de pares por ordenação na primeira coordenada, mantendo os mesmos A/B do cálculo de referência nos testes sintéticos.
- Incluídos indicador de progresso e cancelamento entre janelas no cálculo temporal.
- Substituído o corte fixo da tabela nos primeiros 100 registros por paginação (100, 250, 500 ou todos); os gráficos e exportações continuam usando todos os registros válidos.
- Mantidas as galerias de histogramas, distribuições sobrepostas por classe, perfis por banda, rankings por fonte, heatmaps, séries temporais, dispersões, gráficos de bolhas e sobreposição de curvas brutas.

## v0.10 — Navegação avançada dos gráficos
- Adicionados controles por gráfico para abrir/fechar visualização ampliada em tela cheia.
- Adicionado arraste para mover a área visível do gráfico, com botão para ativar/desativar.
- Adicionado botão de reset para restaurar a visualização/zoom.
- A navegação também é aplicada a gráficos criados dinamicamente nas galerias e análises em lote.
- Tecla Escape fecha a visualização ampliada.
