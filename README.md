# Painel de usabilidade · Curitiba: Mapas e Memórias

Painel estático (HTML, CSS e JavaScript puro, sem dependências nem etapa de build) com as métricas de usabilidade do Story Map «Curitiba: Mapas e Memórias», comparando desktop e smartphone. É parte da pesquisa *Avaliação da Experiência do Usuário de Story Maps em Múltiplas Plataformas* (PPGCG/UFPR).

**Seções do painel**
- Visão geral (indicadores-chave por dispositivo).
- Eficácia: conclusão, interação esperada e conclusão conforme o uso do controle.
- Eficiência: tempo de conclusão, com as bases separadas.
- Interações registradas na telemetria, mais a cobertura do PostHog e os recarregamentos da página.
- Fricções: padrões, tarefas e impacto.
- Satisfação: avaliação global e temas.
- Carga de trabalho (NASA-TLX).
- Perfil dos participantes × métricas: composição da amostra e cada métrica por característica (faixa etária, escolaridade, área de formação, uso de mapas digitais, experiência com story maps, tela e navegador).
- Tabela por sessão.

Os filtros de **dispositivo** (ambos, desktop, smartphone) e **amostra** (elegíveis ou todas) valem para o painel inteiro. Na seção de perfil, dá para escolher a característica e a métrica. Todas as escolhas ficam na URL, então dá para compartilhar um recorte, por exemplo `?disp=smartphone&carac=freq&metrica=conclusao`.

## Estrutura

```
index.html            página
assets/style.css      estilos e cores do GeoTy (tema claro, impressão, alto contraste)
assets/charts.js      gráficos em SVG (barras, divergente, pontos, mapa de calor, intervalo)
assets/app.js         filtros, agregações e montagem das seções
data/dados.js         dados agregados por sessão e tarefa (gerado)
scripts/gerar_dados.py  regenera data/dados.js a partir dos arquivos da pesquisa
```

## Publicar no GitHub Pages

1. Crie um repositório e envie o conteúdo desta pasta para a raiz da branch `main`. Pode ser pelo botão *Add file → Upload files* ou com:
   ```bash
   git init && git add . && git commit -m "Painel de usabilidade"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```
2. No repositório, abra **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`, e salve.
3. Em um ou dois minutos o painel fica em `https://<usuario>.github.io/<repositorio>/`.

O arquivo `.nojekyll` faz o GitHub servir os arquivos como estão.

## Ver localmente

Basta abrir `index.html` no navegador. Os dados são carregados como script, então funciona sem servidor. Se preferir um servidor local:

```bash
python -m http.server 8000   # depois abra http://localhost:8000
```

## Atualizar os dados

O script precisa de Python 3 com `pandas` e `openpyxl`.

```bash
python scripts/gerar_dados.py \
  --quant caminho/dados_quantitativos \
  --friccoes caminho/Consolidado_friccoes.xlsx \
  --satisfacao caminho/Satisfacao_Story_Map.xlsx \
  --caracterizacao caminho/caracterizacao.xlsx \
  --posthog caminho/sessoes_posthog.xlsx \
  --telemetria caminho/telemetria \
  --saida data/dados.js
```

Opções:
- `--com-diretrizes` inclui as diretrizes de design no arquivo de dados. Por padrão elas ficam fora, e o painel não tem seção para elas por enquanto.
- `--sem-caracterizacao` não grava o perfil dos participantes; nesse caso a seção de perfil some.

| Entrada | O que o script lê |
|---|---|
| `dados_quantitativos/` | `inventario_sessoes.csv`, `resultados_individuais.csv`, `nasa_sessao.csv` e `cobertura.csv` |
| `Consolidado_friccoes.xlsx` | abas *Episódios consolidados* e *Diretrizes* |
| `Satisfacao_Story_Map.xlsx` | abas *Sessões e cobertura* e *Evidências* |
| `caracterizacao.xlsx` | abas *DESKTOP* e *MOBILE* (questionário de caracterização) |
| `sessoes_posthog.xlsx` | exportação do PostHog, uma aba por sessão |
| `telemetria/` | `acoes_normalizadas.csv` (para marcar os eventos do PostHog já usados) e `janelas_das_tarefas.csv` (para situar as recargas nas tarefas) |

Depois, faça commit do `data/dados.js` novo.

## Definições usadas

- **Amostra elegível.** São 51 sessões: 24 desktop e 27 smartphone. Testes inválidos ou com falha técnica saem inteiros. «Todas» inclui as 9 excluídas e serve só para conferência.
- **Eficácia.** É o resultado «completo» sobre todas as tarefas do recorte.
- **Interação esperada.** É o uso do controle previsto em cada tarefa:

  | Tarefa | Controle esperado |
  |---|---|
  | T1 | botões de zoom |
  | T2 | abrir a imagem |
  | T3 e T5 | Ver mapa |
  | T4 | camadas |
  | T6 | áudio e retorno ao início |

  O denominador são as tarefas em que a interação era observável.
