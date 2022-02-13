
import { v4 } from 'uuid'

import { Wallet } from '../wallet'

import { PrivateKey } from 'bsv'

import * as assert from 'assert'

describe("Signing API Requests", () => {

  it("should use the miner private key to sign", async () => {

    let wallet = new Wallet(new PrivateKey())

    let {signature, message} = wallet.signJSON({

      nonce: v4()

    })

    assert(message.verify(wallet.address, signature.toString()))

  })

})

