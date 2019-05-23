const path = require('path');
const commandName = path.basename(__filename, '.js'); // gives the filename without the .js extension
const logger = require('sp-json-logger')({fileName: 'workers:workers-v2:' + commandName});
const dbUrl = process.env.DB_URL;
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
var db = null; //database connected
const utils = require('./../../jobs/utils/utils.js');
const _ = require('underscore');
const Promise = require('bluebird');
const TODAYS_DATE = new Date();
const rp = require('request-promise');

var runMe = function (payload, config, taskId, messageId) {

    var orgModelId = payload.orgModelId;
    var reportModelId = payload.reportModelId;
    var stockOrderLineItemModels;
    var reportModelInstance;
    try {
        // Global variable for logging

        logger.debug({
            commandName: commandName,
            argv: process.argv,
            orgModelId,
            reportModelId,
            messageId
        });

        try {
            logger.debug({
                commandName: commandName,
                message: 'This worker will update received quantities for order in Vend',
                orgModelId,
                reportModelId,
                messageId
            });
            return Promise.resolve()
                .then(function () {
                    logger.debug({
                        message: 'Will connect to Mongo DB',
                        commandName,
                        messageId
                    });
                    return MongoClient.connect(dbUrl, {promiseLibrary: Promise});
                })
                .catch(function (error) {
                    logger.error({
                        message: 'Could not connect to Mongo DB',
                        error,
                        commandName,
                        messageId
                    });
                    return Promise.reject('Could not connect to Mongo DB');
                })
                .then(function (dbInstance) {
                    db = dbInstance;
                    logger.debug({
                        message: 'Connected to Mongo DB, will look for report model',
                        commandName,
                        messageId
                    });
                    return db.collection('ReportModel').findOne({
                        _id: ObjectId(reportModelId)
                    });
                })
                .catch(function (error) {
                    logger.error({
                        message: 'Could not find report model instance',
                        reportModelId,
                        error,
                        commandName,
                        messageId
                    });
                    return Promise.reject('Could not find report, store, supplier instances');
                })
                .then(function (response) {
                    reportModelInstance = response;
                    logger.debug({
                        message: 'Found report model instance, will look for store and supplier model',
                        response,
                        messageId
                    });
                    return db.collection('StockOrderLineitemModel').find({
                        reportModelId: ObjectId(payload.reportModelId)
                    }).toArray();
                })
                .catch(function (error) {
                    logger.error({
                        message: 'Could not find line items',
                        reportModelId,
                        error,
                        commandName,
                        messageId
                    });
                    return Promise.reject('Could not find line items');
                })
                .then(function (response) {
                    stockOrderLineItemModels = response;
                    logger.debug({
                        message: 'Found line items',
                        count: response.length,
                        response,
                        commandName,
                        messageId
                    });
                    return db.collection('ReportModel').updateOne({
                        _id: ObjectId(reportModelId)
                    }, {
                        $set: {
                            state: utils.REPORT_STATES.RECEIVING
                        }
                    });
                })
                .then(function (response) {
                    logger.debug({
                        message: 'Updated report model status to receiving',
                        response,
                        messageId
                    });
                    return Promise.map(stockOrderLineItemModels, function (eachLineItem) {
                        if (eachLineItem.receivedQuantity) {
                            return utils.updateStockOrderLineitemForVend(db, reportModelInstance, eachLineItem, messageId);
                        }
                        else {
                            return utils.deleteStockOrderLineitemForVend(db, eachLineItem, messageId);
                        }
                    });
                })
                .catch(function (error) {
                    logger.error({
                        commandName,
                        error,
                        reason: error,
                        message: 'Could not update receiving quantities for line item',
                        messageId
                    });
                    return Promise.reject('Could not update receiving quantities for line item');
                })
                .then(function (result) {
                    logger.debug({
                        message: 'Updated stock order line item models receiving quantities in Vend, will mark order as received in Vend',
                        result,
                        commandName,
                        messageId
                    });
                    return utils.markStockOrderAsReceived(db, reportModelInstance, messageId);
                })
                .catch(function (error) {
                    logger.error({
                        error,
                        message: 'Could not mark stock order as received in Vend',
                        messageId,
                        reason: error
                    });
                    return Promise.reject('Could not mark stock order as received in Vend');
                })
                .then(function (updatedOrder) {
                    logger.debug({
                        message: 'Marked stock order as received in Vend, will update state in DB',
                        updatedOrder,
                        messageId
                    });
                    return db.collection('ReportModel').updateOne({
                        _id: ObjectId(reportModelId)
                    }, {
                        $set: {
                            state: utils.REPORT_STATES.COMPLETE
                        }
                    });
                })
                .catch(function (error) {
                    logger.error({
                        message: 'Could not report state to complete in DB',
                        error,
                        commandName,
                        messageId,
                        reportModelId
                    });
                    return Promise.reject('Could not report state to complete in DB');
                })
                .then(function (result) {
                    logger.debug({
                        message: 'Updated report state to COMPLETE in DB, will update non-received line items quantity to 0',
                        reportModelId,
                        commandName,
                        messageId,
                        result
                    });
                    return db.collection('StockOrderLineitemModel').updateMany({
                        reportModelId: reportModelId,
                        received: false
                    }, {
                        $set: {
                            receivedQuantity: 0
                        }
                    });
                })
                .catch(function (error) {
                    logger.error({
                        message: 'Could not update non-received line items quantity to 0, will continue anyway because they have received boolean set to false',
                        error,
                        commandName,
                        messageId,
                        reason: error
                    });
                    return Promise.resolve('Could not update non-received line items quantity to 0, will continue anyway because they have received boolean set to false');
                })
                .then(function (result) {
                    var options = {
                        method: 'POST',
                        uri: utils.API_URL + '/api/OrgModels/' + orgModelId + '/sendWorkerStatus',
                        json: true,
                        headers: {
                            'Authorization': payload.loopbackAccessToken.id,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Accept-Charset': 'UTF-8'
                        },
                        body: {
                            messageId: messageId,
                            userId: payload.loopbackAccessToken.userId,
                            data: {
                                success: true
                            }
                        }
                    };
                    logger.debug({
                        commandName: commandName,
                        message: 'Marked order as RECEIVED in Vend, will send the status to worker',
                        result,
                        messageId,
                        options
                    });
                    return rp(options);
                })
                .catch(function (error) {
                    logger.error({
                        commandName: commandName,
                        message: 'Could not mark order as RECEIVED in Vend, will send the following status',
                        reason: error,
                        messageId
                    });
                    var options = {
                        method: 'POST',
                        uri: utils.API_URL + '/api/OrgModels/' + orgModelId + '/sendWorkerStatus',
                        json: true,
                        headers: {
                            'Authorization': payload.loopbackAccessToken.id
                        },
                        body: {
                            messageId: messageId,
                            userId: payload.loopbackAccessToken.userId,
                            data: {
                                success: false
                            }
                        }
                    };
                    var slackMessage = 'Generate purchase order Vend Worker failed for reportModelId ' + reportModelId + '\n taskId' +
                        ': ' + taskId + '\nMessageId: ' + messageId;
                    utils.sendSlackMessage('Worker failed', slackMessage, false);
                    return rp(options);
                })
                .catch(function (error) {
                    logger.error({
                        message: 'Could not send status to server',
                        error,
                        commandName,
                        messageId
                    });
                    return Promise.reject('Could not send status to server')
                })
                .then(function (res) {
                    logger.debug({
                        message: 'Successfully sent worker status to server',
                        res,
                        commandName,
                        messageId
                    });
                    return Promise.resolve('Successfully sent worker status to server');
                })
                .finally(function () {
                    logger.debug({
                        commandName: commandName,
                        message: 'Closing database connection',
                        messageId
                    });
                    if (db) {
                        return db.close();
                    }
                    return Promise.resolve();
                })
                .catch(function (error) {
                    logger.error({
                        commandName: commandName,
                        message: 'Could not close db connection',
                        err: error,
                        messageId
                    });
                    return Promise.resolve();
                    //TODO: set a timeout, after which close all listeners
                });
        }
        catch (e) {
            logger.error({
                commandName: commandName, message: '2nd last catch block', err: e,
                messageId
            });
            throw e;
        }
    }
    catch (e) {
        logger.error({
            message: 'last catch block', err: e,
            messageId
        });
        throw e;
    }
};


module.exports = {
    run: runMe
};
