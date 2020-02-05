const async = require('awaitable-async')
const _ = require('lodash')

class CmdArgs {
  constructor() {
    this._flags = {}
    this._args = []
  }

  get flags() {
    return this._flags
  }

  get args() {
    return this._args
  }

  async parse(args) {
    await async.each(args, async arg => {
      if (arg.startsWith('--')){
        const name = arg.replace('--', '')
        this._flags[name] = true
        return
      }
      if (arg.startsWith('-')){        
        const names = arg.replace('-', '').split('')
        names.forEach(name => {
          this._flags[name] = true
        });
        return
      }
      this._args.push(arg)
    })
  }
}

module.exports = new CmdArgs()
