const async = require('awaitable-async')
const _ = require('lodash')
const slack = require('../slack/bot.old')
const cmdArgs = require('../cmdArgs')

class Channel {
  /**
   * Process the command
   */
  async process({ req, res, sender, user, cmd, args }) {
    if (!user.is_admin) {
      return res.send('Sorry, you do not have access to this command.')
    }

    cmdArgs.parse(args)
    const flags = cmdArgs.flags
    args = cmdArgs.args

    switch (cmd) {
      case 'create':
        res.send()
        await this.createChannel(sender, args[0], flags.p, flags.f)
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
        await this.mirror(sender, sender.channel, args[0])
        break
      case 'prune':
        res.send('Pruning...')
        await this.prune(sender, args[0])
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
      default:
        const help = [
          '`/channel create <-p> <-f> [channel]` - Creates an empty channel. (-p = private, -f = fill users)',
          '`/channel fill` - Fills the current channel with all users',
          '`/channel invite [list]` - Invites everyone on the list to the current channel',
          '`/channel empty` - Removes everyone from the current channel',
          '`/channel mirror [channel]` - Fills the current channel with users from another channel',
          '`/channel prune [list]` - Removes everyone *not* on the list from the current channel',
          '',
          '* Example of a valid user list: U78TKJHAL,U70GEE62D,U70QG8ZB5,U845M27A5'
        ]
        res.send(help.join('\n'))
    }
  }

  async inviteBot(channel) {
    try {
      await slack.invite(channel, process.env.ST_SLACK_BOT_USER) // slack toolkit bot
    } catch (e) {}
  }

  /**
   * Creates an empty channel
   */
  async createChannel(sender, channelName, priv, fill) {
    let channel = await slack.getChannel(channelName)
    if (!channel) {
      channel = await slack.createChannel(channelName, sender.user, priv)
      if (fill) {
        if (priv) {
          await slack.postEphemeral(
            sender,
            `Cannot auto-fill private channels. Run \`/channel fill\` once you have added the bot to the channel.`
          )
        } else {
          const users = (await slack.getAllUsers()).map((u) => u.id)
          const alreadyIn = (await slack.getChannelUsers(channel)).map((u) => u.id)
          _.remove(users, (x) => {
            return _.indexOf(alreadyIn, x) !== -1
          })
          await slack.invite(channel, users)
        }
      }
      if (priv) {
        const botUser = await slack.getBotUserId()
        await slack.postEphemeral(
          sender,
          `Private Channel ${channelName} created.\nCannot auto-add the bot to private channels. Type \`/invite @${botUser.real_name}\` inside the channel if you want access to the bot.`
        )
      } else {
        await slack.postEphemeral(sender, `Channel ${channelName} created`)
      }
    }
  }

  /**
   * Fill the channel with the group
   */
  async fill(sender) {
    const channel = await slack.getChannel(sender.channel)
    const users = (await slack.getAllUsers()).map((u) => u.id)
    const alreadyIn = (await slack.getChannelUsers(channel)).map((u) => u.id)
    _.remove(users, (x) => {
      return _.indexOf(alreadyIn, x) !== -1
    })
    await slack.invite(channel, users)
  }

  /**
   * Fill the channel with the members from named channel
   */
  async mirror(sender, targetChannel, channelName) {
    let channel = await slack.getChannel(channelName)
    if (!channel) {
      return 'Channel not found'
    }

    const users = await slack.getChannelUsers(channel).map((u) => u.id)
    const alreadyIn = (await slack.getChannelUsers(channel)).map((u) => u.id)
    _.remove(users, (x) => {
      return _.indexOf(alreadyIn, x) !== -1
    })
    await slack.invite(targetChannel, users)

    await slack.postEphemeral(sender, 'Channel mirrored')
  }

  /**
   * Prune everyone except for these ids
   */
  async prune(sender, idsString) {
    const channel = await slack.getChannel(sender.channel)
    const users = await slack.getChannelUsers(channel)
    const ids = idsString.trim().split(',')
    await async.each(users, async (user) => {
      if (user.id === sender.user || user.id === process.env.ST_SLACK_BOT_USER) {
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

    await async.each(users, async (user) => {
      if (user.id === sender.user || user.id === process.env.ST_SLACK_BOT_USER) {
        continue
      }
      await slack.kick(channel, user.id)
    })
    await slack.postEphemeral(sender, 'Channel emptied')
  }
}

module.exports = new Channel()
