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

"use strict";

//  Use the Compute Engine nodejs client library
// https://googleapis.dev/nodejs/compute/latest/index.html#reference
const Compute = require('@google-cloud/compute');

//  Use the Pub/Sub nodejs client library
// https://googleapis.dev/nodejs/pubsub/latest/index.html#reference
const {PubSub} = require('@google-cloud/pubsub');

// import the configuration
const config = require('./config.json');

// [START functions_getProjects]
/**
 * Calls the Compute Engine API to get a list of instances. Writes a
 * Pub/Sub message with the resulting json object
 * @param {object} messageObj The json message pulled from the Pub/Sub message
 */
async function listVMs(messageObj) {
    try {
        // create a compute client with the received projectId
        const compute = new Compute({
            projectId: messageObj.projectId
        });
        const projectId = messageObj.projectId;

        // Set a consistent endTime to be shared by all written metrics
        const endTime = messageObj.endTime;

        // Create the json object
        var vmsByStatus = {
            "projectId": projectId,
            "endTime": endTime,
            "token": config.TOKEN,
            "PROVISIONING": [],
            "STAGING": [],
            "RUNNING": [],
            "STOPPING": [],
            "STOPPED": [],
            "SUSPENDING": [],
            "SUSPENDED": [],
            "TERMINATED": []
        };

        const [vms] = await compute.getVMs();

        // Add the VM names to the json object
        vms.forEach(async vm => {
            vmsByStatus[vm["metadata"]["status"]].push(vm["name"]);
        });

        // Publish the object to Pub/Sub
        return publishMessage(config.PROJECTS_WRITE_TOPIC, vmsByStatus);  
    } catch(err) {
        console.error("Error in listVMs()");
        console.error(err);
        throw err;
    } 
}
// [END functions_getProjects]

// [START functions_publishMessage]
/**
 * Calls the Cloud Resource Manager API to get a list of projects. Writes a
 * Pub/Sub message for each project
 * @param {String} topicName The Pub/Sub topic name 
 * @param {object} vmsByStatus The json object to publish
 */
async function publishMessage(topicName, vmsByStatus) {
  try {  
    const dataBuffer = Buffer.from(JSON.stringify(vmsByStatus));
    const pubsub = new PubSub();
    const messageId = await pubsub.topic(topicName).publish(dataBuffer);
    console.log(`Sent pubsub message ${messageId} for project: ${vmsByStatus["projectId"]}, message: ${JSON.stringify(vmsByStatus)}`);
  } catch(err){
    console.error("Error in publishMessage()");
    console.error(err);
    throw err;
  }
  return;
}
// [END functions_publishMessage]

// [START functions_write_vm_count]
/**
 * Background Cloud Function to be triggered by a Cloud Pub/Sub message.
 *
 * @param {object} pubSubEvent The Cloud Functions event which contains a pubsub message
 * @param {object} context The Cloud Functions context 
 */
exports.write_vm_count = (pubSubEvent, context) => {
	console.log(`messageId: ${context.eventId}`);
    const data = Buffer.from(pubSubEvent.data, 'base64').toString();
    var jsonMessage = "";
    try {
        jsonMessage = JSON.parse(data);
    } catch(err) {
      	console.error(`Error parsing input message: ${data}`);
        console.error(err);
        throw err;
    }
    if ("token" in jsonMessage) {
        const token = jsonMessage["token"];
        if (token === config.TOKEN){
            return listVMs(jsonMessage);
        } else {
             const err = new Error("The token property in the pubsub message does not match, not processing");
             console.error(err);
             throw err;
        } 
    } else {
        const err = new Error("No token property in the pubsub message, not processing");
        console.error(err);
        throw err;
    }
};
// [END functions_write_vm_count]
