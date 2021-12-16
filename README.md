
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
  -p, --privatekey <privatekey>  miner private key
  -a, --address <address>        miner payout address
  -d, --difficulty <difficulty>  maximum difficulty
  -h, --help                     display help for command

Commands:
  start
  job <txid>
  help [command]                 display help for command
```

### Configuring Secrets Via Environment Variables 
```
> export BOOSTMINER_PRIVATE_KEY=<bitcoin_private_key

> boostminer start

```

