# grant-ecr
Grant access to ALL ECR repositories of a user.


### Example
```sh
  grant-ecr -u arn:aws:iam::9999999999999:role/admin-role -d 'Sandbox account' # Add user
  grant-ecr -u arn:aws:iam::9999999999999:role/admin-role --remove # Remove user
```
