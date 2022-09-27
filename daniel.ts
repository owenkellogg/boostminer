#!/usr/bin/env ts-node

import * as bsv from 'bsv'

import * as boostpow from 'boostpow'

import { broadcast } from 'powco'

import { run } from './src/run'

import { workJob } from './solution';

import { createJob } from './src/transactions'

const POWCO_API = `https://pow.co`

import axios from 'axios'

async function postJobByTxid(txid: string) {

  let result = await axios.post(`${POWCO_API}/api/v1/boost/jobs/${txid}`)

  console.log(result)

  return result
}

async function postProofByTxid(txid: string) {

  return axios.post(`${POWCO_API}/api/v1/boost/proofs/${txid}`)
}

import { program } from 'commander'

program
  .command('boost <content> [difficulty] [satoshis]')
  .action(async (content, _difficulty, _satoshis) => {

    var difficulty = 0.00001

    var satoshis = 10000

    if (_difficulty) {

      difficulty = parseFloat(_difficulty)

    }

    if (_satoshis) {

      satoshis = parseInt(_satoshis)

    }

    const newJob = await createJob({
      content,
      difficulty,
      satoshis
    })

    console.log({ newJob })

    const txid: string = await broadcast(newJob.serialize())

    console.log({ txid })

    let postJobResult = await postJobByTxid(txid)

    console.log({ postJobResult })

    let jobHex: string = await run.blockchain.fetch(txid)

    const job: boostpow.BoostPowJob = boostpow.BoostPowJob.fromTransaction(jobHex)

    let txid32 = boostpow.Digest32.fromHex(txid)

    let output = new boostpow.Output(job, job.value, txid32, job.vout)

    let wif = 'KztrXKYE6j29b1CTJ6bxSY2mmWVRwwh1YEvGz7vN7WjZ2xjRmUUC'

    let puzzle = new boostpow.Puzzle(output, wif)
    
    let solution: boostpow.work.Solution = await workJob(job)

    let proof = new boostpow.work.Proof(puzzle.workPuzzle, solution)
    
    let txhex = puzzle.createRedeemTransaction(
      solution, '1ErZaNaYtbUSfyXK8yc9dvH2ofMpw8r7DT', 1, [
        'onchain.sv', 'boostpow', 'proof', '{"input_index":0}'
      ]
    )

    let tx = new bsv.Transaction(txhex)

    const hex = txhex.toString('hex')

    let result = await broadcast(txhex.toString('hex'))

    console.log({ result })

    let r = await postProofByTxid(result)

    console.log({ r })

    process.exit(0)

  })

program.parse(process.argv);
