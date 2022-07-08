
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

import * as powco  from './powco'

import * as boostpow from 'boostpow'

const publicIp = require('public-ip');

import * as Minercraft from 'minercraft'

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

    let tx = await powco.getTransaction(txid)

    let job = boostpow.BoostPowJob.fromTransaction(tx)

    return this.mineJob(tx, job)

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
  tag?: string;
}

export class Miner extends MinerBase {

  async getNextJob(options: JobOptions = {}): Promise<any> {

    let jobs = await powco.listAvailableJobs(options)

    //let item = jobs[Math.floor(Math.random() * jobs.length)] // random job
    // TODO: Filter by jobs with a maximum difficulty

    var job, tx;
    var i = 0;

    while (!job) {

      let item = jobs[i]

      if (item.difficulty > 1) {
        return {}
      }

      job = item

      i++
      
    }

    console.log('job', job)

    return {job}

  }

  async workJob(txid: string): Promise<any> {

    let jobRecord = await powco.getJob(txid, this.wallet)

    if (jobRecord.spent) {
      throw new Error('job already complete')
    }

    let tx = await powco.getTransaction(txid)

    console.log({ txid, tx })

    let job = boostpow.BoostPowJob.fromTransaction(tx)

    let solution: any = await this.mineJob(tx, job)

    return solution
  }

  async start(options: JobOptions = {}) {

    for (;;) {

      try {

        //let {job, tx} = await this.getNextJob()
        let {job} = await this.getNextJob(options)

        if (!job) {
          await delay(1000)
          continue;
        }

        let params: MiningParams = {
          txid: job.txid,
          script: job.script,
          vout: job.vout,
          value: job.value
        }

        console.log('mining.params', params)

        let solution: any = await this.mine(params)

        try {

          let response = await run.blockchain.broadcast(solution.txhex)

          console.log('run.blockchain.broadcast.response', response)

        } catch(error) {

          console.error('run.blockchain.broadcast.error', error)

        }

        try {

          var response = await taal.tx.push(solution.txhex)

          console.log('taal.success.response', response)

          console.log('taal.response', {
            statusCode: response.status,
            data: response.data
          })

        } catch(error) {

          console.error('taal.error', {
            statusCode: error.response.status,
            message: error.response.data.message
          })

        }

        try {

          var response = await powco.submitBoostProofTransaction(solution.txhex)

          console.log('powco.response', response)

        } catch(error) {

          console.error('powco.error', error)

        }

        log.info('solution.submitted', solution)
        
      } catch(error) {

        console.error(error)

        log.error(error)

      }

      delay(1000)

    }

  }

}

