
# boostminer

Mines Boost Jobs on Your CPU

## Installation

```
> npm install -g boostminer

```
### Usage

```
Usage: boostminer [options] [command]

Options:
  -p, --privatekey <privatekey>             miner private key
  -a, --address <address>                   miner payout address
  -h, --help                                display help for command

Commands:
  upload <filepath>
  start
  wallet
  workjob <job_txid>
  job <txid>
  init
  submitjob <txhex>
  newjob <content> <difficulty> <satoshis>
  help [command]                            display help for command
```
## 

### Initializing boostminer and Funding Wallet
```
> boostminer init

wallet address is <YOUR MINER ADDRESS>

satoshis are required to fund new jobs

```
Send some satoshis so your miner can claim payment for work done

### Running Boostminer

```
> boostminer start
```

### Running with Docker

```
docker run proofofwork/boostminer boostminer start

```
