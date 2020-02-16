const rp = require('request-promise')
const _ = require('lodash')
const slack = require('./slack')
const slackIncoming = require('./slackIncoming')
const dropbox = require('./dropbox')


class NDAUpload {
  constructor() {
    this.ndaChan = process.env.NDAUPLOAD_CHANNEL_ID
    this.listen()
  }

  listen() {
    slackIncoming.events.on('file_shared', async e => {
      if (this.inNDAChannel(e)) {
        if (!this.isNDAAdmin(e.user_id)) {
          const file = await slack.getFile(e.file_id)
          if (file.filetype === 'pdf') {
            await this.processFile(e.file_id, e.user_id)
          }
        }
      }
    })

    slackIncoming.events.on('message', async e => {
      if (this.inNDAChannel(e)) {
        if (!this.isNDAAdmin(e.user)) {
          if (e.hasOwnProperty('files')) {
            if (e.subtype === 'file_share') {
              if (e.files[0].filetype === 'pdf') {
                await slack.deleteMessage(e.channel, e.ts)
              }
            }
          }
        }
      }
    })
  }

  inNDAChannel(e) {
    return e.channel_id === this.ndaChan || e.channel === this.ndaChan
  }

  isNDAAdmin(userId) {
    const admins = process.env.NDAUPLOAD_ADMINS.split(',')
    return admins.indexOf(userId) > -1
  }

  async hasBeenModified(name, size) {
    let list = await slack.getFileList(this.ndaChan, 'pdfs')
    list = _.orderBy(list, ['created'], ['asc']);
    const found = _.find(list, x => x.name === name);
    return found.size != size
  }

  async downloadFile(uri) {
    try {
      const options = {
        method: 'GET',
        uri,
        encoding: null,
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_ACCESS_TOKEN}`
        },
      }
      const res = await rp(options)

      if (res) {
        return res
      }
    } catch (err) {
      console.log(err)
      return null
    }
  }

  async processFile(fileId, userId) {
    try {
      const user = await slack.getUser(userId)
      const file = await slack.getFile(fileId)
      const data = await this.downloadFile(file.url_private)
      await slack.deleteFile(fileId)

      const [fileName, ext] = file.name.split('.')
      const [project] = fileName.split('-')
      const privChanName = `dd-${project}`

      let privChan = await slack.getChannel(privChanName)
      if (!privChan) {
        privChan = await slack.getChannel(project)
      }
      if (!privChan) {
        await slack.postEphemeral({ channel: this.ndaChan, user: userId }, `:warning: Do not rename the NDA file from its original name, please try again.`)
        return
      }

      const modified = await this.hasBeenModified(file.name, file.size)
      if (!modified) {
        await slack.postEphemeral({ channel: this.ndaChan, user: userId }, `:warning: The doc does not appear to have been signed. Please verify and try again.`)
        return
      }

      const success = await dropbox.uploadFile(project, `${user.real_name}.${ext}`, data)
      if (success) {
        const exists = await slack.inChannel(user, privChanName)
        if (!exists) {
          await slack.invite(privChan, userId)
          await slack.postEphemeral({ channel: this.ndaChan, user: userId }, `:unlock: You have been granted access to the *#dd-${project}* channel.`)
        } else {
          await slack.postEphemeral({ channel: this.ndaChan, user: userId }, `:white_check_mark: NDA has been re-submitted successfully.`)
        }
      } else {
        await slack.postEphemeral({ channel: this.ndaChan, user: userId }, `:skull: There was an error processing the file, please contact admin.`)
      }
    } catch (err) {
      console.log('* processFile', err.message)
    }
  }
}


module.exports = new NDAUpload()
