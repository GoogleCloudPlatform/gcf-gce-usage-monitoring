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
// Imports the Google Cloud client library
// https://googleapis.dev/nodejs/monitoring/latest/index.html#reference
const Monitoring = require('@google-cloud/monitoring');
// import the configuration
const config = require('./config.json');
// Instantiates a monitoring client
const client = new Monitoring.MetricServiceClient();

// [START functions_writeMetrics]
/**
 * Calls the Stackdriver Monitoring API to write a custom metric for each status
 * @param {object} vmsByStatus The json message pulled from the Pub/Sub message
 */
async function writeMetrics(vmsByStatus) {

    var vmsStatusList = [
    	"PROVISIONING",
    	"STAGING",
      	"RUNNING",
      	"STOPPING",
      	"STOPPED",
      	"SUSPENDING",
      	"SUSPENDED",
      	"TERMINATED"
    ];
	
    var timeSeriesList = [];
    try {
        // Write a metric for each status
        vmsStatusList.forEach(vmStatus => {
            
            var vmCnt = vmsByStatus[vmStatus].length;

            // Prepares an individual data point
            const dataPoint = {
                interval: {
                    endTime: {
                    seconds: vmsByStatus["endTime"],
                    },
                },
                value: {
                    // The number of VMs in this status
                    int64Value: vmCnt
                }
            };

            // Prepares the time series object
            const timeSeries = 
                  {
                    // Ties the data point to a custom metric
                    metric: {
                      type: config.MONITORING_METRIC_NAME,
                      labels: {
                        instance_status: vmStatus,
                        gcp_project_id: vmsByStatus["projectId"],
                      },
                    },
                    resource: {
                      type: 'global',
                    },
                    points: [dataPoint],
                  };
          	// Add each timeSeries object to the list
            timeSeriesList.push(timeSeries);

        });
        const projectId = config.MONITORING_METRIC_PROJECT_ID;
        // Create the API request using the list of timeSeries objects
        const request = {
          name: client.projectPath(projectId),
          timeSeries: timeSeriesList
        };
      	const results = await client.createTimeSeries(request);
        console.log(`project: ${vmsByStatus["projectId"]}, Done writing time series data: ${JSON.stringify(results[0])}`);
      	
    } catch(err){
        console.error(`ERROR: project: ${vmsByStatus["projectId"]}, vmStatus: ${vmStatus}, err: ${err}`);
        console.error(err);
        throw err;   
    }
} 
// [END functions_writeMetrics]

// [START functions_write_to_stackdriver]
/**
 * Background Cloud Function to be triggered by a Cloud Pub/Sub message.
 *
 * @param {object} pubSubEvent The Cloud Functions event which contains a pubsub message
 * @param {object} context The Cloud Functions context 
 */
exports.write_to_stackdriver = (pubSubEvent, context) => {
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
            return writeMetrics(jsonMessage);
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
// [END functions_write_to_stackdriver]