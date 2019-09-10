<img src="https://avatars2.githubusercontent.com/u/2810941?v=3&s=96" alt="Google Cloud Platform logo" title="Google Cloud Platform" align="right" height="96" width="96"/>

# Monitoring a Compute Engine footprint with Cloud Functions and Stackdriver sample

## Deploy and run the sample

### Enable the APIs
1. Enable the following APIs
    1. Cloud Functions
    1. Compute Engine
    1. Cloud Scheduler
    1. App Engine
    1. Cloud Resource Manager API 

```
gcloud services enable cloudscheduler.googleapis.com \
    compute.googleapis.com \
    cloudfunctions.googleapis.com \
    cloudresourcemanager.googleapis.com \
    appengine.googleapis.com
```

### Generate your environment variables
1. Generate a token using a UUID 
    1. First install uuidgen. If it is already installed, skip this step.

```
sudo apt-get install uuid-runtime
```

2. Use the uuidgen command to generate a UUID.

```
export TOKEN=$(uuidgen)
```

The token appears in each of the Cloud Function config.json files and the Cloud Scheduler job. This will be supplied in the messages from the Cloud Scheduler and used to validate the message against the configuration values.
 
3. Set your PROJECT_ID environment variable for use during later steps by replacing YOUR_PROJECT_ID value with your GCP project id.
export PROJECT_ID=[YOUR_PROJECT_ID]

### Create new service accounts for your functions

1. Create a service account for the list_projects function

```
gcloud beta iam service-accounts create \
gce-footprint-list-projects \
--description "Used for the function that lists the projects for the GCE Footprint Cloud Function"
```

2. Create a service account for the write_vm_count function

```
gcloud beta iam service-accounts create \
gce-footprint-write-vm-count \
--description "Used for the function that writes the vm count to Pub/Sub for the GCE Footprint Cloud Function"
```

3. Create a service account for the write_to_stackdriver function

```
gcloud beta iam service-accounts create \
gce-footprint-write-to-sd \
--description "Used for the function that writes metrics to Stackdriver for the GCE Footprint Cloud Function"
```

### Set environment variables

1. Set environment variables for the service accounts

```
export LIST_PROJECTS_SERVICE_ACCOUNT=gce-footprint-list-projects@$PROJECT_ID.iam.gserviceaccount.com 
export WRITE_VM_COUNT_SERVICE_ACCOUNT=gce-footprint-write-vm-count@$PROJECT_ID.iam.gserviceaccount.com
export WRITE_TO_SD_SERVICE_ACCOUNT=gce-footprint-write-to-sd@$PROJECT_ID.iam.gserviceaccount.com
```
### Deploy the List Projects Cloud Function

1. Change directories into the list_projects directory of the source repo

```
cd list_projects/
```

2. Replace the token value in the config file with your newly minted token.

```
sed -ibk "s/99a9ffa8797a629783cb4aa762639e92b098bac5/$TOKEN/g" config.json
```

3. Replace the project value in the config file with your project name

```
sed -ibk "s/YOUR_PROJECT_ID/$PROJECT_ID/g" config.json
```

4. Use the gcloud functions deploy command to deploy the list_projects

```
gcloud functions deploy list_projects \
--trigger-topic gce_footprint_start --runtime nodejs10 \
--entry-point list_projects \
--service-account=$LIST_PROJECTS_SERVICE_ACCOUNT
```

### Deploy the Write VM Count Cloud Functions
1. Change directories into the write_vm_count directory 

```
cd  ../write_vm_count
```

2. Replace the token value in the config file with your newly minted token.

```
sed -ibk "s/99a9ffa8797a629783cb4aa762639e92b098bac5/$TOKEN/g" config.json
```

3. Replace the project value in the config file with your project name

```
sed -ibk "s/YOUR_PROJECT_ID/$PROJECT_ID/g" config.json
```

4. Use the gcloud functions deploy command to deploy the write_vm_count

```
gcloud functions deploy write_vm_count \
--trigger-topic write_vm_count --memory 512MB \
--runtime nodejs10 --entry-point write_vm_count \
--service-account=$WRITE_VM_COUNT_SERVICE_ACCOUNT
```

### Deploy the Write to Stackdriver Cloud Function

1. Use the gcloud functions deploy command to deploy the write_to_stackdriver

```
cd ../write_to_stackdriver
```

2. Replace the token value in the config file with your newly minted token.

