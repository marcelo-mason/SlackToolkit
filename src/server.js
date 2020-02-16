const dotenv = require('dotenv')

const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env'
dotenv.config({ path: envFile })

const bodyParser = require('body-parser')
const parser = bodyParser.urlencoded({ extended: false })

const express = require('express')
const app = express()

// load modules
const command = require('./command')
const channel = require('./commands/channel')
const util = require('./commands/util')
const slackIncoming = require('./slackIncoming')
const ndaUpload = require('./ndaUpload')

// route
app.route('/channel').post(parser, command.bind(channel))
app.route('/util').post(parser, command.bind(util))

// listen to slack events
app.use('/events', slackIncoming.events.requestListener())

// start api
const port = process.env.PORT || 3000
app.listen(port)

// errors
process.on('unhandledRejection', (reason, p) => {
  console.log(p)
})

console.log('* Running')
