const slack = require('./slack')
const { createEventAdapter } = require('@slack/events-api')
const { createMessageAdapter } = require('@slack/interactive-messages');

class SlackIncoming {
  constructor() {
    this.slackEvents = createEventAdapter(process.env.SLACK_APP_SIGNING_SECRET)
    this.eventsListen()
    /*
        const interactionsMsgAdapter = createMessageAdapter(process.env.SLACK_APP_SIGNING_SECRET);
        (async () => {
          this.slackInteractions = await interactionsMsgAdapter.start(port);
        })()
    */
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
    this.slackEvents.on('channel_created', e => {
      slack.invite(e.channel, process.env.SLACK_BOT_USER)
      console.log('channel_created', e.channel.name)
    })
  }
}

module.exports = new SlackIncoming()
