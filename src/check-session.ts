import dotenv from 'dotenv'
import { callTwifork } from './services/twifork-publisher'

dotenv.config()
const id = process.argv[2]
void callTwifork(id ? { operation: 'verify', id } : { operation: 'check' })
  .then((result) => {
    console.log(JSON.stringify(result))
  })
  .catch((error: Error) => {
    console.error(error.message)
    process.exitCode = 1
  })
