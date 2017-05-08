const AWS = require('aws-sdk')
AWS.config.update({ region: process.env.AWS_REGION })
const codebuild = new AWS.CodeBuild()
const status = require('./status')

module.exports.run = (commit, environment) => {
  return new Promise((resolve, reject) => {
    codebuild.startBuild({
      projectName: process.env.CODEBUILD_PROJECT,
      artifactsOverride: { type: 'NO_ARTIFACTS' },
      environmentVariablesOverride: [
        {
          name: 'DEPLOY_ENVIRONMENT',
          value: environment === undefined ? '' : environment
        },
        {
          name: 'GITHUB_COMMIT',
          value: commit
        }
      ],
      sourceVersion: commit
    })
      .promise()
      .then(resp => {
        return status.update('pending', 'CodeBuild is running your tests', commit, resp.build.id)
      })
      .then(resp => {
        resolve(resp)
      })
      .catch(err => {
        console.log(err)
        reject(err)
      })
  })
}
