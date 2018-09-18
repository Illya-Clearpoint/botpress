import { expect } from 'chai'
import path from 'path'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import moment from 'moment'
import rimraf from 'rimraf'

const bin = path.resolve(__dirname, '../bin/botpress')
const botDir = path.resolve(__dirname, '../tmp-bot')
const botConfig = path.resolve(__dirname, '../tmp-bot/config')
const rootDir = path.resolve(__dirname, '../../../../')
const compileLinkBash = path.resolve(rootDir, './compile-link.sh')
const configVar = require('./config/env.js')

const botpressModules = [
  `file:${path.resolve(rootDir, './packages/functionals/botpress-analytics')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-audience')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-broadcast')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-hitl')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-nlu')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-qna')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-scheduler')}`,
  `file:${path.resolve(rootDir, './packages/functionals/botpress-terminal')}`,
  `file:${path.resolve(rootDir, './packages/channels/botpress-channel-messenger')}`,
  `file:${path.resolve(rootDir, './packages/channels/botpress-channel-slack')}`,
  `file:${path.resolve(rootDir, './packages/channels/botpress-channel-telegram')}`,
  `file:${path.resolve(rootDir, './packages/channels/botpress-channel-twilio')}`,
  `file:${path.resolve(rootDir, './packages/channels/botpress-channel-microsoft')}`,
  `file:${path.resolve(rootDir, './packages/channels/botpress-channel-web')}`,
  `file:${path.resolve(rootDir, './packages/core/botpress-builtins')}`,
  `file:${path.resolve(rootDir, './packages/core/botpress-util-roles')}`,
  `file:${path.resolve(rootDir, './packages/skills/botpress-skill-choice')}`,
  `file:${path.resolve(rootDir, './packages/core/botpress')}`
]

const LAUNCHED = /Bot launched/gi
const TWENTY_MIN = 1200000

describe('Create new bot', function() {
  this.timeout(TWENTY_MIN)

  const startTime = moment()

  let hasError = false
  const ifErrorSkipIt = () => expect(!!hasError).to.be.false
  const checkTaskStatus = err => {
    hasError = err
    expect(err).to.be.null
  }

  // eslint-disable-next-line
  before(done => {
    if (existsSync(botDir)) {
      rimraf(botDir, () => done())
    } else {
      done()
    }
  })

  it('build all modules', done => {
    ifErrorSkipIt()

    exec(`bash ${compileLinkBash}`, err => {
      checkTaskStatus(err)

      done()
    })
  })

  it('create', done => {
    ifErrorSkipIt()

    exec(`node ${bin} init ${botDir} -y`, err => {
      checkTaskStatus(err)

      done()
    })
  })

  it('copy config', done => {
    ifErrorSkipIt()

    rimraf.sync(botConfig)
    exec(`cp -a ./tests/config ${botDir}`, err => {
      checkTaskStatus(err)

      done()
    })
  })

  it('install modules', done => {
    ifErrorSkipIt()

    exec(`yarn add ${botpressModules.join(' ')}`, { cwd: botDir }, err => {
      checkTaskStatus(err)

      done()
    })
  })

  it('run bot', done => {
    ifErrorSkipIt()

    let lastDate = moment().toDate()
    let isLaunched = false
    const botProcess = exec('node index.js', { cwd: botDir, env: configVar })
    const CHECKING_BOT_STATUS_EVERY = 5000

    botProcess.stdout.on('data', data => {
      const lastLog = data.toString()
      const hasError = /error/gi.test(lastLog)
      const date = lastLog.match(/[0-9:]+/g)
      isLaunched = isLaunched || LAUNCHED.test(lastLog)

      lastDate = date ? moment(date[0], 'HH:mm:ss').toDate() : lastDate

      expect(hasError).to.be.false
    })

    const botStateCheck = setInterval(() => {
      const ALL_DONE = 10000
      const now = moment().toDate()
      const isEnd = isLaunched && now - moment(lastDate, 'HH:mm:ss').toDate() > ALL_DONE

      if (isEnd) {
        botProcess.kill('SIGINT')
        clearInterval(botStateCheck)
        done()
      }
    }, CHECKING_BOT_STATUS_EVERY)
  })
  /* eslint-disable-next-line */
  after(() => {
    const endTime = moment()
    const testDuration = moment.duration(endTime.diff(startTime))

    console.log('Test duration: ', testDuration.asMinutes(), 'm')
  })
})
