#!/usr/bin/env node

import { program } from 'commander'

import { Miner } from '../miner'

program
  .option('-p, --privatekey <privatekey>', 'miner private key')
  .option('-a, --address <address>', 'miner payout address')
  .option('-d, --difficulty <difficulty>', 'maximum difficulty')

program
  .command('start')
  .action(() => {
    console.log('start miner')

    const miner = new Miner({ privatekey, address })

    miner.start()

  })


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


