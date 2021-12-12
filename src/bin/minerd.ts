#!/usr/bin/env node

import { program } from 'commander'

import { Miner } from '../miner'

program
  .option('-p, --privatekey <privatekey>', 'miner private key')
  .option('-a, --address <address>', 'miner payout address')
  .option('-d, --difficulty <difficulty>', 'maximum difficulty')

program.parse(process.argv)

const privatekey = program.opts()['privatekey'] || process.env.BOOSTMINER_PRIVATE_KEY

if (!program.opts()['privatekey'] && !process.env.BOOSTMINER_PRIVATE_KEY) {
  console.log('--privatekey option or BOOSTMINER_PRIVATE_KEY environment variable must be provided') 
  process.exit(0)
}

const address = program['address'] || process.env.BOOSTMINER_ADDRESS

console.log('minerd.start', {
  privatekey,
  address
})

const miner = new Miner({ privatekey, address })

program
  .command('single <txid>')
  .action(async (txid) => {

    try {

      const solution = await mineFromTxid(txid)

      console.log('solution', solution)

      process.exit(0)

    } catch(error) {

      process.exit(1)

    }

  })

program
  .command('start')
  .action(() => {

    miner.start()

  })

console.log(miner)

