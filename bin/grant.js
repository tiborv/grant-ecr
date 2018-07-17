#!/usr/bin/env node

const readline = require('readline')
const chalk = require('chalk')
const meow = require('meow')
const ECR = require('aws-sdk/clients/ecr')
const STS = require('aws-sdk/clients/sts')
const awsARNparser = require('aws-arn-parser')

const cli = meow(`
  Usage
    $ grant-ecr -u <user_arn> -d <description>

  Options
    --user, -u User ARN
    --remove Remove a user
    --description, -d Policy description
    --region, -r, Region (default: eu-west-1)

  Examples
    Add user:
      $ grant-ecr -u arn:aws:iam::9999999999999:role/admin-role -d 'Sandbox account'
    Remove user:
      $ grant-ecr -u arn:aws:iam::9999999999999:role/admin-role --remove
`, {
  flags: {
    user: {
      type: 'string',
      alias: 'u',
      default: false
    },
    description: {
      type: 'string',
      alias: 'd',
      default: false
    },
    remove: {
      type: 'boolean'
    },
    region: {
      type: 'string',
      default: 'eu-west-1'
    }
  }
})

const confirm = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

const genStatement = (namespace) => ({
  Sid: 'Sandbox account',
  Effect: 'Allow',
  Principal: {
    AWS: `arn:aws:iam::${namespace}:root`
  },
  Action: [
    'ecr:GetDownloadUrlForLayer',
    'ecr:BatchGetImage',
    'ecr:BatchCheckLayerAvailability'
  ]
})

const run = async ({ remove, user, description, region }) => {
  if (!user) {
    console.log(chalk.red('User not provided'))
    return cli.showHelp()
  }
  if (!remove && !description) {
    console.log(chalk.red('Description not provided'))
    return cli.showHelp()
  }

  const ecr = new ECR({ region })
  const sts = new STS({ region })
  const { namespace } = awsARNparser(user)
  const currentUser = await sts.getCallerIdentity().promise()
  await confirm(`
    Press ${chalk.green('ENTER')} to add the user: 
    ${chalk.red(user)} (more specifically: ${chalk.yellow(`arn:aws:iam::${namespace}:root`)})
    to ALL ECR repositories of the currently authenticated user: 
    ${chalk.red(currentUser.Arn)}
    in the region: ${region}
  `)
  console.log(chalk.yellow('Fetching policies...'))
  const { repositories } = await ecr.describeRepositories({}).promise()
  const policies = await Promise.all(repositories.map(async r => {
    let policy
    try {
      policy = await ecr.getRepositoryPolicy({
        repositoryName: r.repositoryName,
        registryId: r.registryId
      }).promise()
    } catch (e) {
      policy = {
        repositoryName: r.repositoryName,
        registryId: r.registryId,
        policyText: JSON.stringify({
          'Version': '2008-10-17',
          'Statement': []
        })
      }
    }
    return policy
  }))
  console.log(chalk.green('Policies fetched!'))
  console.log(chalk.yellow('Updating policies...'))

  const parsedPolicies = policies
    .map(p => ({
      ...p,
      policyText: JSON.parse(p.policyText)
    }))
    .map(policy => ({
      ...policy,
      policyText: {
        ...policy.policyText,
        Statement: [
          ...policy.policyText.Statement.filter(s => s.Principal.AWS !== `arn:aws:iam::${namespace}:root`),
          ...(remove ? [] : [genStatement(namespace)])
        ]
      }
    }))
  await Promise.all(parsedPolicies.map(p => {
    if (p.policyText.Statement.length === 0) {
      return ecr.deleteRepositoryPolicy({
        registryId: p.registryId,
        repositoryName: p.repositoryName
      }).promise()
    }
    return ecr.setRepositoryPolicy({
      registryId: p.registryId,
      repositoryName: p.repositoryName,
      policyText: JSON.stringify(p.policyText)
    }).promise()
  }))
  console.log(chalk.green('Policies updated!'))
}

run(cli.flags)
