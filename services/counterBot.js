const Twit = require('twit')
const diffDays = require('../utils/diffDays')

class CounterBot {
  constructor (period, startDate, endDate, twitterAuth) {
    this.period = period
    this.startDate = new Date(startDate)
    this.endDate = new Date(endDate)
    this.twitterApi = new Twit(twitterAuth)
  }

  getEmoji (percentage) {
    switch (true) {
      case percentage < 30:
        return { emoji: ':(', phrase: 'Ainda faltam' }
      case percentage < 60:
        return { emoji: ':/', phrase: 'Faltam' }
      case percentage < 90:
        return { emoji: ':)', phrase: 'Faltam apenas' }
      default:
        return { emoji: ':D', phrase: 'Só faltam' }
    }
  }

  getParsedDateDiff () {
    const today = new Date()
    const { endDate, startDate } = this
    const daysFromStartDate = diffDays(startDate, today)
    const daysToEndDate = diffDays(today, endDate)
    const totalDays = diffDays(startDate, endDate)
    const percentageToEnd = parseFloat(parseFloat((daysFromStartDate / totalDays) * 100).toFixed(2))
    return { totalDays, daysToEndDate, daysFromStartDate, percentageToEnd }
  }

  makeString () {
    const { daysToEndDate, percentageToEnd } = this.getParsedDateDiff()
    const { phrase, emoji } = this.getEmoji(percentageToEnd)

    const string =
    `Você cursou ${percentageToEnd}% de ${this.period}!\n${phrase} ${daysToEndDate} dias para o fim do período. ${emoji}`
    return string
  }

  async postOnTwitter (status) {
    const { twitterApi } = this
    return await twitterApi.post('statuses/update', { status })
  }
}

module.exports = CounterBot
