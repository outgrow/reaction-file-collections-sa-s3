# reaction-file-collections-sa-s3

[![npm (scoped)](https://img.shields.io/npm/v/@outgrowio/reaction-file-collections-sa-s3.svg)](https://www.npmjs.com/package/@outgrowio/reaction-file-collections-sa-s3)

An AWS S3 adapter for [reaction-file-collections](https://github.com/reactioncommerce/reaction-file-collections), brought to you by out:grow.

## Installation

To use this S3 adapter, you'll need to fork Reaction's [`api-plugin-files`](https://github.com/reactioncommerce/api-plugin-files), which is where the storage adapters are set up. You can clone it to be part of your repository, or fork it separately and use a `git` submodule.

Once you've forked `api-plugin-files`, `cd` to its root directory and install the adapter with `npm install @outgrowio/reaction-file-collections-sa-s3`.

Then, still in `api-plugin-files`' root directory, open `src/setUpFileCollections.js`.

Replace usages of `GridFSStore` with `S3Store`, starting from the import on line 19: `const S3Store = require("@outgrowio/reaction-file-collections-sa-s3").default;`.

When replacing the `GridFSStore` constructor with the `S3Store` one, make sure to pass the following options:

```javascript
new S3Store({
    name, // Should be provided within buildGFS
    isPublic: true,
    objectACL: "public-read",
    async transformWrite(fileRecord) {
        // Either write your custom transformation code here, or re-use the one from the GridFSStore constructor
    }
});
```

## Configuration

Set up your AWS S3 credentials using environment variables:

```bash
# The AWS region your S3 bucket is in (if using S3 on AWS)
AWS_S3_REGION=us-east-1

# The custom S3 endpoint you'd like to use (if using an S3-compatible API like Min.io)
AWS_S3_ENDPOINT=http://some.endpoint.com:9000

# Name of the S3 bucket you want to store your media in
AWS_S3_BUCKET=reaction-media

# An AWS access key with the appropriate S3 permissions
AWS_ACCESS_KEY_ID=QWERTYUIOPASDFGH

# The secret access key that goes with the access key
AWS_SECRET_ACCESS_KEY=<secret_key>
```

## Help

Need help integrating this plugin into your Reaction Commerce project? Simply looking for expert [Reaction Commerce developers](https://outgrow.io)? Want someone to train your team to use Reaction at its fullest?

Whether it is just a one-hour consultation to get you set up or helping your team ship a whole project from start to finish, you can't go wrong by reaching out to us:

* +1 (281) OUT-GROW
* contact@outgrow.io
* https://outgrow.io

## Contributing

Pull Requests, Issues and Feature Requests are welcome!
