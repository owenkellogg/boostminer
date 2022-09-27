import { Runnable } from "mocha"

const Run = require('run-sdk')

const blockchain = new Run.plugins.WhatsOnChain({ network: 'main' })

export const run = new Run({ blockchain })

export const fetch = async function(txid: string): Promise<string> {

    return run.blockchain.fetch(txid)
}
