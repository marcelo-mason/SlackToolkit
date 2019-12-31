const eventsApi = require('@slack/events-api')
const slack = require('./slack')

class SlackIncoming {
  constructor() {
    this.slackEvents = eventsApi.createEventAdapter(process.env.SLACK_APP_SIGNING_SECRET)
    this.listen()
  }

  /**
   * Process the events
   */
  get events() {
    return this.slackEvents
  }

  /**
   * Set up event listeners
   */
  listen() {
    // invite bot on channel create
    this.slackEvents.on('channel_created', e => {
      slack.invite(e.channel, process.env.SLACK_BOT_USER)
    })
  }
}

module.exports = new SlackIncoming()
