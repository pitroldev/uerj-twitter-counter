const CounterBot = require('./services/counterBot')
const nodeSchedule = require('node-schedule')
const config = require('./config.json')
const getTime = require('./utils/getTime')

function scheduleInterval (hours, callback) {
  const rule = new nodeSchedule.RecurrenceRule()
  rule.hour = hours
  rule.minute = 0
  rule.second = 0
  nodeSchedule.scheduleJob(rule, callback)
}

async function post () {
  try {
    const { period, startDate, endDate, twitterConfig } = config
    const UERJCounter = new CounterBot(period, startDate, endDate, twitterConfig)
    const string = UERJCounter.makeString()
    if (string) {
      await UERJCounter.postOnTwitter(string)
      console.log(getTime(), 'Postado com sucesso!')
    } else {
      console.log(getTime(), 'Nada para postar no momento...')
    }
  } catch (err) {
    console.log(getTime(), 'Erro ao postar!')
    console.log(err)
  }
}

function init () {
  if (process.env.NODE_ENV) {
    return post()
  }

  const { postHour } = config
  scheduleInterval(postHour, post)

  console.log(getTime(), 'Inicializado com sucesso!')
}

init()
