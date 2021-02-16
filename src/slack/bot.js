const { WebClient, ErrorCode, retryPolicies } = require('@slack/web-api')
const delay = require('delay')
const request = require('request')
const _ = require('lodash')
const async = require('awaitable-async')
const { RateLimit } = require('async-sema')

class SlackBot {
  constructor() {
    this.botUser = null
    this.access = new WebClient(process.env.SL_SLACK_ACCESS_TOKEN, {
      retryConfig: retryPolicies.fiveRetriesInFiveMinutes
    })
    this.bot = new WebClient(process.env.SL_SLACK_BOT_TOKEN, {
      retryConfig: retryPolicies.fiveRetriesInFiveMinutes
    })
    this.deletingConversationMessages = false
    this.deletingAllConversations = false
    this.wait = RateLimit(1, { timeUnit: 2000 })
    this.admins = []
  }

  /**
   * Returns the slack api directly
   */
  get api() {
    return this.access
  }

  /**
   * Returns the slack api directly
   */
  get botApi() {
    return this.bot
  }

  /**
   * returns all groups/channels
   */
  async getAllChannels() {
    try {
      const chans = await this.access.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000
      })
      return chans.channels
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Get a groups/channels by id or name
   */
  async getChannel(channelNameOrId) {
    try {
      const all = await this.getAllChannels()
      let found = _.find(all, { id: channelNameOrId })
      if (!found) {
        found = _.find(all, { name: channelNameOrId.replace('#', '') })
      }
      return found
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * List Channels
   */
  async listChannels() {
    try {
      const chans = await this.getAllChannels()
      chans.forEach((c) => {
        console.log(c.id, c.name)
      })
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Find one groups/channels
   */
  async getChannelMembers(channelNameOrId) {
    try {
      const channel = await this.getChannel(channelNameOrId)
      if (!channel) {
        return
      }
      let members = []
      if (channel.members && channel.members.length) {
        members = channel.members
      }
      const chan = await this.access.conversations.members({
        channel: channel.id,
        limit: 500
      })
      if (chan && chan.members.length > members.length) {
        members = chan.members
      }
      return members
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Returns a list of all users in a channel
   */
  async getChannelUsers(channel, includeRestricted) {
    if (typeof channel === 'string') {
      channel = await this.getChannel(channel)
    }
    try {
      const users = []
      const members = await this.getChannelMembers(channel.id)
      await async.eachSeries(members, async (userId) => {
        const user = await this.getUser(userId)
        if (!user) {
          console.log('* user not on db', userId)
          return
        }
        if (!includeRestricted) {
          if (
            user.profile.is_restricted ||
            user.profile.is_ultra_restricted ||
            user.profile.is_stranger
          ) {
            return
          }
        }
        if (!user.is_bot && user.id !== 'USLACKBOT' && !user.deleted) {
          users.push(user)
        }
      })

      return users
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * If user is in a channel
   */
  async inChannel(user, channelNameOrId) {
    try {
      const channel = await this.getChannel(channelNameOrId)
      if (!channel) {
        return
      }

      const memberIds = await this.getChannelMembers(channel.id)

      const found = memberIds.indexOf(user.id) > -1
      return found
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Creates a new channel
   */
  async createChannel(name, users, priv) {
    if (users && typeof users !== 'string') {
      users = users.join(',')
    }
    try {
      const res = await this.access.conversations.create({
        name,
        is_private: priv,
        user_ids: users
      })
      if (res) {
        return res.channel
      }
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Sets the channel topic
   */
  async setChannelTopic(channel, topic) {
    try {
      const res = await this.access.conversations.setTopic({ channel, topic })
      if (res) {
        return res.ok
      }
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Creates a new group
   */
  async createGroup(name) {
    try {
      const res = await this.access.groups.create({ name })
      if (res) {
        return res.group
      }
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Invites users to a channel or group
   */
  async invite(channel, users) {
    if (typeof channel === 'string') {
      channel = await this.getChannel(channel)
      if (!channel) {
        return
      }
    }

    let userArray = users
    if (!Array.isArray(userArray)) {
      userArray = users.split(/[,;\s\n]+/)
    }

    await async.eachLimit(userArray, 20, async (user) => {
      try {
        await this.access.conversations.invite({
          channel: channel.id,
          users: user
        })
      } catch (err) {
        if (err.code === ErrorCode.PlatformError) {
          const ignore = ['already_in_channel', 'not_in_channel', 'cannot_invite_self']
          if (!ignore.includes(err.data.error)) {
            console.error('* invite', err.message)
          }
        }
      }
    })
  }

  /**
   * Invites users to a channel or group
   */
  async join(channel) {
    if (typeof channel === 'string') {
      channel = await this.getChannel(channel)
      if (!channel) {
        return
      }
    }

    try {
      await this.access.conversations.join({
        channel: channel.id
      })
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error('* invite', err.message)
      }
    }
  }

  /**
   * Kicks a user from a channel or group
   */
  async kick(channel, userId) {
    if (typeof channel === 'string') {
      channel = await this.getChannel(channel)
    }
    try {
      await this.access.conversations.kick({ channel: channel.id, user: user.id })
      console.log('KICK', user.displayname, channel.name)
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        const ignore = ['already_in_channel', 'not_in_channel']
        if (!ignore.includes(err.data.error)) {
          console.error('* kick', err.message)
        }
      } else {
        console.log('* kick', err)
      }
    }
  }

  /**
   * Fills a channel with everyone
   */
  async fillChannel(channelId) {
    try {
      const channel = await this.getChannel(channelId)
      const slackUsers = await this.getAllUsers()

      const userIds = slackUsers.map((u) => u.id)
      const botUserId = await this.getBotUserId()
      const alreadyIn = (await this.getChannelUsers(channel)).map((u) => u.id)

      _.remove(userIds, (id) => _.indexOf(alreadyIn, id) !== -1)
      _.remove(userIds, (id) => id === botUserId)

      if (!userIds.length) {
        return 'No one to invite'
      }

      await this.invite(channel, userIds)
    } catch (err) {
      console.error(err)
      return err.message
    }
  }

  /**
   * Mirror a channel
   */
  async mirrorChannel(channelNameOrId, targetChannel) {
    const tChannel = await this.getChannel(targetChannel)
    if (!tChannel) {
      return `Channel ${targetChannel} not found`
    }

    try {
      const channel = await this.getChannel(channelNameOrId)
      if (!channel) {
        return `Channel ${channelNameOrId} not found`
      }
      const users = (await this.getChannelUsers(channel)).map((u) => u.id)
      await this.invite(targetChannel, users)
    } catch (err) {
      console.error(err)
      return err.message
    }
  }

  /**
   * Returns user data
   */
  async getUser(userId) {
    try {
      const res = await this.access.users.info({ user: userId })
      if (res) {
        return res.user
      }
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Returns a list of all users
   */
  async getAllUsers(includeDeleted, includeRestricted) {
    try {
      const res = await this.access.users.list({})
      if (res) {
        let out = res.members.filter((user) => {
          return !user.is_bot && user.id !== 'USLACKBOT'
        })
        if (!includeDeleted) {
          out = out.filter((user) => !user.deleted)
        }
        if (!includeRestricted) {
          out = out.filter((user) => !user.is_restricted)
          out = out.filter((user) => !user.is_ultra_restricted)
          out = out.filter((user) => !user.is_ultra_stranger)
        }
        return out
      }
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Opens a private chat with a user
   */
  async openChat(userId) {
    try {
      const convo = await this.bot.conversations.open({ users: userId })
      return convo
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Sends a closable message to a user
   */
  async postClosableMessage(channel, text, time) {
    if (typeof channel === 'string') {
      channel = await this.getChannel(channel)
    }
    const options = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text
          }
        },
        {
          type: 'actions',
          block_id: 'convo.close',
          elements: [
            {
              type: 'button',
              action_id: 'close',
              text: {
                type: 'plain_text',
                text: 'Ok'
              },
              style: 'primary'
            }
          ]
        }
      ]
    }

    const res = await this.postMessage(channel.id, options)

    if (time) {
      await delay(time)
      await this.deleteMessage(channel.id, res.ts)
    }
  }

  /**
   * Posts a message to a channel
   */
  async postMessage(channel, text, options = {}) {
    if (typeof text === 'object') {
      options = text
      text = undefined
    }
    try {
      const payload = {
        channel,
        ...options
      }
      if (text) {
        payload.text = text
      }
      return await this.bot.chat.postMessage(payload)
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Updates a message
   */
  async updateMessage(channel, ts, text, options = {}) {
    if (typeof text === 'object') {
      options = text
      text = undefined
    }
    try {
      const payload = {
        channel,
        ...options,
        ts
      }
      if (text) {
        payload.text = text
      }
      console.log('* updating msg', ts)
      return await this.bot.chat.update(payload)
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        if (err.data.error !== 'message_not_found') {
          console.error(err.message)
        }
      }
    }
  }

  /**
   * Updates a message
   */
  async deleteMessage(channel, ts) {
    const payload = {
      channel,
      ts
    }
    try {
      return await this.bot.chat.delete(payload)
    } catch (err) {
      try {
        return await this.access.chat.delete(payload)
      } catch (err) {
        if (err.code === ErrorCode.PlatformError) {
          console.error(err.data)
        } else {
          console.error(err.message)
        }
      }
    }
  }

  /**
   * Updates a message
   */
  async updateEphemeral(e, channel, options) {
    await request({
      url: e.response_url,
      method: 'POST',
      body: JSON.stringify({
        ...options,
        replace_original: true,
        channel
      })
    })
  }

  /**
   * Posts an ephemeral message to a user
   */
  async postEphemeralConversation(userId, text, options = {}) {
    const convo = await this.openChat(userId)
    return this.postEphemeral(
      {
        user: userId,
        channel: convo.channel.id
      },
      text,
      options
    )
  }

  /**
   * Posts an ephemeral message to a user
   */
  async postEphemeral(sender, text, options = {}) {
    if (Array.isArray(text)) {
      const chunks = _.chunk(text, 100)
      await async.eachSeries(chunks, async (chunk) => {
        try {
          await this.bot.chat.postEphemeral({
            ...sender,
            text: `${chunk.join('\n')}`,
            ...options
          })
        } catch (err) {
          if (err.code === ErrorCode.PlatformError) {
            console.error(err.data)
          } else {
            console.error(err.message)
          }
        }
      })
    } else {
      if (typeof text === 'object') {
        options = text
        text = undefined
      }
      const payload = {
        ...sender,
        ...options
      }
      if (text) {
        payload.text = text
      }
      try {
        if (options.useOauthAccessToken) {
          // By using `access.chat` here instead of `bot.chat`, it allows
          // us to post an ephemeral message to a user regardless of where
          // they have executed the slash command from.
          //
          // TODO: change the default behaviour of this command to always
          // use `access.chat`. The reason I'm not making this change now
          // is because there seemed to have been an issue that this caused
          // in the past where certain commands didn't work with this method,
          // such as listing users, but we don't know exactly what the issue
          // was, or which commands it affected.
          // We'll wait until we have a staging slack instance before
          // making this the default behaviour, so we can properly test it
          return this.access.chat.postEphemeral(payload)
        } else {
          // `bot.chat` will only allow an ephemeral message to be posted
          // to a user if they're in a public channel or a bot channel. If
          // a user executes this command in a private channel or while in
          // a private message with another user, the app will generate a
          // `channel_not_found` error
          return this.bot.chat.postEphemeral(payload)
        }
      } catch (err) {
        if (err.code === ErrorCode.PlatformError) {
          if (err.data.error === 'channel_not_found') {
            const convo = await this.openChat(sender.user)
            if (convo) {
              payload.channel = convo.channel.id
              return this.bot.chat.postEphemeral(payload)
            }
          }
        }
      }
    }
  }

  /**
   * Updates a message
   */
  async addReaction(channel, timestamp, name) {
    try {
      await this.bot.reactions.add({
        name,
        channel,
        timestamp
      })
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Returns a list of all users messages from a single channel
   */
  async getUserMessages(channelId) {
    let all = []
    let hasMore = true
    let latest = ''

    await async.whilst(
      () => {
        return hasMore
      },
      async () => {
        try {
          const res = await this.access.conversations.history({
            channel: channelId,
            count: 1000,
            latest
          })

          const filtered = res.messages.filter((msg) => {
            return msg.type === 'message' && 'user' in msg && !('subtype' in msg)
          })
          all = all.concat(filtered)
          hasMore = res.has_more
          if (res.messages.length) {
            latest = res.messages[res.messages.length - 1].ts
          }
          if (hasMore) {
            await delay(500)
            process.stdout.write('.')
          }
        } catch (err) {
          if (err.code === ErrorCode.PlatformError) {
            if (err.data.error === 'channel_not_found') {
              console.error(err)
              hasMore = false
              return
            }
          }
          process.stdout.write('_')
          await delay(1500)
        }
      }
    )

    all.forEach((msg) => {
      msg.timestamp = parseInt(msg.ts.split('.')[0])
    })
    return all
  }

  /**
   * Returns a list of all users messages for every channel
   */
  async getAllUserMessages() {
    try {
      const channels = await this.getAllChannels()
      const users = {}

      await async.eachSeries(channels, async (channel) => {
        await delay(250)
        await async.retry(
          {
            times: 5,
            interval: (retryCount) => 500 * Math.pow(2, retryCount)
          },
          async () => {
            const msgs = await this.getUserMessages(channel.id)
            console.log('* pulled msgs', channel.name, msgs.length)
            msgs.forEach(async (msg) => {
              if (!(msg.user in users)) {
                users[msg.user] = []
              }
              users[msg.user].push(msg)
            })
          }
        )
      })
      const entries = []
      await async.eachOf(users, async (messages, userId) => {
        messages = _.orderBy(messages, ['timestamp'], ['desc'])
        const entry = {
          userId,
          messages
        }
        if (messages && messages.length) {
          entry.lastActive = messages[0].timestamp
          entry.firstActive = messages[messages.length - 1].timestamp
          entries.push(entry)
        }
      })
      return entries
    } catch (err) {
      console.error(err.message)
    }
  }

  /**
   * Handles opening up a dialog
   */
  async openDialog(p, options) {
    try {
      if (!options.trigger_id) {
        options.trigger_id = p.trigger_id
      }
      return this.bot.dialog.open(options)
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  /**
   * Handles opening up a modal
   */
  async openModal(options) {
    try {
      return this.bot.views.open(options)
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.log('open')
        console.log(options)
        console.log('')
        console.error(err.message)
      }
    }
  }

  /**
   * Handles updating of a modal
   */
  async updateModal(options) {
    try {
      return this.bot.views.update(options)
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.log('update')
        console.log(options)
        console.log('')
        console.error(err.message)
      }
    }
  }

  /**
   * Lists the reactions to a user
   */
  async listReactions(userId, channel, timestamp) {
    try {
      const res = await this.access.reactions.get({ channel, timestamp, full: true })
      if (res) {
        const text = res.message.reactions.reduce((acc, curr) => {
          return `${acc}\n\`${curr.name}\` ${curr.users.join(',')}`
        }, '')

        await this.postClosableConvo(userId, text)
      }
    } catch (err) {
      if (err.code === ErrorCode.PlatformError) {
        console.error(err.data)
      } else {
        console.error(err.message)
      }
    }
  }

  async getPermalink(channel, ts) {
    try {
      const res = await this.access.chat.getPermalink({
        channel,
        message_ts: ts
      })
      if (res.ok) {
        return res.permalink
      }
    } catch (err) {
      // message not found
    }
  }

  async getBotUserId() {
    if (this.botUser) {
      return this.botUser.user_id
    }
    const test = await this.bot.auth.test({})
    if (test) {
      this.botUser = test
      return test.user_id
    }
  }

  async getBotId() {
    if (this.botUser) {
      return this.botUser.bot_id
    }
    const test = await this.bot.auth.test({})
    if (test) {
      this.botUser = test
      return test.bot_id
    }
  }
}

module.exports = new SlackBot()
