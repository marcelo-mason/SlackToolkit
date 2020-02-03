const Slack = require('slack')
const request = require('request')
const _ = require('lodash')
const async = require('awaitable-async')

class SlackBot {
  constructor() {
    this.access = new Slack({
      token: process.env.SLACK_ACCESS_TOKEN
    })
    this.bot = new Slack({
      token: process.env.SLACK_BOT_TOKEN
    })
    this.deletingConversationMessages = false
    this.deletingAllConversations = false
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
      const groups = await this.access.groups.list({})
      const channels = await this.access.channels.list({})
      const groups2 = await this.bot.groups.list({})
      const list = [...groups.groups, ...channels.channels, ...groups2.groups]
      return list
    } catch (err) {
      console.log('* getAllChannels', err.message)
    }
  }

  /**
   * Get a groups/channels by id or name
   */
  async getChannel(nameOrId) {
    try {
      const all = await this.getAllChannels()
      let found = _.find(all, { id: nameOrId })
      if (!found) {
        found = _.find(all, channel => {
          return channel.name.includes(nameOrId.replace('#', ''))
        })
      }
      return found
    } catch (err) {
      console.log('* getChannel', err.message)
    }
  }

  /**
   * List Channels
   */
  async listChannels() {
    try {
      const chans = await this.getAllChannels()
      chans.forEach(c => {
        console.log(c.id, c.name)
      })
    } catch (err) {
      console.log('* listChannels', err.message)
    }
  }

  /**
   * Find one groups/channels
   */
  async getChannelMembers(id) {
    try {
      const channel = await this.getChannel(id)
      if (!channel) {
        return
      }
      let members = []
      if (channel.members.length) {
        members = channel.members
      }
      const chan = await this.access.conversations.members({
        channel: id,
        limit: 500
      })
      if (chan && chan.members.length > members.length) {
        members = chan.members
      }
      return members
    } catch (err) {
      console.log('* getChannelMembers', err.message)
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
      return new Promise(async (resolve, reject) => {
        const users = []
        const members = await this.getChannelMembers(channel.id)
        await async.eachSeries(members, async userId => {
          const user = await this.getUser(userId)
          if (!includeRestricted) {
            if (user.profile.is_restricted) {
              return
            }
          }
          if (!user.is_bot && user.id !== 'USLACKBOT' && !user.deleted) {
            users.push(user)
          }
        })

        resolve(users)
      })
    } catch (err) {
      console.log('* getChannelUsers', err.message)
    }
  }

  /**
   * If user is in a channel
   */
  async inChannel(user, channelName) {
    if (!channelName || !channelName.length) {
      return false
    }

    try {
      const channel = await this.getChannel(channelName.replace('#', ''))
      if (!channel) {
        return
      }

      const memberIds = await this.getChannelMembers(channel.id)

      const found = memberIds.indexOf(user.id) > -1
      return found
    } catch (err) {
      console.log('* inChannel', err.message)
    }
  }

  /**
   * Creates a new channel
   */
  async createChannel(name) {
    try {
      const res = await this.access.channels.create({ name })
      if (res) {
        return res.channel
      }
    } catch (err) {
      console.log('* createChannel', err.message)
    }
  }

  /**
   * Creates a new groupl
   */
  async createGroup(name) {
    try {
      const res = await this.access.groups.create({ name })
      if (res) {
        return res.group
      }
    } catch (err) {
      console.log('* createGroup', err.message)
    }
  }

  /**
   * Invites a user to a channel or group
   */
  async invite(channel, userId) {
    if (typeof channel === 'string') {
      channel = await this.getChannel(channel)
      if (!channel) {
        return
      }
    }

    try {
      if (channel.is_group) {
        await this.access.groups.invite({ channel: channel.id, user: userId })
      } else {
        await this.access.channels.invite({ channel: channel.id, user: userId })
      }
    } catch (err) {
      if (err.message === 'cant_invite_self') {
        if (!channel.is_group) {
          try {
            await this.access.channels.join({
              name: `#${channel.name}`
            })
          } catch (e) {}
        }
      } else if (err.message !== 'already_in_channel') {
        console.log('* invite', err.message)
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
      if (channel.is_group) {
        await this.access.groups.kick({ channel: channel.id, user: userId })
      } else {
        await this.access.channels.kick({ channel: channel.id, user: userId })
      }
    } catch (err) {
      if (err.message !== 'not_in_channel' && err.message !== 'cant_kick_self') {
        console.log('* kick', err.message)
      }
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
      console.log('* getUser', err.message)
    }
  }

  /**
   * Returns a list of all users
   */
  async getAllUsers(includeDeleted, includeRestricted, includeBots) {
    try {
      const res = await this.access.users.list({})
      if (res) {
        let out = res.members.filter(user => {
          return user.id !== 'USLACKBOT'
        })
        if (!includeBots) {
          out = out.filter(user => {
            return !user.is_bot
          })
        }
        if (!includeDeleted) {
          out = out.filter(user => !user.deleted)
        }
        if (!includeRestricted) {
          out = out.filter(user => !user.profile.is_restricted)
        }
        return out
      }
    } catch (err) {
      console.log('* getAllUsers', err.message)
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
      console.log('* postMessage', err.message)
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
      if (err.message !== 'message_not_found') {
        console.log('* updateMessage', err.message)
      }
    }
  }

  /**
   * Updates a message
   */
  async deleteMessage(channel, ts) {
    try {
      const payload = {
        channel,
        ts
      }
      return await this.bot.chat.delete(payload)
    } catch (err) {
      console.log('* deleteMessage', err.message)
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
  async postEphemeral(sender, text, options = {}) {
    try {
      if (Array.isArray(text)) {
        const chunks = _.chunk(text, 100)
        await async.eachSeries(chunks, async chunk => {
          await this.bot.chat.postEphemeral({
            ...sender,
            text: `\`\`\`${chunk.join('\n')}\`\`\``,
            ...options
          })
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
          if (err.message === 'channel_not_found') {
            const convo = await this.openChat(sender.user)
            if (convo) {
              payload.channel = convo.channel.id
              return this.bot.chat.postEphemeral(payload)
            }
          }
        }
      }
    } catch (err) {
      console.log('* postEphemeral', err.message)
    }
  }
}

module.exports = new SlackBot()
