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
    startDate.setDate(startDate.getDate() - 1)

    const daysFromStartDate = diffDays(startDate, today)
    const daysToEndDate = diffDays(today, endDate)
    const totalDays = diffDays(startDate, endDate)
    const percentageToEnd = parseFloat(parseFloat((daysFromStartDate / totalDays) * 100).toFixed(2))

    if (process.env.NODE_ENV) console.log({ today, startDate, endDate, totalDays, daysToEndDate, daysFromStartDate, percentageToEnd })
    return { totalDays, daysToEndDate, daysFromStartDate, percentageToEnd }
  }

  makeString () {
    const { daysToEndDate, percentageToEnd } = this.getParsedDateDiff()
    const { phrase, emoji } = this.getEmoji(percentageToEnd)

    if (percentageToEnd >= 0 && percentageToEnd < 100) {
      const string =
      `Você cursou ${percentageToEnd}% de ${this.period}!\n${phrase} ${daysToEndDate} dias para o fim do período. ${emoji}`
      return string
    }

    if (percentageToEnd === 100) {
      const finishString = `🚨🚨 URGENTE 🚨🚨\n📢 Você cursou 100% de ${this.period}!\nFinalmente acabou galera! 🥺🥺🥺`
      return finishString
    }

    // RFN Extra

    // const rfnDays = -daysToEndDate + 11
    // if (daysToEndDate > 0 && rfnDays > 0) {
    //   const rnfString = `Você cursou ${percentageToEnd}% de ${this.period}! 🤪\nFaltam ${rfnDays} dias para o possível fim do período. 🤠`
    //   return rnfString
    // }
    // if (rfnDays === 0) {
    //   const rnfString = `E finalmente, após cursar ${percentageToEnd}% de ${this.period}, o período oficialmente acaba! 🎉🎉🎉`
    //   return rnfString
    // }
  }

  async postOnTwitter (status) {
    const { twitterApi } = this
    if (process.env.NODE_ENV) {
      console.log('postOnTwitter', status)
      return
    }
    return await twitterApi.post('statuses/update', { status })
  }
}

module.exports = CounterBot
