
import { log } from './log'

const nconf = require('nconf')

const os = require('os')

nconf.argv({
  parseValues: true,
  transform
})

nconf.env({
  parseValues: true,
  transform
})

const global_file = `/etc/rabbi/config.json`

const user_file = `${os.homedir()}/.rabbi/rabbi.json`

const project_file = `${process.cwd()}/config/rabbi.json`

nconf.add('project_file', { type: 'file', file: project_file, transform })

nconf.add('user_file', { type: 'file', file: user_file, transform })

nconf.add('global_file', { type: 'file', file: global_file, transform })

export function loadFromFiles() {

  log.debug('config.file.project.load', { path: project_file })

  nconf.use('project_file', { type: 'file', file: project_file, transform })

  log.debug('config.file.user.load', { path: user_file })

  nconf.use('user_file', { type: 'file', file: user_file, transform })

  log.debug('config.file.global.load', { path: global_file })

  nconf.use('global_file', { type: 'file', file: global_file, transform })

}

loadFromFiles()

process.on('SIGHUP', () => {

  loadFromFiles()

})

nconf.defaults({
  config: null,
  host: '0.0.0.0',
  port: '5200',
  docker_miner_enabled: false
})

nconf.required(['miner_private_key'])

export default nconf

function transform(obj) {
  return {
    key: obj.key.toLowerCase(),
    value: obj.value
  }
}

