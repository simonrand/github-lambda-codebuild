'use strict'

const build = require('./lib/build')
const report = require('./lib/report')

const branchesToExclude = []
const branchEnvironments = {
  'master': 'production',
  'staging': 'staging'
}

exports.handler = (event, context, callback) => {
  const message = JSON.parse(event.Records[0].Sns.Message)

  if(message && message.after) {
    // Message from GitHub, building
    const branch = message.ref.split('/').slice(-1)[0]

    if(branchesToExclude.includes(branch)) return console.log(`Not building ${branch}, exiting.`)
    if(message.deleted) return console.log('Branch deleted, exiting.')

    build.run(message.after, branchEnvironments[branch])
      .then(resp => {
        callback(null, resp)
      })
      .catch(err => {
        callback(err, null)
      })
  } else {
    // Message from CodeBuild, reporting
    report.run(message.buildId)
      .then(resp => {
        callback(null, resp);
      })
      .catch(err => {
        callback(err, null);
      })
  }
}
