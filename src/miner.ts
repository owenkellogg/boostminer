
const { spawn } = require('child_process');

const {EventEmitter} = require('events')

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

    this.mineJob(tx, job)

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

      const ls = spawn(getBoostMiner(), p, {});

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
        this.emit('error', data)
        if (!this._stop) {
          this.mine(this.miningParams)
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

export class Miner extends MinerBase {

  async getNextJob(): Promise<any> {

    let jobs = await powco.listAvailableJobs()
    console.log(jobs);

    //let item = jobs[Math.floor(Math.random() * jobs.length)] // random job
    // TODO: Filter by jobs with a maximum difficulty

    var job, tx;
    var i = 0;

    while (!job) {

      let item = jobs[i]

      console.log('ITEM', item)

      if (item.difficulty > 1) {
        return {}
      }

      tx = await powco.getTransaction(item.txid)

      console.log('TX', tx)

      job = boostpow.BoostPowJob.fromTransaction(tx)

      i++
      
    }

    console.log('JOB', job)

    return {job, tx}

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

  async start() {

    for (;;) {

      try {

        let {job, tx} = await this.getNextJob()

        if (!job) {
          await delay(1000)
          continue;
        }

        let solution: any = await this.mineJob(tx, job)

        //var response = await taal.tx.push(solution.txhex)

        var response = await powco.submitBoostProofTransaction(solution.txhex)

        log.info('solution.submitted', solution)
        
        //let graphResponse = await boostpow.Graph().submitBoostSolution(solution.txhex)

        //console.log('GRAPH RESPONSE', graphResponse)


        // 1) broadcast solution

        // 2) push proof transaction to boost API service

      } catch(error) {
        console.log(error)

        log.error(error)

      }
      delay(1000)

    }

  }

}

