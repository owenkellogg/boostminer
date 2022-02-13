
import * as bsv from 'bsv'

const Message = require('bsv/message')

interface SignedBuffer {
  message: typeof Message;
  signature: bsv.crypto.Signature;
}

export class Wallet {
  privatekey: bsv.PrivateKey;

  constructor(privatekey: bsv.PrivateKey) {
    this.privatekey = privatekey
  }

  static init() {

    const homedir = require('os').homedir();
    const fs = require('fs')
    const path = require('path')

    const directory = path.join(homedir, '.boostminer')
    const configFilePath = path.join(homedir, '.boostminer', 'config.json')

    if (!fs.existsSync(directory)) {

      fs.mkdirSync(directory)

      console.log(`${path.join(homedir, '.boostminer')} directory created`)

    }

    var privkey

    try {

      let configFile = fs.readFileSync(configFilePath)

      if (configFile) {

        let configJson = JSON.parse(configFile)

        privkey = new bsv.PrivateKey(configJson.privatekey)

      }

    } catch(error) {

      privkey = new bsv.PrivateKey()
      let address = privkey.toAddress().toString()

      let configJson = {
        privatekey: privkey.toWIF(),
        address
      }

      fs.writeFileSync(configFilePath, JSON.stringify(configJson))

      console.log('satoshis are required to fund new jobs\n')
      console.log(`boostminer initialized with address\n\n${address}\n`)

    }

    return new Wallet(privkey)

  }

  get address() {

    return this.privatekey.toAddress().toString()
  }

  signJSON(json): SignedBuffer {

    const buffer = Buffer.from(JSON.stringify(json))

    const message = new Message(buffer)

    const signature = message.sign(this.privatekey)

    return {
      message, signature
    }

  }
}

