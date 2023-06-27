export const PHRASES = [
  {
    isInRange: (percentage: number) => percentage < 30,
    text:
      'Você cursou {{percentage}}% de {{period}}!' +
      '\n' +
      'Ainda faltam {{days}} dias para o fim do período. :('
  },
  {
    isInRange: (percentage: number) => percentage >= 30 && percentage < 60,
    text:
      'Você cursou {{percentage}}% de {{period}}!' +
      '\n' +
      'Faltam {{days}} dias para o fim do período. :/'
  },
  {
    isInRange: (percentage: number) => percentage >= 60 && percentage < 90,
    text:
      'Você cursou {{percentage}}% de {{period}}!' +
      '\n' +
      'Faltam apenas {{days}} dias para o fim do período. :)'
  },
  {
    isInRange: (percentage: number) => percentage >= 90 && percentage < 100,
    text:
      'Você cursou {{percentage}}% de {{period}}!' +
      '\n' +
      'Só faltam apenas {{days}} dias para o fim do período. :D'
  },
  {
    isInRange: (percentage: number) => percentage >= 100,
    text:
      '🚨🚨 URGENTE 🚨🚨' +
      '\n' +
      '📢 Você cursou 100% de {{period}}!' +
      '\n' +
      'Finalmente acabou pessoal! 🥺🥺🥺'
  }
]
