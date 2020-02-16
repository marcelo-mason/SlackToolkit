const fetch = require('isomorphic-fetch')
const Dropbox = require('dropbox').Dropbox

class DropboxHelper {
  constructor() {
    this.dbx = new Dropbox({ fetch, accessToken: process.env.DROPBOX_ACCESS })
  }

  /**
   * Upload a file
   */
  async uploadFile(folder, filename, contents) {
    try {
      await this.dbx.filesUpload({
        path: `/${folder}/${filename}`,
        contents,
        mode: { '.tag': 'overwrite' },
        mute: true
      })
      return true
    } catch (err) {
      console.log(err.error)
    }
  }
}

module.exports = new DropboxHelper()
