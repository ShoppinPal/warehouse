'use strict';

var Promise = require('bluebird');
const path = require('path');
const fileName = path.basename(__filename, '.js'); // gives the filename without the .js extension
const logger = require('sp-json-logger')({fileName: 'common:models:' + fileName});
var _ = require('underscore');
var Joi = Promise.promisifyAll(require('joi'));
var validate = Promise.promisify(require('joi').validate);
var vendSdk = require('vend-nodejs-sdk')({});
const rp = require('request-promise');
var SSE = require('express-sse');
var sseMap = {};

module.exports = function (OrgModel) {


    OrgModel.on('dataSourceAttached', function (obj) {

        // wrap the whole model in Promise
        // but we need to avoid 'validate' method
        OrgModel = Promise.promisifyAll(
            OrgModel,
            {
                filter: function (name, func, target) {
                    return !( name == 'validate');
                }
            }
        );

        OrgModel.remoteMethod('fetchAuthorizationUrl', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'integrationType', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/fetchAuthorizationUrl', verb: 'get'},
            returns: {arg: 'authorizationUrl', type: 'string'}
        });

        OrgModel.fetchAuthorizationUrl = function (id, integrationType, options, cb) {
            logger.debug({
                message: 'Will fetch authorization Url for integrationType',
                integrationType,
                functionName: 'fetchAuthorizationUrl',
                options
            });
            return OrgModel.app.models.IntegrationModel.fetchAuthorizationUrl(integrationType, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Error fetching authorization url for integration type',
                        integrationType,
                        functionName: 'fetchAuthorizationUrl',
                        options
                    });
                    return Promise.reject(error);
                });
        };

        OrgModel.remoteMethod('handleVendToken', {
            accepts: [
                {arg: 'code', type: 'string'},
                {arg: 'domain_prefix', type: 'string'},
                {arg: 'state', type: 'string'},
                {arg: 'error', type: 'string'},
            ],
            http: {path: '/handleVendToken', verb: 'get'},
            returns: {arg: 'token', type: 'string'}
        });

        //If someone changes this url, also remember to change it in Vend and IntegrationModel.fetchIntegrationUrl()
        OrgModel.handleVendToken = function (code, domainPrefix, state, error) {
            logger.debug({
                message: 'Received this token from Vend',
                code,
                domainPrefix,
                state,
                functionName: 'handleVendToken'
            });
            if (error) {
                logger.error({
                    err: error,
                    message: 'Error in oauth with vend',
                    functionName: 'handleVendToken'
                });
                return Promise.reject(error);
            }
            else {
                var vendConfig = OrgModel.app.get('integrations').vend;
                var vendToken;
                return vendSdk.getInitialAccessToken(
                    'https://' + domainPrefix + vendConfig.token_service,
                    vendConfig.client_id,
                    vendConfig.client_secret,
                    OrgModel.app.get('site').baseUrl + '/api/OrgModels/handleVendToken',
                    code,
                    domainPrefix,
                    state
                )
                    .catch(function (error) {
                        logger.error({
                            error,
                            message: 'Error in fetching access token from vend',
                            functionName: 'handleVendToken'
                        });
                        return Promise.reject(error);
                    })
                    .then(function (response) {
                        logger.debug({
                            message: 'Fetched access token and refresh token, will store in org model',
                            functionName: 'handleVendToken'
                        });
                        if (response && response.access_token) {
                            vendToken = response;
                            vendToken.type = 'vend';
                            logger.debug({
                                message: 'Looking for the user and org for access token stored in state param'
                            });
                            return OrgModel.app.models.AccessToken.findById(state);
                        }
                        else {
                            logger.error({
                                message: 'Some error in fetching access token',
                                functionName: 'handleVendToken'
                            });
                            return Promise.reject('Some error in fetching access token');
                        }
                    })
                    .catch(function (error) {
                        logger.error({
                            error,
                            message: 'Error in validating access token from state param',
                            functionName: 'handleVendToken'
                        });
                        return Promise.reject(error);
                    })
                    .then(function (accessToken) {
                        logger.debug({
                            message: 'Found access token current user',
                            accessToken,
                            functionName: 'handleVendToken'
                        });
                        return OrgModel.app.models.UserModel.findById(accessToken.userId);
                    })
                    .then(function (userModelInstance) {
                        logger.debug({
                            message: 'Found user from access token',
                            userModelInstance,
                            functionName: 'handleVendToken'
                        });
                        vendToken.orgModelId = userModelInstance.orgModelId;
                        return OrgModel.app.models.IntegrationModel.create(vendToken);
                    })
                    .catch(function (error) {
                        logger.error({
                            error,
                            message: 'Error in storing access token received from vend',
                            functionName: 'handleVendToken'
                        });
                        return Promise.reject(error);
                    });
            }
        };

        OrgModel.afterRemote('handleVendToken', function (context, remoteMethodOutput, next) {
            logger.debug({
                message: 'Handled vend token, now will redirect to connect POS/ERP page',
                functionName: 'handleVendToken:afterRemote'
            });
            context.res.redirect(301, '/v2/#/connect');
        });

        OrgModel.remoteMethod('handleMSDToken', {
            accepts: [
                {arg: 'code', type: 'string'},
                {arg: 'session_state', type: 'string'},
                {arg: 'state', type: 'string'},
                {arg: 'error', type: 'string'},
                {arg: 'error_description', type: 'string'}
            ],
            http: {path: '/handleMSDToken', verb: 'get'},
            returns: {arg: 'token', type: 'string'}
        });
        //If someone changes this url, also remember to change it in MSD and IntegrationModel.fetchIntegrationUrl()
        OrgModel.afterRemote('handleMSDToken', function (context, remoteMethodOutput, next) {
            logger.debug({
                message: 'Handled MSD token, now will redirect to connect POS/ERP page',
                functionName: 'handleMSDToken:afterRemote'
            });
            context.res.redirect(301, '/v2/#/connect');
        });

        //If someone changes this url, also remember to change it in MSD and IntegrationModel.fetchIntegrationUrl()
        OrgModel.handleMSDToken = function (code, sessionState, state, error, errorDescription) {
            logger.debug({
                message: 'Received this token from MSD',
                code,
                sessionState,
                state,
                functionName: 'handleMSDToken'
            });
            if (error) {
                return Promise.reject({
                    error: error,
                    errorDescription: errorDescription
                });
            }
            else {
                var msdConfig = OrgModel.app.get('integrations').msDynamics;
                var msdToken;
                return rp({
                    method: 'POST',
                    uri: msdConfig.token_endpoint,
                    form: {
                        grant_type: 'authorization_code',
                        client_id: msdConfig.client_id,
                        code: code,
                        redirect_uri: OrgModel.app.get('site').baseUrl + '/api/OrgModels/handleMSDToken',
                        client_secret: msdConfig.client_secret,
                        resource: 'https://lmmyuat.sandbox.operations.dynamics.com/'
                    }
                })
                    .then(function (response) {
                        logger.debug({
                            message: 'Fetched access token and refresh token, will store in org model',
                            response: JSON.parse(response),
                            functionName: 'handleMSDToken'
                        });
                        response = JSON.parse(response);
                        if (response && response.access_token) {
                            msdToken = response;
                            msdToken.type = 'msdynamics';
                            logger.debug({
                                message: 'Looking for the user and org for access token stored in state param',
                                functionName: 'handleMSDToken'
                            });
                            return OrgModel.app.models.AccessToken.findById(state);
                        }
                        else {
                            logger.error({
                                message: 'Some error in fetching access token',
                                functionName: 'handleMSDToken'
                            });
                            return Promise.reject('Some error in fetching access token');
                        }
                    }, function (error) {
                        logger.error({
                            error: JSON.stringify(error),
                            message: 'Error in fetching access token from MSD',
                            functionName: 'handleMSDToken'
                        });
                        return Promise.reject(error);
                    })
                    .catch(function (error) {
                        logger.error({
                            error,
                            message: 'Error in validating access token from state param',
                            functionName: 'handleMSDToken'
                        });
                        return Promise.reject(error);
                    })
                    .then(function (accessToken) {
                        logger.debug({
                            message: 'Found access token current user',
                            accessToken,
                            functionName: 'handleMSDToken'
                        });
                        return OrgModel.app.models.UserModel.findById(accessToken.userId);
                    })
                    .then(function (userModelInstance) {
                        logger.debug({
                            message: 'Found user from access token',
                            userModelInstance,
                            functionName: 'handleMSDToken'
                        });
                        msdToken.orgModelId = userModelInstance.orgModelId;
                        return OrgModel.app.models.IntegrationModel.create(msdToken);
                    })
                    .catch(function (error) {
                        logger.error({
                            error,
                            message: 'Error in storing access token received from MSD',
                            functionName: 'handleMSDToken'
                        });
                        return Promise.reject(error);
                    });
            }
        };

        OrgModel.remoteMethod('initiateVendSync', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/initiateVendSync', verb: 'get'},
            returns: {arg: 'syncStatus', type: 'boolean'}
        });

        OrgModel.initiateVendSync = function (id, options, cb) {
            logger.debug({
                message: 'Will initiate sync for vend',
                options,
                functionName: 'initiateVendSync'
            });
            return OrgModel.app.models.SyncModel.initiateVendSync(id, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not initiate vend sync',
                        error
                    });
                    return Promise.reject('Could not initiate vend sync');
                });
        };

        OrgModel.remoteMethod('initiateMSDSync', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/initiateMSDSync', verb: 'get'},
            returns: {arg: 'syncStatus', type: 'boolean'}
        });

        OrgModel.initiateMSDSync = function (id, options, cb) {
            logger.debug({
                message: 'Will initiate sync for msd',
                options,
                functionName: 'initiateMSDSync'
            });
            return OrgModel.app.models.SyncModel.initiateMSDSync(id, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not initiate msd sync',
                        error
                    });
                    return Promise.reject('Could not initiate msd sync');
                });
        };

        OrgModel.remoteMethod('stopMSDSync', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/stopMSDSync', verb: 'get'},
            returns: {arg: 'status', type: 'boolean'}
        });

        OrgModel.stopMSDSync = function (id, options, cb) {
            logger.debug({
                message: 'Will stop sync for msd',
                options,
                functionName: 'stopMSDSync'
            });
            return OrgModel.app.models.SyncModel.stopMSDSync(id, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not stop msd sync',
                        error
                    });
                    return Promise.reject('Could not stop msd sync');
                });
        };

        OrgModel.remoteMethod('syncMSDUsers', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/syncMSDUsers', verb: 'get'},
            returns: {arg: 'status', type: 'boolean'}
        });

        OrgModel.syncMSDUsers = function (id, options, cb) {
            logger.debug({
                message: 'Will sync MSD users',
                options,
                functionName: 'syncMSDUsers'
            });
            return OrgModel.app.models.SyncModel.syncMSDUsers(id, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not sync MSD users',
                        error
                    });
                    return Promise.reject('Could not sync MSD users');
                });
        };

        OrgModel.remoteMethod('syncMSDStores', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/syncMSDStores', verb: 'get'},
            returns: {arg: 'status', type: 'boolean'}
        });

        OrgModel.syncMSDStores = function (id, options, cb) {
            logger.debug({
                message: 'Will sync MSD stores',
                options,
                functionName: 'syncMSDStores'
            });
            return OrgModel.app.models.SyncModel.syncMSDStores(id, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not sync MSD stores',
                        error
                    });
                    return Promise.reject('Could not sync MSD stores');
                });
        };

        OrgModel.remoteMethod('syncMSDCategories', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/syncMSDCategories', verb: 'get'},
            returns: {arg: 'status', type: 'boolean'}
        });

        OrgModel.syncMSDCategories = function (id, options, cb) {
            logger.debug({
                message: 'Will sync MSD categories',
                options,
                functionName: 'syncMSDCategories'
            });
            return OrgModel.app.models.SyncModel.syncMSDCategories(id, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not sync MSD categories',
                        error
                    });
                    return Promise.reject('Could not sync MSD categories');
                });
        };


        OrgModel.remoteMethod('updateBinLocation', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'productId', type: 'string', required: true},
                {arg: 'binLocation', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/updateBinLocation', verb: 'post'},
            returns: {arg: 'product', type: 'object'}
        });

        OrgModel.updateBinLocation = function (id, productId, binLocation, options) {
            return OrgModel.app.models.ProductModel.updateBinLocation(id, productId, binLocation, options)
                .catch(function (error) {
                    logger.error({
                        error,
                        message: 'Could not update bin location',
                        functionName: 'updateBinLocation',
                        options
                    });
                    return Promise.reject('Could not update bin location');
                });
        };

        OrgModel.remoteMethod('uploadMinMaxFile', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'req', type: 'object', 'http': {source: 'req'}},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/uploadMinMaxFile', verb: 'post'},
            returns: {arg: 'result', type: 'string'}
        });

        OrgModel.uploadMinMaxFile = function (id, req, options, cb) {
            logger.debug({
                message: 'Will upload min max file for categories',
                functionName: 'uploadMinMaxFile',
                options
            });
            return OrgModel.app.models.CategoryModel.uploadMinMaxFile(id, req, options)
                .catch(function (error) {
                    logger.debug({
                        message: 'Error processing min max file',
                        error,
                        functionName: 'uploadMinMaxFile',
                        options
                    });
                    return Promise.reject(false);
                })
        };

        OrgModel.remoteMethod('generateStockOrderMSD', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'storeModelId', type: 'string', required: true},
                {arg: 'warehouseModelId', type: 'string', required: true},
                {arg: 'categoryModelId', type: 'string'},
                {arg: 'req', type: 'object', 'http': {source: 'req'}},
                {arg: 'res', type: 'object', 'http': {source: 'res'}},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/generateStockOrderMSD', verb: 'get'},
            returns: {arg: 'data', type: 'ReadableStream', root: true}
        });

        OrgModel.generateStockOrderMSD = function (id, storeModelId, warehouseModelId, categoryModelId, req, res, options) {
            try {
                res.connection.setTimeout(0);
                if (!sseMap[options.accessToken.userId]) {
                    var sse = new SSE(0);
                    sse.init(req, res);
                    sseMap[options.accessToken.userId] = sse;
                    logger.debug({
                        options,
                        message: 'Created sse for user',
                        functionName: 'generateStockOrderMSD'
                    });
                }
                else {
                    sseMap[options.accessToken.userId].init(req, res);
                    logger.debug({
                        options,
                        message: 'SSE exists for this user, will move on',
                        functionName: 'generateStockOrderMSD'
                    });
                }
            }
            catch (e) {
                logger.error({
                    e,
                    options,
                    message: 'Error creating SSE',
                    functionName: 'generateStockOrderMSD'
                });
            }
            OrgModel.app.models.ReportModel.generateStockOrderMSD(id, storeModelId, warehouseModelId, categoryModelId, options)
                .catch(function (error) {
                    logger.error({
                        error,
                        message: 'Could not initiate stock order generation',
                        functionName: 'generateStockOrderMSD',
                        options
                    });
                    return Promise.reject('Could not initiate stock order generation');
                });
        };

        OrgModel.remoteMethod('sendWorkerStatus', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'userId', type: 'string', required: true},
                {arg: 'data', type: 'object'},
                {arg: 'messageId', type: 'string', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/sendWorkerStatus', verb: 'post'},
            returns: {arg: 'data', type: 'ReadableStream', root: true}
        });

        OrgModel.sendWorkerStatus = function (id, userId, data, messageId, options, cb) {
            try {
                logger.debug({
                    options,
                    message: 'This is called by worker',
                    userId,
                    data,
                    messageId,
                    functionName: 'sendWorkerStatus'
                });
                var sse = sseMap[userId];
                sse.send(data, '', messageId);
                cb(null, true);
            }
            catch (e) {
                logger.error({
                    options,
                    err: e,
                    message: 'Could not send data to client',
                    functionName: 'sendReports'
                });
                cb(e);
            }
        };

        OrgModel.remoteMethod('createTransferOrderMSD', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'reportModelId', type: 'string', required: true},
                {arg: 'req', type: 'object', 'http': {source: 'req'}},
                {arg: 'res', type: 'object', 'http': {source: 'res'}},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/createTransferOrderMSD', verb: 'GET'},
            returns: {arg: 'data', type: 'ReadableStream', root: true}
        });

        OrgModel.createTransferOrderMSD = function (id, reportModelId, req, res, options, cb) {
            logger.debug({
                message: 'Will create transfer order in MSD',
                reportModelId,
                options,
                functionName: 'createTransferOrderMSD'
            });
            res.connection.setTimeout(0);
            if (!sseMap[options.accessToken.userId]) {
                var sse = new SSE(0);
                sse.init(req, res);
                sseMap[options.accessToken.userId] = sse;
                logger.debug({
                    options,
                    message: 'Created sse for user',
                    functionName: 'createTransferOrderMSD'
                });
            }
            else {
                sseMap[options.accessToken.userId].init(req, res);
                logger.debug({
                    options,
                    message: 'SSE exists for this user, will move on',
                    functionName: 'createTransferOrderMSD'
                });
            }
            OrgModel.app.models.ReportModel.createTransferOrderMSD(id, reportModelId, options)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not create transfer order in MSD',
                        reportModelId,
                        options,
                        functionName: 'createTransferOrderMSD',
                        error
                    });
                    return Promise.reject('Could not create transfer order in MSD');
                });
        };

        OrgModel.remoteMethod('updateAllStockOrderLineItemModels', {
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'reportModelId', type: 'string', required: true},
                {arg: 'lineItemIds', type: 'array', required: true},
                {arg: 'data', type: 'object', required: true},
                {arg: 'options', type: 'object', http: 'optionsFromRequest'}
            ],
            http: {path: '/:id/updateAllStockOrderLineItemModels', verb: 'POST'},
            returns: {arg: 'status', type: 'object', root: true}
        });

        OrgModel.updateAllStockOrderLineItemModels = function (id, reportModelId, lineItemIds, data, options, cb) {
            logger.debug({
                message: 'Will update these line items for order',
                data,
                lineItemIds,
                options,
                functionName: 'updateAllStockOrderLineItemModels'
            });
            var filter = {
                orgModelId: id,
                reportModelId: reportModelId
            };
            if (lineItemIds.length) {
                filter.id = {
                    inq: lineItemIds
                };
            }
            return OrgModel.app.models.StockOrderLineitemModel.updateAll(filter, data)
                .catch(function (error) {
                    logger.error({
                        message: 'Could not update these line items',
                        lineItemIds,
                        options,
                        functionName: 'updateAllStockOrderLineItemModels',
                        error
                    });
                    return Promise.reject('Could not update stock order line items');
                });
        }

    });
};
