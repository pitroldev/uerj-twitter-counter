# Contador UERJ

Contagem diária com personalidade, marcos, easter eggs, interações com a turma e férias do bot.

## Como a contagem funciona

- Uma publicação por dia no horário de `UTC_HOUR_TO_POST` (22 UTC = 19h em Brasília). A data usada na contagem é a de São Paulo.
- Porcentagem e dias restantes acompanham o fim do semestre, incluindo provas finais. A contagem de dias inclui o dia atual, como na versão anterior.
- Frases curtas variam conforme o período avança. O conteúdo é escrito no projeto; não há geração por API de IA.
- Marcos: início, metade, 75%, 90%, dez dias, última segunda-feira, três dias e encerramento.
- Easter eggs: primeiro dia em que a contagem cruza 42%, 66,6% e 69%; sete dias; sexta-feira 13; aniversário da UERJ; véspera do próximo semestre.
- Às sextas elegíveis, a turma recebe uma **pergunta aberta**, depois uma **enquete de 24h**, e assim por diante. Marcos, datas especiais e férias não consomem uma vez. As perguntas e alternativas também variam.
- A sequência é calculada a partir do calendário e de `COMMUNITY_START_DATE`, preservando a alternância prevista após reiniciar o processo e trocar de semestre. Uma publicação que falhar não é reenviada automaticamente; não há reposição de dias perdidos.
- Entre semestres, o texto conta os dias até o próximo início. No recesso de 2026.2, a porcentagem congela por padrão; os dias corridos até o fim continuam diminuindo. Essa pausa não transforma a métrica em contagem de dias letivos.
- No último dia, publica 100%. Depois do último período cadastrado, aguarda a atualização do calendário e não repete o post de encerramento.

A prioridade diária é: início/fim do semestre, recesso/retorno, datas especiais, percentuais especiais, marcos de dias, interação semanal e personalidade cotidiana. O calendário completo está em [src/config/calendar.ts](src/config/calendar.ts), baseado no [calendário oficial adequado de 2026](https://www.uerj.br/wp-content/uploads/2026/07/CA-2026_mes-a-mes-ADEQUA%C3%87AO-1.pdf).

## Conferir antes de publicar

```sh
yarn install --frozen-lockfile
npm run check
npm run preview -- --from 2026-10-21 --to 2026-12-25
npm run preview -- --from 2026-10-21 --to 2026-12-25 --out docs/previa-contador.md
npm run preview -- --update-lab
```

`preview` nunca carrega o cliente do X nem envia posts. O HTML em [design/contador-lab.html](design/contador-lab.html) continua independente de servidor e usa o calendário gerado pelo contador na aba **A turma**. Use **Próxima interação** para conferir a alternância. As demais abas são o estudo de possibilidades original.

Exemplos já gerados em [docs/previa-contador.md](docs/previa-contador.md).

## Configuração

Use `example.env` como referência e mantenha os segredos somente em `.env`.

| Variável                                   | Uso                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `NAME_OF_PERIOD`, `START_DATE`, `END_DATE` | Ajustam o período correspondente sem apagar os próximos períodos cadastrados. As três devem ser informadas juntas. |
| `FREEZE_DURING_BREAK`                      | `true` por padrão; `false` mantém o percentual em dias corridos durante o recesso.                                 |
| `COMMUNITY_START_DATE`                     | Início da sequência de interações; padrão `2026-10-21`.                                                            |
| `COMMUNITY_WEEKDAY`                        | Dia da interação, de 0 (domingo) a 6; padrão 5 (sexta).                                                            |
| `UTC_HOUR_TO_POST`                         | Hora UTC da publicação; padrão 22.                                                                                 |
| `DRY_RUN`                                  | `true` imprime a prévia do dia e encerra sem acessar o X.                                                          |

`NODE_ENV=development` e `NODE_ENV=test` também executam somente a prévia. `NODE_ENV=production` mantém o agendamento ativo. `npm start` inicia o agendamento de publicação após `npm run build`; não faz uma publicação imediata ao iniciar.

O adaptador utiliza as credenciais de usuário existentes e envia `poll.options` e `poll.duration_minutes` quando houver enquete, conforme a [documentação oficial de criação de posts](https://docs.x.com/x-api/posts/manage-tweets/introduction). Uma falha de permissão da API é reportada como erro; não é tratada como sucesso nem convertida silenciosamente em outro post. A publicação real das novas enquetes ainda precisa ser validada com o acesso da conta ao X.

## Estrutura

- `src/core`: calendário e escolha determinística de conteúdo, sem chamadas de rede.
- `src/config`: calendário oficial, opções e textos.
- `src/application`: execução de prévia/publicação usando a porta `PostPublisher`.
- `src/services`: tradução do post e envio pelo SDK do X.
- `src/preview.ts`: geração de prévias em Markdown, JSON e atualização do HTML.
- `tests`: calendário completo, alternância, limites, fuso, enquetes e isolamento da prévia.