```
sed -ibk "s/99a9ffa8797a629783cb4aa762639e92b098bac5/$TOKEN/g" config.json
```

3. Replace the project value in the config file with your project name. 

```
sed -ibk "s/YOUR_PROJECT_ID/$PROJECT_ID/g" config.json
```

This command sets the project value for the GCP project that contains your Stackdriver Workspace which you will create in a subsequent step.

4. Use the gcloud functions deploy command to deploy the write_to_stackdriver

```
gcloud functions deploy write_to_stackdriver \
--trigger-topic write_to_stackdriver \
--runtime nodejs10 --entry-point write_to_stackdriver \
--service-account=$WRITE_TO_SD_SERVICE_ACCOUNT
```

### Identify your organization

1. Identify your Organization ID. Skip this step if you are not planning to monitor an organization and instead plan to monitor a single project.

```
gcloud organizations list
```


2. Replace the YOUR_ORGANIZATION_ID with the value copied from the command above. Set an environment variable with the organization id

```
export ORGANIZATION_ID=YOUR_ORGANIZATION_ID
```

3. Use the gcloud organizations command.

```
gcloud organizations add-iam-policy-binding  $ORGANIZATION_ID --member="serviceAccount:$WRITE_VM_COUNT_SERVICE_ACCOUNT"     --role="roles/compute.viewer"
gcloud organizations add-iam-policy-binding  $ORGANIZATION_ID --member="serviceAccount:$LIST_PROJECTS_SERVICE_ACCOUNT"     --role="roles/compute.viewer"
```

### Grant Cloud IAM permissions
1. Assign Compute Viewer permissions to either your project(s) level for your list_projects and write_vm_count Cloud Functions service accounts.

```
gcloud projects add-iam-policy-binding  $PROJECT_ID --member="serviceAccount:$WRITE_VM_COUNT_SERVICE_ACCOUNT"     --role="roles/compute.viewer"
gcloud projects add-iam-policy-binding  $PROJECT_ID --member="serviceAccount:$LIST_PROJECTS_SERVICE_ACCOUNT"     --role="roles/compute.viewer"
gcloud projects add-iam-policy-binding  $PROJECT_ID --member="serviceAccount:$LIST_PROJECTS_SERVICE_ACCOUNT"     --role="roles/compute.browser"
```

2. Assign the Pub/Sub Publisher permission to your project containing the Cloud Function for your list_projects and write_vm_count Cloud Functions service accounts.
```
gcloud projects add-iam-policy-binding  $PROJECT_ID --member="serviceAccount:$WRITE_VM_COUNT_SERVICE_ACCOUNT"     --role="roles/pubsub.publisher"
gcloud projects add-iam-policy-binding  $PROJECT_ID --member="serviceAccount:$LIST_PROJECTS_SERVICE_ACCOUNT"     --role="roles/pubsub.publisher"
```

3. Assign the Monitoring Metric Writer permission to your project containing the Cloud Function for your Cloud Functions runtime service account. 
```
gcloud projects add-iam-policy-binding  $PROJECT_ID --member="serviceAccount:$WRITE_TO_SD_SERVICE_ACCOUNT"     --role="roles/monitoring.metricWriter"
```

### Deploy the Cloud Scheduler Job
1. Deploy the Cloud Scheduler job

```
gcloud scheduler jobs create pubsub gce_footprint \
--schedule "*/1 * * * *" \
--topic gce_footprint_start \
--message-body "{ \"token\":\"$(echo $TOKEN)\"}"
```

Please note that if you don’t already have a default App Engine app created, this command will ask you to create one. Follow the prompts to create the default app.

2. Verify that the job was created successfully

```
gcloud scheduler jobs list | grep "gce_footprint"
``` 

## Run the tests

1. Follow the steps above to deploy the Cloud Functions to your project. 

    Make a note of your GCP project id and the token value that you generate during the deployment. 

1. Install dependencies:

        npm install

1. Set the following environment variables, replacing the YOUR_PROJECT_ID and TOKEN values used during deployment in the tutorial.

        export PROJECT_ID=[YOUR_PROJECT_ID]
        export TOKEN=[YOUR_TOKEN]

1. Run the tests for the list_projects function:

        cd list_projects
        npm test

1. Run the tests for the write_vm_count function:

        cd ../write_vm_count
        npm test

1. Run the tests for the write_to_stackdriver function:

        cd ../write_to_stackdriver
        npm test
