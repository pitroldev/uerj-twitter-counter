module.exports = () => {
  const date = new Date()
  const Time = `[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]`

  return Time
}
