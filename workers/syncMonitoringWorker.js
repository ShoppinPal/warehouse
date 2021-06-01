"use strict";

const logger = require('sp-json-logger')({fileName: 'workers:syncMonitoringWorker'});
const sql = require('mssql');
const bluebird = require('bluebird');
const utils = require('./jobs/utils/utils');
global.Promise = bluebird;


const CHECK_INTERVAL_MINUTES = process.env.CHECK_INTERVAL_MINUTES;

/**
 * Sql Config to connect to mssql
 * @type {sql.ConnectionPool}
 */
const sqlConfig = new sql.ConnectionPool({
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    server: process.env.AZURE_SQL_SERVER, // You can use 'localhost\\instance' to connect to named instance
    database: process.env.AZURE_SQL_DB,
    connectionTimeout: 120000,
    requestTimeout: 120000,
    options: {
        encrypt: true // Use this if you're on Windows Azure
    }
});

/**
 * List of tables that are synced to mongo
 * @type {string[]}
 */
const tableNamesSQLToMongoCheck = [
    'EcoResProductV2Staging',
    'HSInventSumStaging',
    'HSPRODUCTSYNCTABLEStaging',
    'RetailTransactionSalesLineStaging',
    'RetailTransactionStaging'
];

/**
 * List of all tables available in MS SQL
 * @type {*[]}
 */
const tableNamesMsdToSQLCheck = tableNamesSQLToMongoCheck
    .slice()
    .concat('HSInventDimStaging');

/**
 * checkMsdToMsSQL
 *  checks if all tables have entries for last 24 hours
 *  MSD Sync happens every day
 * @param sqlPool
 * @returns {boolean} - true is sync was successful for each table
 */
function checkMsdToMsSQL(sqlPool) {
    const promises = tableNamesMsdToSQLCheck
        .map(function (tableName) {
            return sqlPool.request()
                .query(`

                    SELECT
                        CAST(
                            CASE WHEN COUNT(SYNCSTARTDATETIME) > 0 THEN 1 ELSE 0 END AS BIT
                        ) AS result
                    FROM
                        ${tableName}
                    WHERE
                        SYNCSTARTDATETIME > DATEADD(
                            HOUR,
                            -24,
                            GETDATE()
                        )
                    `);
        });

    return Promise
        .all(promises)
        .then(function (results){
            const wasSuccessful = results.every(function (result) {
                return result.recordset[0].result;
            });
            return Promise.resolve(wasSuccessful);
        });

}

/**
 * checkMsSQLToMongoSync
 *  checks if MsSql data is transferred to mongo for all tables
 * @param sqlPool
 * @returns {boolean} - true is sync was successful for each table
 */
function checkMsSQLToMongoSync(sqlPool) {
    const promises = tableNamesSQLToMongoCheck
        .map(function (tableName) {
            return sqlPool.request()
                .query(`
                    SELECT
                        -- return true if success
                        CAST(
                            CASE WHEN COUNT(SYNCSTARTDATETIME) > 0 THEN 1 ELSE 0 END AS BIT
                        ) AS result
                    FROM
                        ${tableName}
                    WHERE
                        --Check only LAST 24 hours Records
                        SYNCSTARTDATETIME > DATEADD(
                            HOUR,
                            -24,
                            GETDATE()
                        )
                        -- Stock Transfer 1 means transfered
                        AND STOCKUPTRANSFER = 1
                    `);
        });

    return Promise
        .all(promises)
        .then(function (results){
            const wasSuccessful = results.every(function (result) {
                return result.recordset[0].result;
            });
            return Promise.resolve(wasSuccessful);
        });

}

/**
 * Checks that both syncs are working fine
 * - MSD -> MSSQL
 * - MSSQL -> Mongo
 */
function checkSync() {
    var sqlPool;
    var checkStartTime = new Date();
    return Promise.resolve()
        .then(function () {
            logger.debug({
                message: 'Connecting to MS SQL on Azure'
            });
            return sqlConfig.connect(sqlConfig);
        })
        .catch(function (error) {
            logger.error({
                message: 'Could not connect to MS SQL on Azure',
                error,
            });
            return Promise.reject(error);
        })
        .then(function (pool) {
            sqlPool = pool;
            // Check MSD <-> mssql
            return checkMsdToMsSQL(sqlPool);

        })
        .catch(function (error) {
            logger.error({
                message: 'Could not get status for MSD - MSSQL Sync',
                error,
            });
            return Promise.reject(error);
        })
        .then(function (wasSyncSuccess) {
            logger.debug({
                message: 'Got Query Result for  MSD - MSSQL Sync',
                wasSyncSuccess
            });
            if (!wasSyncSuccess) {
                logger.info({
                    message: 'MSD - MSSQL Sync was not successful in last 24 Hours',
                });
                utils.sendSlackMessage('Sync was not successful',
                        'MSD - MSSQL Sync was not successful in last 24 Hours' +
                    '\n Check Time: ' + checkStartTime.toDateString()
                );
            }

            return checkMsSQLToMongoSync(sqlPool);

        })
        .catch(function (error) {
            logger.error({
                message: 'Could not get status for MSSQL - Mongo Sync',
                error,
            });
            return Promise.reject(error);
        })
        .then(function (wasSyncSuccess) {
            logger.debug({
                message: 'Got Query Result for  Mongo - MSSQL Sync',
                wasSyncSuccess
            });
            if (!wasSyncSuccess) {
                logger.error({
                    message: 'MSSQL - Mongo Sync was not successful in last 24 Hours',
                    wasSyncSuccess
                });
                utils.sendSlackMessage('Sync was not successful',
                    'MSSQL - Mongo Sync was not successful in last 24 Hours' +
                    '\n Check Time: ' + checkStartTime.toDateString()
                );
            }
            if (sqlPool) {
                return sqlPool.close();
            } else {
                return Promise.resolve();
            }
        })
        // Catch any error and dont let the process exit
        .catch(function (error) {
            logger.error({
                message: 'Could not get status for MSD - MSSQL Sync',
                error,
            });
            return Promise.resolve();
        })
        .then(function () {
            logger.debug({
                message: 'Will wait for some time before next check',
            });
            // Run the function again
            return Promise.delay(CHECK_INTERVAL_MINUTES * 60 * 1000);

        })
        .then(function () {
            return checkSync();
        });
}

// Start Sync Task
checkSync();
