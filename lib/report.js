const AWS = require('aws-sdk')
AWS.config.update({ region: process.env.AWS_REGION })
const codebuild = new AWS.CodeBuild()
const status = require('./status')
const promiseRetry = require('promise-retry')
const Slack = require('slack-node')

const statuses = {
  'PENDING': 'pending',
  'IN_PROGRESS': 'pending',
  'FAILED': 'failure',
  'SUCCEEDED': 'success',
  'ERROR': 'error'
}

const messages = {
  'PENDING': 'CodeBuild is running your tests',
  'IN_PROGRESS': 'CodeBuild is running your tests',
  'FAILED': 'Your tests failed on CodeBuild',
  'SUCCEEDED': 'Your tests passed on CodeBuild',
  'ERROR': 'There was an error running your tests'
}

function greenStatus(buildId) {
  return new Promise((resolve, reject) => {
    codebuild.batchGetBuilds({ ids: [ buildId ] }, (err, data) => {
      var build = data.builds[0]
      if (build.buildStatus == 'SUCCEEDED' || build.buildStatus == 'FAILED') {
        resolve(build)
      } else {
        reject(false)
      }
    })
  })
}

function reportFailure(buildId, build) {
  const failureSnsTopic = process.env.FAILURE_SNS_TOPIC
  const slackWebhookUrl = process.env.SLACK_URL
  const slackWebhookUser = process.env.SLACK_USERNAME
  const failureMessage = buildFailureMessage(buildId, getCommitter(build))

  if(build.buildStatus === 'FAILED' && failureSnsTopic) reportFailureToSns(failureSnsTopic, failureMessage)
  if(build.buildStatus === 'FAILED' && slackWebhookUrl) reportFailureToSlack(slackWebhookUrl, slackWebhookUser, failureMessage)
}

function reportFailureToSns(topic, message) {
  const sns = new AWS.SNS()

  return new Promise((resolve, reject) => {
    sns.publish({
      Message: message,
      Subject: 'Build Failed',
      TopicArn: topic
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function reportFailureToSlack(webhookUrl, webhookUser, message) {
  slack = new Slack();
  slack.setWebhook(webhookUrl);

  return new Promise((resolve, reject) => {
    slack.webhook({
      channel: '#build_log',
      icon_emoji: ':red_circle:',
      text: message,
      username: webhookUser || 'buildbot'
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function buildFailureMessage(buildId, committer) {
  const buildUrl = `https://console.aws.amazon.com/codebuild/home?region=${process.env.AWS_REGION}#/builds/${buildId}/view/new`
  var output = `Build ${buildId} for ${committer} failed.\n\nSee more: ${buildUrl}`
  if(process.env.REBUILD_URL && process.env.REBUILD_KEY) {
    const rebuildUrl = `${process.env.REBUILD_URL}?buildId=${buildId}&key=${process.env.REBUILD_KEY}`
    output += `\n\nRebuild: ${rebuildUrl}`
  }
  return output
}

function getCommitter(build) {
  const committerEnvVar = build.environment.environmentVariables.find(function(environmentVariable) {
    return environmentVariable.name === 'COMMITTER'
  })

  return committerEnvVar ? committerEnvVar.value : '(committer unavailable)'
}

module.exports.run = (buildId) => {
  return promiseRetry(function (retry, number) {
    console.log('attempt number', number);
    return greenStatus(buildId)
      .catch(retry);
  }).then(function (build) {
      const buildStatus = statuses[build.buildStatus]
      const buildMessage = messages[build.buildStatus]

      reportFailure(buildId, build)

      return status.update(buildStatus, buildMessage, build.sourceVersion, build.id)
    }, function (err) {
      return err
    })
}
