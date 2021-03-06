function diffDays (first, second) {
  try {
    const aDay = 24 * 60 * 60 * 1000
    const firstDate = new Date(first)
    const secondDate = new Date(second)
    const diff = Math.round(((secondDate.getTime() - firstDate.getTime())) / aDay)

    return diff
  } catch (err) {
    return 0
  }
}

module.exports = diffDays
