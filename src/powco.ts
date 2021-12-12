
import * as http from 'superagent'
import * as bsv from 'bsv'

export async function submitBoostProofTransaction(tx: bsv.Transaction): Promise<any> {

  let { body } = http.post('https://pow.co/node/api/boost_proof_transactions')
      .send({ transaction: tx.toHex() })

  return body

}

