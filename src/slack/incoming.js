const slack = require('./bot')
const { createEventAdapter } = require('@slack/events-api')
const { createMessageAdapter } = require('@slack/interactive-messages')

class SlackIncoming {
  constructor() {
    this.slackEvents = createEventAdapter(process.env.ST_SLACK_APP_SIGNING_SECRET)
    this.slackInteract = createMessageAdapter(process.env.ST_SLACK_APP_SIGNING_SECRET)
    this.eventsListen()
  }

  get events() {
    return this.slackEvents
  }

  get interactions() {
    return this.slackInteractions
  }

  /**
   * Set up event listeners
   */
  eventsListen() {
    // invite bot on channel create
    this.slackEvents.on('channel_created', async (e) => {
      if (!e.channel.is_private) {
        // invite bot
        if (!this.botUserId) {
          this.botUserId = await slack.getBotUserId()
        }
        slack.invite(e.channel.id, this.botUserId)
        slack.join(e.channel.id)
      }
      console.log('channel_created', e.channel.name)
    })
  }
}

module.exports = new SlackIncoming()
