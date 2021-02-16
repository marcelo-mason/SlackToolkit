const slack = require('../slack/bot.old')
const _ = require('lodash')
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
      case 'channels':
        res.send()
        this.channels(sender)
        break
      case 'addbot':
        res.send()
        this.inviteBotToAllChannels(sender)
        break
      case 'help':
      default:
        const help = [
          '`/util users` - Lists all slack users and their UserId',
          '`/util channels` - Lists all slack channels and their ChannelId',
          '`/util addbot` - Adds this bot to all existing channels'
        ]
        res.send(help.join('\n'))
    }
  }

  /**
   * Lists all slack users and their UserIds
   */
  async users(sender) {
    let users = await slack.getAllUsers(false, true, true)
    users = _.orderBy(users, ['real_name'], ['asc'])
    const bundle = users.map((u) => {
      let type = ''
      if (u.is_admin) {
        type = 'admin'
      }
      if (u.is_bot) {
        type = 'bot'
      }
      return `${u.real_name} | ${u.id} | ${type}`
    })
    bundle.unshift(`Name | UserId | Type`)
    await slack.postEphemeral(sender, bundle.join('\n'))
  }

  /**
   * Lists all slack channels and their ChannelIds
   */
  async channels(sender) {
    let channels = await slack.getAllChannels()
    channels = _.orderBy(channels, ['name'], ['asc'])
    const bundle = channels.map((c) => {
      if (c.is_archived || c.is_im || c.is_mpim) {
        return
      }
      let type = 'public'
      if (c.is_private || c.is_group) {
        type = 'private'
      }
      if (c.is_general) {
        type = 'general'
      }
      return `${c.name} | ${c.id} | ${type} | ${c.num_members || 0}`
    })
    bundle.unshift(`Name | ChannelId | Type | Members`)
    await slack.postEphemeral(sender, bundle.join('\n'))
  }

  /**
   * Invites this bot to all the channels
   */
  async inviteBotToAllChannels(sender) {
    const channels = await slack.getAllChannels()
    await async.each(channels, async (c) => {
      try {
        await slack.invite(c, process.env.ST_SLACK_BOT_USER)
      } catch (err) {}
    })
    await slack.postEphemeral(sender, 'Bot added to all channels')
  }
}

module.exports = new Util()
