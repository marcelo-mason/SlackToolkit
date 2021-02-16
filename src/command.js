const slack = require('./slack')

module.exports = async function (req, res) {
  try {
    if (req.body.token !== process.env.SL_SLACK_VERIFICATION_TOKEN) {
      return res.send('Invalid slack token')
    }

    console.log('*', req.body.command, req.body.user_name)
    const user = await slack.getUser(req.body.user_id)
    const channel = await slack.getChannel(req.body.channel_id)
    const sender = {
      channel: req.body.channel_id,
      user: req.body.user_id
    }
    const [cmd, ...args] = req.body.text.split(' ')
    const data = {
      trigger_id: req.body.trigger_id,
      req,
      res,
      sender,
      user,
      channel,
      cmd,
      args
    }
    this.process(data)
  } catch (err) {
    res.send('Oops something went wrong!')
    console.log('* error ', err)
  }
}
