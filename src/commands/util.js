const slack = require('../slack')
const async = require('awaitable-async')

class Util {
  /**
   * Process the command
   */
  async process({ res, sender, user, cmd, args }) {
    if (!user.is_admin) {
      res.send('Must be an admin to use this command')
      return
    }

    switch (cmd) {
      case 'users':
        res.send()
        this.users(sender)
        break
      case 'addbot':
        res.send()
        this.inviteBotToAllChannels(sender)
        break
      case 'help':
      default:
        const help = [
          '`/util users` - Lists all slack users and their UserId',
          '`/util addbot` - Adds this bot to all existing channels'
        ]
        res.send(help.join('\n'))
    }
  }

  /**
   * Lists all slack users and their UserIds
   */
  async users(sender) {
    const users = await slack.getAllUsers(false, true, true)
    const bundle = users.map(u => {
      let type = ''
      if (u.is_admin) {
        type = 'admin'
      }
      if (u.is_bot) {
        type = 'bot'
      }
      return `${u.id} | ${u.real_name} | ${type}`
    })
    await slack.postEphemeral(sender, bundle.join('\n'))
  }

  /**
   * Invites this bot to all the channels
   */
  async inviteBotToAllChannels(sender) {
    const channels = await slack.getAllChannels()
    await async.each(channels, async c => {
      try {
        await slack.invite(c, process.env.SLACK_BOT_USER)
      } catch (err) {}
    })
    await slack.postEphemeral(sender, 'Bot added to all channels')
  }
}

module.exports = new Util()
