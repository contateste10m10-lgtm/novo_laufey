# Histórico de versões

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
