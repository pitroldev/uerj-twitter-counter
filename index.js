const CounterBot = require('./services/counterBot')
const nodeSchedule = require('node-schedule')
const config = require('./config.json')
const getTime = require('./utils/getTime')

function scheduleInterval (hours, callback) {
  const now = new Date()
  now.setDate(now.getDate() + 1)

  nodeSchedule.scheduleJob(`${now.getMinutes()} ${hours} ${now.getDate()} ${now.getMonth() + 1} *`, callback)
}

async function post () {
  try {
    const { period, startDate, endDate, twitterConfig, postHour } = config
    const UERJCounter = new CounterBot(period, startDate, endDate, twitterConfig)
    const string = UERJCounter.makeString()
    await UERJCounter.postOnTwitter(string)
    console.log(getTime(), 'Postado com sucesso!')
    scheduleInterval(postHour, post)
  } catch (err) {
    console.log(getTime(), 'Erro ao postar!')
    console.log(err)
  }
}

function init () {
  const { postHour } = config
  const today = new Date()
  const actualHours = today.getHours()

  if (actualHours <= postHour) {
    nodeSchedule.scheduleJob(`${today.getMinutes()} ${postHour} ${today.getDate()} ${today.getMonth() + 1} *`, post)
  } else {
    scheduleInterval(postHour, post)
  }

  console.log(getTime(), 'Inicializado com sucesso!')
}

init()
