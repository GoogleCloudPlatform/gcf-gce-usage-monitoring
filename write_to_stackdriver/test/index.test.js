/**
 * Copyright 2019, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// [START functions_pubsub_integration_test]
const childProcess = require('child_process');
const assert = require('assert');

it('write_to_stackdriver: should print the messageId of the Pub/Sub message', done => {
  const startTime = new Date(Date.now()).toISOString();

  const response = childProcess
    .execSync(`export PROJECT_ID=${process.env.PROJECT_ID} && export TOKEN_ID=$TOKEN && test/test_send_pubsub_msg.sh`)
    .toString();
  
  // Grab the messageId that was created when sending the Pub/Sub message above
  const firstIndex = response.indexOf("'")+1;
  const lastIndex = response.lastIndexOf("'");
  const messageId = response.slice(firstIndex, lastIndex);
  console.log("messageId: "+messageId);

  // Wait for the Cloud Function logs to be available
  childProcess
    .execSync("sleep 20");

  // Check the Cloud Function logs
  const logs = childProcess
    .execSync(`gcloud beta functions logs read write_to_stackdriver --execution-id="${messageId}"`)
    .toString();
  console.log("logs are: "+logs);
  
  // Check to see that the message has been received
  assert.strictEqual(logs.includes(`${messageId}`), true);

  // Check to see that the messageId is printed
  assert.strictEqual(logs.includes(`messageId`), true); 

  // Check to see that at least 8 calls to the Stackdriver Monitoring API were made
  var regexp = /Done writing time series data/g;
  var timeSeriesCount = logs.toString().match(regexp); 
  if (timeSeriesCount== null) {
    timeSeriesCount = [];
  }
  assert.strictEqual(timeSeriesCount.length,8);
  done();
});

it('write_to_stackdriver: should print the error message when no input is sent in Pub/Sub trigger message ', done => {

  const response = childProcess
    .execSync("test/test_send_empty_pubsub_msg.sh")
    .toString();
  
  // Grab the messageId that was created when sending the Pub/Sub message above
  const firstIndex = response.indexOf("'")+1;
  const lastIndex = response.lastIndexOf("'");
  const messageId = response.slice(firstIndex, lastIndex);
  console.log("messageId: "+messageId);

  // Wait for the Cloud Function logs to be available
  childProcess
    .execSync("sleep 20");

  // Check the Cloud Function logs
  const logs = childProcess
    .execSync(`gcloud beta functions logs read write_to_stackdriver --execution-id="${messageId}"`)
    .toString();
  console.log("logs are: "+logs);
  
  // Check to see that the message has been received
  assert.strictEqual(logs.includes(`${messageId}`), true);

  // Check to see that the messageId is printed
  assert.strictEqual(logs.includes(`Error: No token property in the pubsub message`), true); 
  assert.strictEqual(logs.includes(`finished with status: 'error'`), true); 

  done();
});

it('write_to_stackdriver: should print the error message when token doesnt match config ', done => {

  const response = childProcess
    .execSync("test/test_send_incorrect_token_pubsub_msg.sh")
    .toString();
  
  // Grab the messageId that was created when sending the Pub/Sub message above
  const firstIndex = response.indexOf("'")+1;
  const lastIndex = response.lastIndexOf("'");
  const messageId = response.slice(firstIndex, lastIndex);
  console.log("messageId: "+messageId);

  // Wait for the Cloud Function logs to be available
  childProcess
    .execSync("sleep 20");

  // Check the Cloud Function logs
  const logs = childProcess
    .execSync(`gcloud beta functions logs read write_to_stackdriver --execution-id="${messageId}"`)
    .toString();
  console.log("logs are: "+logs);
  
  // Check to see that the message has been received
  assert.strictEqual(logs.includes(`${messageId}`), true);

  // Check to see that the messageId is printed
  assert.strictEqual(logs.includes(`Error: The token property in the pubsub message does not match`), true); 
  assert.strictEqual(logs.includes(`finished with status: 'error'`), true); 

  done();
});