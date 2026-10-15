# Guia de envio ao GitHub sem perder a estrutura (V0.20)

**Não selecione todos os arquivos espalhados entre subpastas no mesmo lote.** Isso faz o painel mostrar só os nomes e torna fácil achatar a estrutura. Use um upload por nível/pasta.

## 1. Preparar o projeto

1. Extraia o ZIP em uma pasta. Não faça upload do `.zip` em si.
2. Copie as três bibliotecas que você já baixou para `assets/vendor/`: `chart.umd.min.js`, `hammer.min.js` e `chartjs-plugin-zoom.min.js`. Preserve `pako.min.js`, `PAKO-LICENSE.txt` e o README da pasta.
3. Confirme que `index.html` fica no nível principal.

## 2. Enviar pelo navegador do GitHub

1. Abra a página principal do repositório. Use **Add file → Upload files**.
2. No Explorador de Arquivos, selecione **apenas os arquivos que estão diretamente na raiz**: `index.html`, `app.js`, `analysis-core.js`, `analysis-worker.js`, `styles.css`, `README.md`, `CHANGELOG.md`, `CITATION.cff`, `LICENSE` e `.nojekyll` (se presente). Faça commit.
3. Para manter subpastas, **não abra `assets` e selecione os seus arquivos**. Volte ao Explorer, arraste a pasta `assets` inteira para a área de upload no GitHub e faça commit separado. Faça o mesmo com `examples`, `tests` e `.github`, cada pasta separadamente.
4. Antes de cada commit, confira a fila de upload. Para a biblioteca de gráficos, a localização correta é `assets/vendor/chart.umd.min.js` — não apenas `chart.umd.min.js` na raiz. Se a fila não preservar o caminho, cancele esse upload e siga a alternativa manual abaixo.

## 3. Alternativa manual se o GitHub achatar pastas

Se arrastar uma pasta inteira ainda não mantiver o caminho, crie/abra o destino primeiro no GitHub, e envie o conteúdo dentro dele:

- Para `assets/vendor/`: navegue até `assets/vendor` no repositório (crie o caminho usando **Add file → Create new file** e um nome como `assets/vendor/README-LOCAL-LIBRARIES.md` se ele ainda não existir), depois use **Add file → Upload files** com os três JS e o `pako.min.js` dentro dessa pasta.
- Repita para `assets/icons/`, `examples/`, `tests/` e `.github/workflows/`, entrando no diretório correspondente antes de fazer upload.
- Não coloque `tests/*.js` nem `.github/workflows/*.yml` na raiz.

A maneira mais segura de conferir é abrir um arquivo depois do commit e conferir o caminho na trilha de navegação do GitHub.

## 4. Ativar GitHub Pages

No repositório, abra **Settings → Pages** e escolha a branch `main` e a pasta `/(root)`. O `index.html` deve estar na raiz.

## 5. Licença

O pacote contém um arquivo `LICENSE` com MIT, consistente com `CITATION.cff`. O GitHub reconhece esse arquivo e mostra a licença na página do projeto. Se quiser escolher a licença diretamente no editor, siga a [documentação oficial](https://docs.github.com/pt/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository): **Add file → Create new file → `LICENSE` → Choose a license template → MIT → Commit changes**. Revise se MIT corresponde ao que você pretende permitir antes de tornar o repositório público.

## 6. Gráficos avançados e dados de exemplo

- Abra **Modos avançados → Galeria multifonte** e clique **Carregar dados demonstrativos** (9 fontes × 8 bandas × 8 janelas). Todos são sintéticos, não observações astronômicas.
- Para seu CSV, o importador tenta detectar automaticamente as colunas conhecidas. Se só houver duas colunas numéricas com nomes desconhecidos, abra **CSV genérico — desenhar duas colunas numéricas**, selecione X e Y, e gere a galeria. Esse gráfico é exploratório; confira unidades e cabeçalhos antes de interpretá-lo.
- A galeria científica requer uma coluna real de SampEn ou, para uma curva bruta, tempo e fluxo/RATE. Não calcula SampEn de um CSV genérico automaticamente.
