
import { Wallet } from './wallet'

const { BFile, publish, networks } = require('@runonbitcoin/easy-b')

export async function uploadFile(filepath: string): Promise<string> {

  let wallet = Wallet.init()

  let bFile = await BFile.fromFilePath(filepath)

  const txid = await publish(bFile, networks.MAINNET, wallet.privatekey.toWIF())

  return txid

}
