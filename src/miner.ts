
const { spawn } = require('child_process');

import config from './config'

const {EventEmitter} = require('events')

const Run = require('run-sdk')

const run = new Run({
  network: 'main'
})

import { log } from './log'

import { Wallet } from './wallet'

import { join } from 'path'

import { platform } from 'os'

import * as delay from 'delay'

import * as bsv from 'bsv'

import * as os from 'os'

import axios from 'axios'

import * as powco  from './powco'

import * as boostpow from 'boostpow'

import { broadcast } from 'powco'

const publicIp = require('public-ip');

import { getSpend } from './whatsonchain'

import * as Minercraft from 'minercraft'
import { fetch } from 'powco';

const taal = new Minercraft({
  "url": "https://merchantapi.taal.com"
})

function getBoostMiner(): string {

  switch(platform()) {
    case 'darwin':
      return join(__dirname, '../includes/boost_miner_mac')
    case 'linux':
      return join(__dirname, '../includes/boost_miner_linux')
    case 'win32':
      return join(__dirname, '../includes/boost_miner_windows')
    default: 
      throw new Error(`platform ${platform()} not yet supported. Please email steven@pow.co for support`)
  }

}

interface MiningParams {
  txid: string;
  script: string;
  vout: number;
  value: number;
  difficulty?: number;
  content?: string;
}

interface MinerParams {
  privatekey: string;
  address?: string;
}

export class MinerBase extends (EventEmitter as {new(): any}) {

  _stop = false

  hashrate = 0 // hashes per second

  address: bsv.Address;
  privatekey: bsv.PrivateKey;

  _ipv4 = null
  _ipv6 = null

  constructor(params: MinerParams) {

    super();

    this.privatekey = new bsv.PrivateKey(params.privatekey)
    this.wallet = new Wallet(this.privatekey)

    if (params.address) {
      this.address = new bsv.Address(params.address)
    } else {
      this.address = this.privatekey.toAddress()
    }

  }

  getHashrate() {

    return this.hashrate
  }

  stop() {
    this._stop = true
  }

  get publickey() {
    let pubkey = this.privatekey.publicKey
    return pubkey.toString()
  }

  async getIPv4() {
    if (!this._ipv4) {
      this._ipv4 = await publicIp.v4()
    }
    return this._ipv4
  }

  async getIPv6() {
    if (!this._ipv6) {
      this._ipv6 = await publicIp.v6()
    }
    return this._ipv6
  }

  setHashrate({ hashes }) {

    let newHashes = hashes - this.besthashes

    let duration = (new Date().getTime() - this.besthashtime) / 1000

    let hashrate = newHashes / duration

    this.hashrate = hashrate

    this.besthashtime = new Date().getTime()

    this.emit('hashrate', {
      hashrate: this.hashrate,
      publickey: this.publickey,
      ipv4: this._ipv4,
      content: this.content,
      difficulty: this.difficulty
    })
    
  }

  async mineFromTxid(txid: string) {

    let hex = await fetch(txid)

    let job = boostpow.BoostPowJob.fromTransaction(hex)

    return this.mineJob(hex, job)

  }

  async mineJob(tx: bsv.Transaction, job: any) {

    let params = {
      txid: job.txid,
      script: tx.outputs[job.vout].script.toHex(),
      vout: job.vout,
      value: job.value,
      content: job.content.hex,
      difficulty: job.difficulty
    }

    return this.mine(params)

  }

