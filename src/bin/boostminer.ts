#!/usr/bin/env node

import { program } from 'commander'

import { Miner } from '../miner'

import { log } from '../log'

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

program.parse(process.argv)

privatekey = program.opts()['privatekey'] || process.env.BOOSTMINER_PRIVATE_KEY

if (!program.opts()['privatekey'] && !process.env.BOOSTMINER_PRIVATE_KEY) {
  console.log('--privatekey option or BOOSTMINER_PRIVATE_KEY environment variable must be provided') 
  process.exit(0)
}

address = program['address'] || process.env.BOOSTMINER_ADDRESS

