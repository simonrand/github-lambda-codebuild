'use strict'

const build = require('./lib/build')
const rebuild = require('./lib/rebuild')
const report = require('./lib/report')

const branchesToExclude = []
const branchEnvironments = {
  'master': 'production',
  'staging': 'staging'
}

exports.handler = (event, context, callback) => {
  if(event.Records) {
    const message = JSON.parse(event.Records[0].Sns.Message)

    if(message && message.after) {
      if(message.deleted) return console.log('Branch deleted, exiting.')

      // Message from GitHub, building
      const branch = message.ref.split('/').slice(-1)[0]

      if(branchesToExclude.includes(branch)) return console.log(`Not building ${branch}, exiting.`)

      build.run(message.after, branchEnvironments[branch], message.pusher.name)
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
  } else if (event.buildId) {
    // From API Gateway
    rebuild.run(event.key, event.buildId)
      .then(resp => {
        callback(null, {
          statusCode: 302,
          location: resp.target_url
        })
      })
      .catch(err => {
        callback(err)
      })
  }
}