  mine(params: MiningParams) {
    return new Promise((resolve, reject) => {

      this.miningParams = params;

      this.hashrate = 0
      this.besthashes = 0
      this.besthashtime = new Date().getTime()
      this.content = params.content
      this.difficulty = params.difficulty

      log.info('miner.start', params)

      const p = [
        'redeem',
        params.script,
        params.value,
        `0x${params.txid}`,
        params.vout,
        this.privatekey.toWIF(),
        this.address.toString()
      ]

      const useDocker = true

      const ls = (() => {

        if (config.get('docker_miner_enabled')) {

          log.debug('docker_miner_enabled')

          let params = [
            'run',
            'proofofwork/boostminer:v0.1.0',
            './bin/BoostMiner'
          ].concat(p)

	  console.log(params)

          return spawn('docker', params, {});

        } else {

          return spawn(getBoostMiner(), p, {});

        }
      })()

      ls.stdout.on('data', async (data) => {

        try {

          let lines = data.toString().split("\n")

          for (let content of lines) {

            var json;

            try {

              json = JSON.parse(content)

              log.info(json)

            } catch(error) {

              log.error({error, content})

              continue;

            }

            this.emit(json.event, json);
             
            switch (json.event) {
              case 'job.complete.redeemscript':
                this.emit('job.complete.redeemscript', json)
                break;

              case 'job.complete.transaction':

                this.emit('job.complete.transaction', json)
                return resolve(json)
              default:
                this.emit(json.event, json);
                break;
            }

            if (content.match(/^hashes/)) {

              let [ hashes, besthash ] = data.toString().split("\n").map(line => {
                let parts = line.split(':')
                return parts[parts.length - 1].trim()
              })

              this.emit('besthash', {
                hashes,
                besthash,
                content: this.content,
                difficulty: this.difficulty,
                publickey: this.publickey,
                os: {
                  arch: os.arch(),
                  cpus: os.cpus(),
                  platform: os.platform(),
                  network: os.networkInterfaces()
                },
                ipv4: await this.getIPv4()
              })

              this.setHashrate({ hashes })

            } else if (content.match(/^solution/)) {

              let solution = content.split(' ')[1].trim().replace('"', "")

              this.emit('solution', {
                content: this.content,
                difficulty: this.difficulty,
                publickey: this.publickey,
                solution,
                os: {
                  arch: os.arch(),
                  cpus: os.cpus(),
                  platform: os.platform(),
                  network: os.networkInterfaces()
                },
                ipv4: await this.getIPv4()
              })

            } else {

            }
          }

        } catch(error) {

          log.error(error)

        }

      });

      ls.stderr.on('data', (data) => {

        console.log('ERROR!', data.toString())
        console.log('ERROR! UTF8', data.toString('utf8'))
        console.log('ERROR! HEX', data.toString('hex'))

        try {

          console.log(data)

          this.emit('error', data)

          if (!this._stop) {
            this.mine(this.miningParams)
          }
        } catch(error) {

          console.error(error)

        }
      });

      ls.on('close', (code) => {
        this.emit('complete', code)
        this._stop = true
        if (!this._stop) {
          this.mine(params)
        }
        //resolve({ code })
      });


    })
  }
}

interface Solution {

}

interface Job {
  txid: string;
  script: string;
  vout: number;
  value: number;
}

interface JobOptions {
  content?: string;
  maxDifficulty?: number;
  minValue?: number;
  minProfitability?: number;
  tag?: string;
  limit?: number;
}

const maxDifficulty = 0.1

export class Miner extends MinerBase {

  async getNextJob(options: JobOptions = {}): Promise<any> {

    let jobs = await powco.listAvailableJobs(options)

    jobs = jobs.filter(job => {
      return job.value > 500 && job.difficulty <= maxDifficulty
    })
    .sort((a, b) => {
	   //@ts-ignore
      return new Date(b.timestamp) - new Date(a.timestamp)
    })
    .slice(0, 20)

    console.log(jobs.length, 'LENGTH')

    for (let job of jobs){ console.log(job)}

    const job = jobs[Math.floor(Math.random() * jobs.length)] // random job
    // TODO: Filter by jobs with a maximum difficulty

    const { txid, vout } = job

    const spend = await getSpend({ txid, vout })

    if (spend) {
    
      const { data } = await axios.post(`https://pow.co/api/v1/boost/proofs/${spend.txid}`)

      console.log('proof.imported', data)

      return this.getNextJob(options)

    }

    return {job}

  }

  async workJob(txid: string): Promise<any> {

    let jobRecord = await powco.getJob(txid, this.wallet)

    if (jobRecord.spent) {
      throw new Error('job already complete')
    }

    const txhex = await fetch(txid)

    let tx = await powco.getTransaction(txid)

    console.log('workJob', jobRecord.toJSON())

    let job = boostpow.BoostPowJob.fromTransaction(txhex, jobRecord.vout)

    let solution: any = await this.mineJob(tx, job)

    return solution
  }

  async start(options: JobOptions = {}) {

    while (true) {

      try {

        let {job} = await this.getNextJob({
		maxDifficulty : options.maxDifficulty || 0.1,
		limit: options.limit || 1000,
		minValue: 500
	})

        if (!job) {
          await delay(1000)
          continue;
        }

	console.log('job.mine', job)

        let params: MiningParams = {
          txid: job.txid,
          script: job.script,
          vout: job.vout,
          value: job.value
        }

        console.log('mining.params', params)

        let solution: any = await this.mine(params)

        ;(async () => {
          try {

            let response = await broadcast(solution.txhex)

            const { data } = await axios.post(`https://pow.co/api/v1/boost/proofs/${response}`)

            console.log('powco.proofs.post.response', data)

          } catch(error) {

            console.error('powco.proofs.post.error', error)

          }
        })()

        ;(async () => {

          try {

            var response = await powco.submitBoostProofTransaction(solution.txhex)

            console.log('powco.response', response)

          } catch(error) {

            console.error('powco.error', error)

          }

        })()

        log.info('solution.submitted', solution)
        
      } catch(error) {

        console.error(error)

        log.error(error)

      }

      console.log('about to delay')

      await delay(1000)

    }

  }

}

