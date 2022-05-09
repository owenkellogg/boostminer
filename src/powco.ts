
import * as http from 'superagent'
import * as bsv from 'bsv'
import { Wallet } from './wallet'

import { v4 } from 'uuid'

export async function submitJob(hex: string): Promise<any> {

  try {

    let { body } = await http.post('https://pow.co/api/v1/boost/jobs')
        .send({ transaction: hex })

    console.log('submit job response', body)

    return body

  } catch(error) {

    console.log(error.response)
  }

}

export async function submitBoostProofTransaction(hex: string): Promise<any> {

  let { body } = await http.post('https://pow.co/api/v1/boost/work')
      .send({ transaction: hex })

  console.log('submit boost proof response', body)

  return body

}

interface NewApiRequest {
  http_method: string;
  method: string;
  url: string;
  params?: any;
  payload?: any;
}

class ApiRequest {
  http_method: string;
  method: string;
  url: string;
  payload: any[];
  nonce: string;
  wallet: Wallet;

  constructor(wallet: Wallet, newRequest: NewApiRequest) {
    this.wallet = wallet;
    this.nonce = v4();
    this.url = newRequest.url;
    this.http_method = newRequest.http_method;
    this.method = newRequest.method;
    this.payload = newRequest.payload;
  }

  private signMessage() {

    let message = {
      method: this.method,
      payload: this.payload,
      url: this.url,
      nonce: this.nonce
    }

    return this.wallet.signJSON(message)
  }

  private addHeaders(request) {

    let { message, signature } = this.signMessage()

    let headers = {
      'x-signer': this.wallet.address,
      'x-signature': signature,
      'x-message': message.toString()
    }

    request.set(headers)

    return request

  }

  private buildRequest(): http.Request {

    let request = http[this.http_method](this.url)

    if (this.http_method === 'POST') {

      request = request.send(this.payload)

    }

    return this.addHeaders(request)

  }

  async send() {

    return this.buildRequest()

  }
}

export async function getJob(txid: string, wallet: Wallet): Promise<any> {
  

  const url = `https://pow.co/api/v1/boost/jobs/${txid}`
  //const url = `http://localhost:4001/node/v1/boost/jobs/${txid}`

  const nonce = v4();

  const {signature, message} = wallet.signJSON({
    method: 'getjob',
    payload: { txid, url },
    nonce
  })
  
  let { body } = await http
    .get(url)
    .set({
      'x-signer': wallet.address,
      'x-signature': signature,
      'x-message': message.toString()
    })

  return body.job

}

interface Job {
  content: string;
  difficulty: number;
  category: string;
  tag: string;
  txid: string;
  value: number;
  vout: number;
  additionalData: string;
  script: string;
  spent: boolean;
}


export async function listAvailableJobs(): Promise<Job[]> {

  let { body } = await http.get('https://pow.co/api/v1/boost/jobs')

  return body.jobs.map(job => {
    return Object.assign(job, { difficulty: parseFloat(job.difficulty) })
  })
  .sort((a,b) => a.difficulty <= b.difficulty)

}

export async function getTransaction(txid: string, wallet?: Wallet): Promise<bsv.Transaction> {

  const url = `https://pow.co/api/v1/tx/${txid}`

  const request = http.get(url)

  if (wallet) {

    const nonce = v4()

    const signature = wallet.signJSON({
      method: 'gettx',
      payload: { txid, url },
      nonce
    })

    let { body } = await request.set({
      'x-signature': signature
    })

    return new bsv.Transaction(body.txhex)

  } else {

    let { body } = await request
    return new bsv.Transaction(body.txhex)

  }

}


