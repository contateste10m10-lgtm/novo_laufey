# BlazarLab integrado — V0.22

Este projeto integra a apresentação do BlazarLab ao laboratório multibanda enviado, preservando as funções científicas originais e os modos avançados.

## Versão compactada (ZIP)
Abra `index.html` em um servidor estático ou publique a pasta no GitHub Pages. Mantenha os caminhos `assets/`, `analysis-core.js`, `analysis-worker.js` e `app.js`; eles são usados pela aplicação. As bibliotecas Chart.js, Hammer.js, zoom e pako estão incluídas localmente em `assets/vendor/`.

## Versão de arquivo único
O arquivo `blazarlab_integrado_somente_html.html` tem CSS, JavaScript e bibliotecas embutidos, incluindo o worker de cálculo. Abra-o no navegador; algumas importações remotas continuam sujeitas a CORS.

## Recursos integrados
- Importação de curvas de luz locais e por URL compatível com CORS, leitura de tabela e FITS suportado pela aplicação original, mapeamento de colunas e dados sintéticos demonstrativos.
- SampEn por banda, contagens A/B, intervalo aproximado, modulação intrínseca com incertezas, diagnóstico temporal, curvas individuais e sobreposição multibanda.
- SampEn temporal, correspondências de padrões, mapa de sensibilidade m × r, auto-teste e exportação CSV/PNG/JSON.
- Galeria multifonte com histogramas, perfis por banda, heatmap, relações SampEn–variabilidade, gráfico de bolhas, painel temporal e tabela paginada.
- Estimativas exploratórias complementares Fisher–Shannon e WPE multiescala/CI, exportadas em CSV e sessão JSON.

## Nota científica
A implementação operacional original de SampEn e modulação mantém a metodologia documentada no projeto. As rotinas novas de Fisher–Shannon e WPE são estimativas exploratórias para visualização e devem ser validadas com a especificação completa dos artigos antes de uso quantitativo em publicação. Fisher–Shannon é estimado por histograma suavizado; WPE usa dimensão 4, pesos pela variância local e coarse-graining pela média em blocos não sobrepostos.

## Testes
No diretório do projeto, execute `node --test tests/*.test.js`.
