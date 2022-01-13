
import * as http from 'superagent'
import * as bsv from 'bsv'

export async function submitJob(hex: string): Promise<any> {

  try {

    let { body } = await http.post('https://pow.co/node/api/jobs')
        .send({ transaction: hex })

    console.log('submit job response', body)

    return body

  } catch(error) {

    console.log(error.response)
  }

}

export async function submitBoostProofTransaction(hex: string): Promise<any> {

  let { body } = await http.post('http://localhost:4001/node/api/work')
  //let { body } = await http.post('https://pow.co/node/api/boost_proof_transactions')
      .send({ transaction: hex })

  console.log('submit boost proof response', body)

  return body

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

  let { body } = await http.get('https://pow.co/api/v0/mining/jobs')

  return body.jobs.map(job => {
    return Object.assign(job, { difficulty: parseFloat(job.difficulty) })
  })
  .sort((a,b) => a.difficulty <= b.difficulty)

}

export async function getTransaction(txid: string): Promise<bsv.Transaction> {

  console.log('GET TRANSACTION', txid)

  let { body } = await http.get(`https://pow.co/api/v1/tx/${txid}`)

  return new bsv.Transaction(body.txhex)

}

