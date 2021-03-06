const async = require('awaitable-async')
const slack = require('../slack/bot')
const _ = require('lodash')
const CmdArgs = require('../cmdArgs')
const { RateLimit } = require('async-sema')

class Channel {
  constructor() {
    this.wait = RateLimit(1, { timeUnit: 1200 })
  }

  /**
   * Process the command
   */
  async process({ req, res, sender, user, cmd, args }) {
    if (!user.is_admin) {
      return true
    }

    const cmdArgs = new CmdArgs()
    cmdArgs.parse(args)
    const flags = cmdArgs.flags
    args = cmdArgs.args

    switch (cmd) {
      case 'create':
        res.send()
        this.createChannel(sender, args[0], flags.p, flags.f)
        break
      case 'fill':
        res.send()
        await this.fill(sender)
        break
      case 'mirror':
        if (!args.length) {
          res.send('Need to specify a channel')
          return
        }
        res.send()
        this.mirror(sender, args[0], sender.channel)
        break
      case 'prune':
        res.send('Pruning...')
        this.prune(sender, args[0])
        break
      case 'invite':
        res.send()
        this.invite(sender, args[0])
        break
      case 'empty':
        res.send()
        this.empty(sender)
        break
      case 'clean':
        res.send()
        this.cleanJoins(sender)
        break
      case 'help':
      default: {
        const help = [
          '`/channel create <-p> <-f> [channel]` - Creates an empty channel. (-p = private, -f = fill users)',
          '`/channel fill` - Fills the current channel with all users',
          '`/channel empty` - Removes everyone from the current channel',
          '`/channel remove-except [list]` - Removes everyone except listed and admins from the current channel',
          '`/channel mirror [channel]` - Fills the current channel with users from another channel',
          '`/channel invite [list]` - Invites everyone on the list to the current channel',
          '`/channel prune [list]` - Removes everyone *not* on the list from the current channel',
          '',
          '* Example of a valid user list: U78TKJHAL,U70GEE62D,U70QG8ZB5,U845M27A5'
        ]
        res.send(help.join('\n'))
      }
    }
  }

  async inviteBot(channel) {
    try {
      await slack.invite(channel, 'U8P7YECBE') // cluster bot
    } catch (e) {}
  }

  /**
   * Creates an empty channel
   */
  async createChannel(sender, channelName, priv, fill) {
    channelName = channelName.replace('#', '')

    let channel = await slack.getChannel(channelName)
    if (!channel) {
      console.log('creating', channelName)
      channel = await slack.createChannel(channelName, sender.user, priv)
      await slack.invite(channel, sender.user)
      if (fill) {
        if (priv) {
          await slack.postEphemeral(
            sender,
            `Cannot auto-fill private channels. Run \`/channel fill\` once you have added the bot to the channel.`
          )
        } else {
          slack.fillChannel(channel.id)
        }
      }
      if (!priv) {
        await slack.postEphemeral(sender, `Channel ${channelName} created`)
      }
    } else {
      console.log('channel exists', channelName)
      await slack.postEphemeral(sender, `Channel ${channelName} already exists`)
    }
  }

  /**
   * Fill the channel with the group for a user
   */
  async fill(sender) {
    const msg = await slack.fillChannel(sender.channel)
    await slack.postEphemeral(sender, msg || 'Channel filled')
  }

  /**
   * Mirror a channel
   */
  async mirror(sender, channelId, targetChannel) {
    await slack.mirrorChannel(channelId, targetChannel)
    await slack.postEphemeral(sender, 'Channel mirrored')
  }

  /**
   * Prune everyone except for these ids
   */
  async prune(sender, idsString) {
    const channel = await slack.getChannel(sender.channel)
    const users = await slack.getChannelUsers(channel)
    const ids = idsString.trim().split(',')
    await async.eachLimit(users, 10, async (user) => {
      if (user.id === sender.user || user.id === slack.botUser.botUser.user_id) {
        return
      }
      if (ids.indexOf(user.id) < 0 && !user.is_admin) {
        await slack.kick(channel, user.id)
        console.log('kicking', user.name)
      }
    })

    await slack.postEphemeral(sender, 'Channel pruned')
  }

  /**
   * Invite by bulk userids
   */
  async invite(sender, idsString) {
    const channel = await slack.getChannel(sender.channel)
    await slack.invite(channel, idsString)
  }

  /**
   * Empty the channel of all
   */
  async empty(sender) {
    const channel = await slack.getChannel(sender.channel)
    if (!channel) {
      await slack.postEphemeral(sender, 'Channel not found')
      return
    }

    const users = await slack.getAllUsers(true, true)

    await async.eachSeries(users, async (user) => {
      if (user.id === sender.user || user.id === slack.botUser.user_id) {
        return
      }
      await slack.kick(channel, user.id)
    })
    await slack.postEphemeral(sender, 'Channel emptied')
  }
}

module.exports = new Channel()
