const async = require('async')
const proxyquire = require('proxyquire')
const { Readable } = require('stream')

exports.loadLib = (file) => {
  // Spy on the async module.
  spyOn(async, 'eachOfLimit').and.callThrough()

  // Stub out the fs(-extra) module with spies.
  let fs = jasmine.createSpyObj('fs', [
    'appendFileSync',
    'createFileSync',
    'move',
    'readFile',
    'readFileSync',
    'removeSync',
    'truncateSync',
    'writeFileSync'
  ])
  fs.move.and.callFake((src, dest, opts, callback) => { callback() })

  // Stub out the got module with a spy.
  let got = jasmine.createSpyObj('got', ['stream'])
  got.stream.and.callFake(url => {
    return new Readable({
      read () {
        if (this.alreadySent) {
          this.push(null)
        } else {
          this.push('test')
          this.alreadySent = true
        }
      }
    })
  })

  // Stub out the Polly SDK.
  let PollyStub = jasmine.createSpy('Polly').and.returnValue({
    getSynthesizeSpeechUrl: () => 'http://example.com'
  })
  let pollyStub = {
    Presigner: PollyStub
  }

  let spawnOnSpy = jasmine.createSpy('spawn.on').and.callFake((type, callback) => {
    if (type === 'close') { callback() }
  })
  let spawnStderrOn = jasmine.createSpy('spawn.stderr.on')
  let spawn = jasmine.createSpy('spawn').and.callFake(() => {
    return {
      on: spawnOnSpy,
      stderr: {
        on: spawnStderrOn
      }
    }
  })

  // Load the library module.
  let lib = proxyquire(`../lib/${file}`, {
    async: async,
    'aws-sdk/clients/polly': pollyStub,
    child_process: { spawn }, // eslint-disable-line camelcase
    'fs-extra': fs,
    got: got
  })

  // Add the spies for inspection.
  lib.async = async
  lib.fs = fs
  lib.got = got
  lib.Polly = PollyStub
  lib.spawn = spawn
  lib.spawn.on = spawnOnSpy
  lib.spawn.stderr = { on: spawnStderrOn }

  return lib
}
