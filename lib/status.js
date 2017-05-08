const github = require('octonode')

module.exports.update = (status, description, commit, buildId) => {
  const client = github.client(process.env.GITHUB_TOKEN)
  const github_repo = client.repo(process.env.GITHUB_REPO)

  return new Promise((resolve, reject) => {
    const url = `https://console.aws.amazon.com/codebuild/home?region=${process.env.AWS_REGION}#/builds/${buildId}/view/new`
    github_repo.status(commit, {
      "state": status,
      "target_url": url,
      "description": description
    }, (err, data, headers) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