- **Tempo de conclusão.**
  - Só entram tarefas concluídas com precisão em segundos ou aproximada.
  - Tempo com precisão baixa, tarefas só com limites e tempo até encerramento aparecem contados à parte. Nenhum deles é tempo de conclusão.
  - As medidas principais são a mediana e os quartis.
- **Fricções.** São episódios consolidados com evidência compatível e contados como ocorrência. Uma sessão conta uma vez por padrão.
- **Satisfação.** Cada sessão foi classificada pelo relato da entrevista pós-uso. Não há escore padronizado. O SUS não está entre os arquivos usados.
- **NASA-TLX.** As dimensões são brutas (escala 1–20) e não há escore composto. A direção da dimensão *desempenho* não está documentada no pacote de dados.
- **PostHog.**
  - Entram só os eventos do aparelho da pessoa participante; a exportação traz também eventos de outros aparelhos.
  - «PostHog registrou o teste»: a sessão estava na janela do teste segundo a análise de telemetria, ou tem eventos entre o início da T1 e o fim da T6.
  - **Recarregamento** é uma nova carga da página (`$pageview`) entre o início da T1 e o fim da T6. Só é contado quando o relógio do PostHog está alinhado ao das tarefas.
  - Janela de cada tarefa: primeiro horário da apresentação menos a tolerância até o último horário do encerramento mais a tolerância (`janelas_das_tarefas.csv`).
  - Navegador, sistema operacional e largura da janela «(PostHog)» são os valores registrados, não os informados no questionário.
- **Caracterização (categorias agrupadas).**

  | Característica | Categorias |
  |---|---|
  | Faixa etária | 18–24, 25–34, 35 ou mais («24 - 34 anos» no questionário foi lido como 25–34) |
  | Escolaridade | até a graduação; pós-graduação (especialização, mestrado, doutorado) |
  | Área de formação | cartografia, agrimensura e geografia (inclui ciências geodésicas e mestrado em ciências cartográficas); outras áreas |
  | Uso de mapas digitais | muito frequentemente; frequentemente ou menos |
  | Experiência com story maps | nunca; 1 ou 2 vezes; algumas ou muitas vezes |
  | Tela | desktop: até 14", 15" a 16", 17" ou mais; smartphone: até 6,5", acima de 6,5" |
  | Navegador (informado) | Chrome, Safari, outros |
  | Navegador (PostHog) | Chrome (inclui Chrome no iOS), Safari, outros, sem PostHog |
  | Sistema operacional (PostHog) | Windows, macOS, Android, iOS, Linux, sem PostHog |
  | Largura da janela (PostHog) | desktop: até 1366 px, 1367–1919 px, 1920 px ou mais; smartphone: até 384 px, 390–402 px, acima de 402 px |

  Os cruzamentos são descritivos: os grupos são pequenos e não há teste estatístico.
- **Dados provisórios.** Os dados quantitativos estão marcados como provisórios na origem. Todas as comparações são descritivas, entre grupos independentes.

## Privacidade

`data/dados.js` contém apenas códigos de sessão pseudônimos, categorias e números: nenhuma transcrição ou citação. A caracterização entra só em categorias agrupadas. Área de formação literal, data e hora do teste não são gravadas, e o perfil não aparece na tabela de sessões.

Mesmo agrupado, o perfil fica no arquivo de dados junto com o código da sessão. Em um repositório público, qualquer pessoa pode ler esse arquivo. Se o termo de consentimento não cobrir essa divulgação, gere os dados com `--sem-caracterizacao` ou use um repositório privado. O GitHub Pages em repositório privado depende do plano da conta.

## Identidade visual (GeoTy)

As cores da marca são `#efebd6` (fundo), `#DC4D01`, `#3D5368`, `#708444`, `#BD9825` e `#AAADAD`. Elas estão definidas como variáveis CSS no topo de `assets/style.css`.

- **Dados.** Desktop usa `#3D5368` e smartphone usa `#BD9825`, a mesma cor em todos os gráficos.
- **Faixa da marca.** O laranja (`#DC4D01`) e o oliva (`#708444`) ficam na faixa no topo da página e no destaque dos links, fora dos dados.
- **Outros elementos.** O cinza `#AAADAD` é a linha de base dos eixos. Os cartões usam um creme mais claro, derivado do fundo, e os tons de texto são passos mais escuros do ardósia e do cinza, para dar contraste de leitura.
- **Tema.** Só o tema claro.

O par ardósia/ocre foi conferido para daltonismo: ΔE de 28,7 na simulação e 31,4 na visão normal. O ocre tem contraste de 2,5:1 sobre o cartão e o ardósia tem pouca saturação, por isso todo gráfico traz legenda, rótulo de valor e tabela equivalente.

## Acessibilidade

- Cada gráfico tem uma tabela equivalente («Ver tabela»).
- As marcas respondem a mouse e teclado (Tab), e o tooltip mostra os mesmos valores.
- O par de cores dos dispositivos foi conferido para daltonismo.
- A identidade de cada série também vem de legenda e rótulos, não só da cor.
