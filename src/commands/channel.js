const async = require('awaitable-async')
const _ = require('lodash')
const slack = require('../slack')

class Channel {
  /**
   * Process the command
   */
  async process({ req, res, sender, user, cmd, args }) {
    if (!user.is_admin) {
      return res.send('Sorry, you do not have access to this command.')
    }

    switch (cmd) {
      case 'create':
        res.send()
        await this.create(sender, args.length ? args[0] : req.body.channel_name)
        break
      case 'full':
        res.send()
        await this.createAndFill(sender, args.length ? args[0] : req.body.channel_name)
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
          '`/channel create [channel]` - Creates an empty channel',
          '`/channel full [channel]` - Creates a channel and fills it with all users',
          '`/channel fill` - Fills the current channel with all users',
          '`/channel empty` - Removes everyone from the current channel',
          '`/channel remove-except [list]` - Removes everyone except listed and admins from the current channel',
          '`/channel mirror [channel]` - Fills the current channel with users from another channel',
          '`/channel invite [list]` - Invites everyone on the list to the current channel',
          '`/channel prune [list]` - Removes everyone *not* on the list from the current channel',
          '`/channel lock [keyword]` - Locks a deal channel to contributors to the deals that match the keyword',
          '`/channel funded-invite [@user]` - Invite user to all funded channels',
          '',
          '* Example of a valid user list: U78TKJHAL,U70GEE62D,U70QG8ZB5,U845M27A5'
        ]
        res.send(help.join('\n'))
    }
  }

  async inviteBot(channel) {
    try {
      await slack.invite(channel, process.env.SLACK_BOT_USER) // slack toolkit bot
    } catch (e) {}
  }

  /**
   * Creates an empty channel
   */
  async create(sender, channelName) {
    let channel = await slack.getChannel(channelName)
    if (!channel) {
      channel = await slack.createChannel(channelName)
      await slack.postEphemeral(sender, `Channel ${channelName} created`)
    }
  }

  /**
   * Creates a channel and fills it
   */
  async createAndFill(sender, channelName) {
    let channel = await slack.getChannel(channelName)
    if (!channel) {
      channel = await slack.createChannel(channelName)
    }

    const users = (await slack.getAllUsers()).map(u => u.id)    
    const alreadyIn = (await slack.getChannelUsers(channel)).map(u => u.id)
    _.remove(users, x => {
      return _.indexOf(alreadyIn, x) !== -1
    });
    await slack.inviteBatch(channel, users)
    
    await slack.postEphemeral(sender, `Channel ${channelName} created`)
  }

  /**
   * Fill the channel with the group
   */
  async fill(sender) {
    const channel = await slack.getChannel(sender.channel)
    const users = (await slack.getAllUsers()).map(u => u.id)
    const alreadyIn = (await slack.getChannelUsers(channel)).map(u => u.id)
    _.remove(users, x => {
      return _.indexOf(alreadyIn, x) !== -1
    });
    await slack.inviteBatch(channel, users)

    await slack.postEphemeral(sender, 'Channel filled')
  }

  /**
   * Fill the channel with the members from named channel
   */
  async mirror(sender, targetChannel, channelName) {
    let channel = await slack.getChannel(channelName)
    if (!channel) {
      return 'Channel not found'
    }

    const users = await slack.getChannelUsers(channel).map(u => u.id)
    const alreadyIn = (await slack.getChannelUsers(channel)).map(u => u.id)
    _.remove(users, x => {
      return _.indexOf(alreadyIn, x) !== -1
    });
    await slack.inviteBatch(targetChannel, users)

    await slack.postEphemeral(sender, 'Channel mirrored')
  }

  /**
   * Prune everyone except for these ids
   */
  async prune(sender, idsString) {
    const channel = await slack.getChannel(sender.channel)
    const users = await slack.getChannelUsers(channel)
    const ids = idsString.trim().split(',')
    await async.each(users, async user => {
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
    const ids = idsString.trim().split(',')
    
    await slack.inviteBatch(channel, ids)
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

    await async.each(users, async user => {
      await slack.kick(channel, user.id)
    })
    await slack.postEphemeral(sender, 'Channel emptied')
  }
}

module.exports = new Channel()
