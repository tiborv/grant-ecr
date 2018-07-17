# grant-ecr
Grant a user access to ALL AWS ECR repositories of the currently logged in user.

Creates policies on all ECR repositories granting the target user image-pull access.

## Install
```sh
  yarn global add grant-ecr
```

### Make sure you are logged in as the correct AWS user.

## Example

```sh
  grant-ecr -u arn:aws:iam::9999999999999:role/admin-role -d 'Sandbox account' -r eu-west-1 # Add user
  grant-ecr -u arn:aws:iam::9999999999999:role/admin-role --remove -r eu-west-1 # Remove user
```

