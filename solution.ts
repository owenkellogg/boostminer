
import * as boostpow from 'boostpow'

import { work } from 'boostpow'

import { log } from './src/log'

import { Miner } from './src/miner'

import { Wallet } from './src/wallet'

export async function workJob(job: boostpow.BoostPowJob): Promise<boostpow.work.Solution> {

  log.info('boostminer.workjob', job.toObject())

  let wallet = Wallet.init()

  const miner = new Miner({
    privatekey: wallet.privatekey,
    address: wallet.address
  })

  const result: work.Solution = await miner.mine(job)

  log.info('boostminer.workjob.result', result)

  return result

}
