import { startServer } from './server.js'

const port = Number(process.env.PORT ?? 8080)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

startServer({ port, allowedOrigins, log: (line) => console.log(line) }).then(() => {
  if (allowedOrigins.length === 0) console.log('ALLOWED_ORIGINS is empty: accepting any origin')
})
