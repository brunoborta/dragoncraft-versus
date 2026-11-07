import { startServer } from './server.js'

const port = Number(process.env.PORT ?? 8080)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

startServer({ port, allowedOrigins, log: (line) => console.log(line) }).then((server) => {
  if (allowedOrigins.length === 0) console.log('ALLOWED_ORIGINS is empty: accepting any origin')

  // rooms live in memory, so a stop or a deploy ends every game; say so where it can be seen
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      console.log(`${signal}: shutting down, ${server.rooms.size} room(s) lost`)
      server.close().then(() => process.exit(0))
    })
  }
})
