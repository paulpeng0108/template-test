'use strict';

const SQS = require('aws-sdk/clients/sqs');
const jwt = require('jsonwebtoken');
const JKU_URL = "https://assets.cs.roku.com/keys/partner-jwks.json"
const axios = require('axios');
const jwkToPem = require('jwk-to-pem');
const { DynamoDB } = require("aws-sdk")

var dynamodb = new DynamoDB({});

const sqs = new SQS({
    region: process.env.AWS_REGION
});

let publicKeys = []

async function validateRokuPayWebookEvent(token){
    let decodedToken = jwt.decode(token, {complete: true})
    console.log(decodedToken.signature)
    let publicKey = await fetchPublicKey(decodedToken.header.kid)

    let payload = jwt.verify(token, jwkToPem(publicKey), {ignoreExpiration: true})
    return Buffer.from(payload["x-Roku-message"], 'base64').toString()
}

async function fetchPublicKey(kid){
    console.log("validate_tag", publicKeys)
    let publicKey = publicKeys.find((key) => key.kid == kid)

    if(!publicKey){
        console.log("validate_tag", "getKey")
        let result = await axios(JKU_URL)
        publicKeys = result.data.keys
    }

    return publicKeys.find((key) => key.kid == kid)
}

module.exports.hello = async (event) => {
    console.log("includes", "includes".includes(":"))

    
    
    return {
        statusCode: 200,
        body: JSON.stringify(
            {
                message: 'Go Serverless v2.0! Your function executed successfully!',
                dbInfo: process.env.MONGO_URI,
            },
            null,
            2
        ),
    };
};

let listCache = []
let objCache = {}

module.exports.producer = async (event) => {

    let body = JSON.parse(event.body)
    let messages = []

    if(!listCache.includes(body.key)){
        messages.push("key not found in list")
        listCache = [body.key]
    } else {
        messages.push("key found in list")
    }

    if(objCache.key){
        messages.push("key found in obj")
    } else {
        messages.push("key not found in obj")
        objCache.key = body.key
    }

    // await sqs.sendMessage({
    //     QueueUrl: process.env.SQS_QUEUE_URL,
    //     // Any message data we want to send
    //     MessageBody: rawPayload,
    //     MessageGroupId: rokuTransaction.customerId,
    //     MessageDeduplicationId: rokuTransaction.transactionId
    // }).promise();
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            listCache,
            objCache,
            messages
        })
    };
};

/**
 * 
 * @param {{
 *  body: string,
 *  groupID: string,
 *  deduplicationID: string
 * }} message 
 * @param {*} retry 
 */
async function sendMessage(message, retry){

    try {
        let result = await sqs.sendMessage({
            QueueUrl: process.env.SQS_QUEUE_URL,
            MessageBody: message.body,
            MessageGroupId: message.groupID,
            MessageDeduplicationId: message.deduplicationID
        }).promise()
        
        return result
    } catch (error) {
        console.error("sendmessage error", error)

        if(retry > 0){
            console.log("retry sendmessage", retry)
            let retryResult = await sendMessage(message, --retry)
            return retryResult
        }

        throw error
    }

} 

module.exports.consumer = async (event) => {
    console.log(JSON.stringify(event))

    throw new Error("dlq test")

    let failedMessages = []

/*     for(let record of event.Records){
        console.log(`consumer-log-${process.env.TEST_ID}-start`, {
            event: record.attributes.MessageDeduplicationId,
        })

        try{
            await processMessage(record)

            console.log(`consumer-log-${process.env.TEST_ID}-finish`, {
                event: record.attributes.MessageDeduplicationId,
            })

        } catch (err) {
            console.log(`consumer-log-${process.env.TEST_ID}-failed`, {
                event: record.attributes.MessageDeduplicationId,
            })


            failedMessages.push({itemIdentifier: record.messageId})
        }
    }
 */

    return {batchItemFailures: failedMessages} 

/*     console.log(event)
    let ids = event.Records.map((m) => m.attributes.MessageDeduplicationId).join(' ')
    console.log(`consumer-log-${process.env.TEST_ID}-start`, {
        events: ids,
    })



    console.log("duration:", parseInt(process.env.TASK_DURATION))
    let timer = await new Promise((resolve) => setTimeout(resolve, parseInt(process.env.TASK_DURATION)))

    let fails = []
    let failsLogs = []

    for(let record of event.Records){
        if(Math.floor(Math.random() * 3) == 0){
            failsLogs.push(record.attributes.MessageDeduplicationId)
            fails.push({itemIdentifier: record.messageId})
        }
    }

    if(failsLogs.length > 0){
        console.log(`consumer-log-${process.env.TEST_ID}-failed`, {
            events: failsLogs.join(' '),
        })
    } 

    console.log(`consumer-log-${process.env.TEST_ID}-end`, {
        events: ids,
    })

    return {batchItemFailures: fails} */

    //sqs.deleteMessage({QueueUrl: process.env.SQS_QUEUE_URL, ReceiptHandle: event.Records[0].receiptHandle})
};

 
async function processMessage(message){
    console.log(message)
    return new Promise((resolve, reject) => {
            setTimeout(() => {
                if(Math.floor(Math.random() * process.env.SUCCESS_CHANCE) == 0){

                    reject(message.attributes.MessageDeduplicationId)
                } else {

                    resolve(message.attributes.MessageDeduplicationId)

                }
            }, parseInt(process.env.TASK_DURATION))
        })
        .then(() => sqs.deleteMessage({QueueUrl: process.env.SQS_QUEUE_URL, ReceiptHandle: message.receiptHandle}).promise())
}


module.exports.heartBeat = async (event) => {
    var params = {
        ExpressionAttributeValues: {
         ":userID": {
           S: "a"
          }
        }, 
        KeyConditionExpression: "userID = :userID", 
        TableName: "dtc_active_device_pool_dev"
    };

    let result = await dynamodb.query(params).promise()

    console.log(result)

    return {
        statusCode: 200,
        body: "done"
    };
}


async function cronTest(event){
    console.log(event)
}
module.exports.cronTest = cronTest


async function enableTest(event){
    console.log(event)
    return {
        statusCode: 200,
        body: "enableTest done"
    };
}
module.exports.enableTest = enableTest