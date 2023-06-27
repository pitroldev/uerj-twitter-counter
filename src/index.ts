import dotenv from 'dotenv'
dotenv.config()

import moment from 'moment'
import nodeSchedule from 'node-schedule'

import { createTwitt } from './core/create-twit'
import twitterApi from './services/twitter-api'

const { UTC_HOUR_TO_POST } = process.env as Record<string, string>

async function post() {
  try {
    const text = createTwitt()

    console.log(moment().toLocaleString(), 'Autenticando...')
    await twitterApi.appLogin()
    console.log(moment().toLocaleString(), 'Autenticado com sucesso!')

    console.log(moment().toLocaleString(), 'Postando...')

    if (process.env.NODE_ENV) {
      console.log(moment().toLocaleString(), 'Texto:', text)
    } else {
      await twitterApi.v2.tweet('tweet', { text })
    }

    console.log(moment().toLocaleString(), 'Postado com sucesso!')
  } catch (err) {
    console.log(moment().toLocaleString(), 'Erro ao postar:', err)
  }
}

function init() {
  if (process.env.NODE_ENV) {
    post()
    return
  }

  const rule = new nodeSchedule.RecurrenceRule()
  rule.hour = parseInt(UTC_HOUR_TO_POST)
  rule.minute = 0
  rule.second = 0
  nodeSchedule.scheduleJob(rule, post)

  console.log(moment().toLocaleString(), 'Inicializado com sucesso!')
}

init()
