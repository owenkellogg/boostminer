
import * as bsv from 'bsv'

import { BoostPowJob } from 'boostpow'

import { Wallet } from './wallet'

import config from './config'

import { log } from './log'

interface RunUtxo {
  txid: string;
  vout: number;
  script: string;
  satoshis: number;
}

interface FilepayUtxo {
  txid: string;
  outputIndex: number;
  script: string;
  value: number;
  required?: boolean;
  unlockingScript?: () => bsv.Script;
}

import { run } from './run'

import { uuid } from './utils'

import { promisify } from 'bluebird'

const filepay = require('filepay')

const filepayBuild = promisify(filepay.build)

export async function createJob({content, difficulty, satoshis}: {content: string, difficulty: number, satoshis: number}): Promise<bsv.Transaction> {

  return newJob(content, difficulty, satoshis)

}

export async function newJob(content, difficulty, satoshis): Promise<bsv.Transaction> {

  let tx: bsv.Transaction = await buildJobTransaction({ content, difficulty, satoshis })

  return tx

}

export async function buildJobTransaction({content, difficulty, satoshis, tag}: NewJob): Promise<bsv.Transaction> {

  let wallet = Wallet.init()

  let job = BoostPowJob.fromObject({
    content, diff: difficulty
  })

  const to = [{
    script: job.toHex(),
    value: satoshis
  }, {
    data: [
      'onchain.sv',
      config.get('boostpow_onchain_app_id'),
      'job',
      JSON.stringify({
        index: 0
      })
    ],
    value: 0
  }]

  const utxos: RunUtxo[] = await run.blockchain.utxos(wallet.address)

  log.debug('run.blockchain.utxos', { address: wallet.address, utxos })

  const inputs: FilepayUtxo[] = utxos.map(utxo => {

    return Object.assign(utxo, {
      outputIndex: utxo.vout,
      value: utxo.satoshis,
      //required: false
    })
  })

  const trace = uuid()

  log.debug('filepay.build', { to, inputs, trace })

  let tx = await filepayBuild({
    pay: {
      key: wallet.privatekey.toWIF(),
      to,
      inputs,
      changeAddress: wallet.address
    }
  })

  log.info('filepay.build.result', {tx, trace })

  return tx

}

export interface NewJob {
  content: string;
  difficulty: number;
  satoshis: number;
  tag?: string;
}




