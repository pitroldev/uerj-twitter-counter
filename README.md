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
python -m venv .venv
# Linux: .venv/bin/python. Windows: .venv/Scripts/python.exe.
.venv/bin/python -m pip install -r requirements-twifork.txt
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

## Publicação com twifork

O publicador padrão é o [twifork](https://github.com/PawiX25/twifork), fixado em **2.4.0**, com Python 3.10 ou superior. Ele usa a sessão da conta para acessar a API interna do site, sem usar créditos da API oficial. As dependências Python ficam isoladas em `.venv`; as versões estão em `requirements-twifork.txt`.

No `.env`, configure `X_AUTH_TOKEN` e `X_CT0` com os cookies `auth_token` e `ct0` da sua própria sessão do X. `X_EXPECTED_USERNAME` define a conta permitida e vale `contadoruerj` por padrão. O processo confirma essa identidade antes de qualquer escrita. Não envie cookies no chat, nos logs ou no Git. Esses cookies permitem acesso à conta e precisam ser renovados quando a sessão expirar.

```sh
npm run check:session             # somente leitura: confirma a conta
npm run check:session -- ID_POST  # somente leitura: lê um post e confirma a autoria
```

`TWIFORK_PYTHON` pode apontar para um ambiente Python fora do repositório. `TWIFORK_JOURNAL_PATH` pode mudar o local do diário, cujo padrão é `var/twifork.sqlite`. Preserve esse arquivo em deploys e reinícios. O processo usa um cliente novo a cada execução, tem tempo limite e não repete automaticamente uma tentativa que já iniciou a escrita. Uma enquete cria primeiro o cartão com as alternativas e duração, depois publica o tweet com esse cartão; falha na enquete não vira um tweet sem enquete.

Depois de renovar os cookies no `.env`, reinicie o processo do contador para carregar a nova sessão. O comando `check:session` lê o arquivo novamente a cada execução.

O diário reserva uma única tentativa por conta/data, inclusive entre processos concorrentes. Uma tentativa ambígua fica `pending`: confira a conta no X antes de qualquer intervenção manual. O comando `check:session -- ID_POST` ajuda a confirmar um post conhecido; ele não altera o diário. Um ID válido retornado pela publicação registra `published`. Falhas de autenticação antes da escrita não reservam o dia.

`X_PUBLISHER=official` seleciona explicitamente o SDK oficial e suas quatro credenciais antigas. **Não existe troca automática para a API paga** quando o twifork falha. O diário de tentativas é específico do publicador twifork. Não execute publicadores diferentes para a mesma data. Prévia e inicialização do agendador não publicam nem verificam a sessão.

O twifork não é uma API oficial: alterações do X, sessão vencida e bloqueios da conta podem interromper a publicação. Os testes automatizados verificam os contratos e falhas localmente; a validação real deve confirmar o post e sua enquete na conta.

## Alertas pelo Homelab

Em produção, o processo atualiza `var/health.json` a cada minuto e registra início, sucesso, erro sanitizado ou encerramento do calendário. O caminho pode ser alterado por `PUBLICATION_HEALTH_PATH`. Preserve esse arquivo e `var/twifork.sqlite` nos deploys; reiniciar não apaga a última execução. Prévia e testes usam caminhos isolados e não alimentam o monitor de produção.

O serviço `contador-monitor` no Homelab consulta esse estado por SSH a cada minuto, independentemente do processo e do servidor do contador. Uma chave exclusiva aceita somente a leitura do arquivo, sem shell livre, PTY ou encaminhamento de portas. Cookies do X permanecem no servidor do contador; o token do Home Assistant permanece no Homelab.

O monitor avisa no painel do Home Assistant e no **2º Echo Dot de Petro** em caso de erro, post sem confirmação dez minutos após o horário, três consultas consecutivas sem resposta, cinco minutos sem heartbeat ou calendário encerrado. O padrão continua 19h, com alerta por ausência a partir de 19h10, em São Paulo. A instalação não acusa como perdido um post anterior à ativação do monitor.

Alertas são deduplicados por incidente e persistem após reiniciar o monitor. A voz respeita Não perturbe e o horário configurado no HA, atualmente 07h–22h; se o Echo estiver offline, somente um problema ainda ativo será anunciado quando ele voltar. O monitor não tenta publicar nem chama o X. Sucesso significa ID confirmado pelo publicador; remoção posterior do tweet não é detectada.

Painel na LAN: [Contador UERJ](http://homelab.local:8123/contador-uerj/status). Código e operação ficam no repositório Homelab, em `termux/apps/contador-monitor/` e `docs/home-assistant-contador-uerj.md`. Se o Homelab ou o Home Assistant estiverem desligados, não há entrega de alertas durante essa indisponibilidade.

## Estrutura

- `src/core`: calendário e escolha determinística de conteúdo, sem chamadas de rede.
- `src/config`: calendário oficial, opções e textos.
- `src/application`: execução de prévia/publicação usando a porta `PostPublisher`.
- `src/services`: publicadores twifork e SDK oficial, selecionados explicitamente.
- `scripts/twifork_bridge.py`: integração Python e diário persistente de tentativas.
- `src/preview.ts`: geração de prévias em Markdown, JSON e atualização do HTML.
- `tests`: calendário completo, alternância, limites, fuso, enquetes e isolamento da prévia.
