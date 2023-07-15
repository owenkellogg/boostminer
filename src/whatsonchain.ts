
import axios from 'axios'

import * as http from 'superagent'

import { createHash } from 'crypto'

import * as bsv from 'bsv'

export interface WhatsonchainTransaction {
  txid: string;
  hash: string;
  time: number;
  blocktime: number;
  blockhash: string;
  vin: any[];
  vout: any[];
}

export async function getScriptHistory({ scriptHash }:{ scriptHash: string }): Promise<{tx_hash: string, height: number}[]> {

  let url = `https://api.whatsonchain.com/v1/bsv/main/script/${scriptHash}/history`

  const { data } = await axios.get(url)

  return data

}

export async function getSpend(args: {txid:string, vout:number}): Promise<{txid:string,vin:number} | null> {

  const tx = new bsv.Transaction(await fetchTransaction({ txid: args.txid }))

  let scriptHash = createHash('sha256').update(Buffer.from(tx.outputs[args.vout].script.toHex(), 'hex')).digest('hex').match(/[a-fA-F0-9]{2}/g).reverse().join('')

  const history = await getScriptHistory({ scriptHash })

  const spends: any[] = await Promise.all(history.map(async ({ tx_hash }) => {

    if (tx_hash === args.txid) { return null }

    const transaction = await getTransaction(tx_hash)

    const matches = transaction.vin.map((vin, index) => {

      return Object.assign(vin, { index })

    }).filter((vin, index) => {

      return vin.txid == args.txid && vin.vout == args.vout

    })  

    let match = matches[0]

    if (!match) return;

    return {
      txid: tx_hash,
      vin: match.index 
    }   

  })) 

  const spend = spends.flat().filter(s => !!s)[0]

  return spend

}

export async function getTransaction(txid: string): Promise<WhatsonchainTransaction> {

  let url =`https://api.whatsonchain.com/v1/bsv/main/tx/hash/${txid}`

  let {body} = await http.get(url)

  return body

}


export async function fetchTransaction({ txid }: {txid: string}): Promise<string> {

  console.debug('fetchTransaction', { txid })

  const result = await http.get(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`)

  console.debug('fetchTransaction.result', result.text)

  return result.text

}

