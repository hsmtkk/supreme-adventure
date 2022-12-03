// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import { Construct } from "constructs";
import { App, TerraformStack, CloudBackend, NamedCloudWorkspace, TerraformAsset, AssetType } from "cdktf";
import * as google from '@cdktf/provider-google';
import * as path from 'path';

const project = 'supreme-adventure-370523';
const region = 'asia-northeast1';
//const repository = 'supreme-adventure';

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new google.provider.GoogleProvider(this, 'google', {
      project,
      region,
    });

    const source_bucket = new google.storageBucket.StorageBucket(this, 'source-bucket', {
      location: region,
      name: `source-${project}`,
    });

    const source_asset = new TerraformAsset(this, 'source-asset', {
      path: path.resolve('orig'),
      type: AssetType.ARCHIVE,
    });

    const source_object = new google.storageBucketObject.StorageBucketObject(this, 'source-object', {
      bucket: source_bucket.name,
      source: source_asset.path,
      name: `${source_asset.assetHash}.zip`,
    });

    const cloudfunction_runner = new google.serviceAccount.ServiceAccount(this, 'cloudfunction-runner', {
      accountId: 'cloudfunction-runner',
    });

    new google.projectIamBinding.ProjectIamBinding(this, 'cloudfunction-bigquery-view', {
      members: [`serviceAccount:${cloudfunction_runner.email}`],
      project,
      role: 'roles/bigquery.user',
    });

    const nodejs_bq_function = new google.cloudfunctions2Function.Cloudfunctions2Function(this, 'nodejs-bq-function', {
      buildConfig: {
        entryPoint: 'helloBigQuery',
        runtime: 'nodejs16',
        source: {
          storageSource: {
            bucket: source_bucket.name,
            object: source_object.name,
          },
        },
      },
      location: region,
      name: 'nodejs-bq-function',
      serviceConfig: {
        serviceAccountEmail: cloudfunction_runner.email,
      },
    });

    const noauth_data = new google.dataGoogleIamPolicy.DataGoogleIamPolicy(this, 'noauth-data', {
      binding: [{
        members: ['allUsers'],
        role: 'roles/run.invoker',        
      }],
    });

    new google.cloudRunServiceIamPolicy.CloudRunServiceIamPolicy(this, 'cloudrun-noauth', {
      location: region,
      policyData: noauth_data.policyData,
      service: nodejs_bq_function.name,
    });
  }
}

const app = new App();
const stack = new MyStack(app, "supreme-adventure");
new CloudBackend(stack, {
  hostname: "app.terraform.io",
  organization: "hsmtkkdefault",
  workspaces: new NamedCloudWorkspace("supreme-adventure")
});
app.synth();
