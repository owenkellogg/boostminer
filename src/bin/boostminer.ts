#!/usr/bin/env node

import { program } from 'commander'

import * as yesno from 'yesno'

import { Miner } from '../miner'

import { Wallet } from '../wallet'

import * as powco from '../powco'

import { log } from '../log'

import { submitJob } from '../powco'

import * as boost from 'boostpow'

const filepay = require('filepay')

const prompt = require("prompt-async");

import { uploadFile } from '../uploader'

import * as bsv from 'bsv'

program
  .option('-p, --privatekey <privatekey>', 'miner private key')
  .option('-a, --address <address>', 'miner payout address')
  .option('-d, --difficulty <difficulty>', 'maximum difficulty')

var privatekey, address;

program
  .command('upload <filepath>')
  .action(async (filepath) => {


    try {

      let txid = await uploadFile(filepath)

      console.log('file upload success', txid)

      const ok = await yesno({
        question: 'Would you like to boost this file?'
      });

      if (ok) {

        prompt.start()

        const {difficulty, satoshis} = await prompt.get(["difficulty", "satoshis"]);
        console.log(difficulty, satoshis)

        let result = await newJob(txid, difficulty, satoshis)

        console.log(result)

      }

    } catch(error) {

      console.error()

    }

    process.exit(0);


  })

program
  .command('start')
  .action(() => {

    log.info('boostminer.start', { address })

    const miner = new Miner({ privatekey, address })

    miner.start()

  })

program
  .command('wallet')
  .action(() => {

    let wallet = Wallet.init()

    console.log('\nwallet address is', wallet.address) 

    console.log('\nsatoshis are required to fund new jobs\n')

    process.exit(0)

  })

async function workJob(txid: string) {

  try {

    let wallet = Wallet.init()

    log.info('boostminer.workjob', { txid })

    const miner = new Miner({ privatekey, address })

    let solution = await miner.workJob(txid)

    log.info('solution', solution)

    let response = await powco.submitBoostProofTransaction(solution.txhex)

    console.log(response)

  } catch(error) {

    console.error(error)

  }
}

program
  .command('workjob <job_txid>')
  .action(async (txid) => {

    workJob(txid)

    process.exit(0)

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

    console.log('\nwallet address is', wallet.address) 

    console.log('\nsatoshis are required to fund new jobs\n')

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

async function newJob(content, difficulty, satoshis) {
  return new Promise((resolve, reject) => {

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

        const ok = await yesno({
          question: 'Would you like to work this job now?'
        });

        if (ok) {

          let resp = await workJob(response.record[0].txid)

          resolve(resp)

        }

      }

    })

  } catch(error) {

    console.error(error)
    reject(error)

  }
  })
}

program
  .command('newjob <content> <difficulty> <satoshis>')
  .action(async (content, difficulty, satoshis) => {

    await newJob(content, difficulty, satoshis)

  })

program.parse(process.argv)

privatekey = program.opts()['privatekey'] || process.env.BOOSTMINER_PRIVATE_KEY

if (!program.opts()['privatekey'] && !process.env.BOOSTMINER_PRIVATE_KEY) {
  let wallet = Wallet.init()
}

address = program['address'] || process.env.BOOSTMINER_ADDRESS

