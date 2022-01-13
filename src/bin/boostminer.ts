#!/usr/bin/env node

import { program } from 'commander'

import { Miner } from '../miner'

import { Wallet } from '../wallet'

import { log } from '../log'

import { submitJob } from '../powco'

import * as boost from 'boostpow'

const filepay = require('filepay')

import * as bsv from 'bsv'

program
  .option('-p, --privatekey <privatekey>', 'miner private key')
  .option('-a, --address <address>', 'miner payout address')
  .option('-d, --difficulty <difficulty>', 'maximum difficulty')

var privatekey, address;

program
  .command('start')
  .action(() => {

    log.info('boostminer.start', { address })

    const miner = new Miner({ privatekey, address })

    miner.start()

  })

program
  .command('job <txid>')
  .action(async (txid) => {
    console.log('start miner')

    try {

      const miner = new Miner({ privatekey, address })

      let result = await miner.mineFromTxid(txid)

      console.log(result)

    } catch(error) {

      console.error(error)

    }

  })

program
  .command('init')
  .action(async () => {

    let wallet = Wallet.init()

    console.log('satoshis are required to fund new jobs\n')

  })

program
  .command('submitjob <txhex>')
  .action(async (txhex) => {

    try {

      let response = await submitJob(txhex)

    } catch(error) {

      console.error(error)

    }

    process.exit(0)

  })

program
  .command('newjob <content> <difficulty> <satoshis>')
  .action(async (content, difficulty, satoshis) => {

    try {

      let wallet = Wallet.init()

      let job = boost.BoostPowJob.fromObject({
        content, diff: parseFloat(difficulty)
      })

      const to = [{
        script: job.toHex(),
        value: parseInt(satoshis)
      }]

      filepay.build({
        pay: {
          key: wallet.privatekey.toWIF(),
          to
        }
      }, async (err, tx) => {


        if (err) {

          console.log('error building job transaction')

        } else {
         
          console.log({ txhex: tx.serialize()})

          let response = await submitJob(tx.serialize())

        }

      })

      /*const miner = new Miner({ privatekey, address })

      let result = await miner.mineFromTxid(txid)

      console.log(result)
      */

    } catch(error) {

      console.error(error)

    }

  })

program.parse(process.argv)

privatekey = program.opts()['privatekey'] || process.env.BOOSTMINER_PRIVATE_KEY

if (!program.opts()['privatekey'] && !process.env.BOOSTMINER_PRIVATE_KEY) {
  let wallet = Wallet.init()
  console.log('--privatekey option or BOOSTMINER_PRIVATE_KEY environment variable can be provided to override') 
  process.exit(0)
}

address = program['address'] || process.env.BOOSTMINER_ADDRESS

