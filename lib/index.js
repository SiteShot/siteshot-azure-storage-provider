"use strict";

const logger = require('siteshot-logger');

const azure = require('azure-storage');
const config = require('config');
const fs = require('fs');
const path = require('path');
const async = require('async');
const blobService = azure.createBlobService(config.Azure.Connection.AccountName, config.Azure.Connection.AccountKey);
const utils = require('siteshot-utils');

/**
 * Sets up the storage stuff
 * @constructor
 */
exports.Setup = function () {
    blobService.createContainerIfNotExists(config.Azure.Storage.Screenshots, {
        publicAccessLevel: 'blob'
    }, function (error, result, response) {
        if (!error) {
            if (result) {
                logger.info("Storage container created");
            }
            else {
                logger.info("Storage container already existed");
            }
        }
    });
};

/**
 * Uploads job details to Azure
 * @param job
 * @param callback
 * @constructor
 */
exports.UploadJob = function (job, callback) {
    fs.readdir(job.folder, function (err, files) {
        async.each(
            files,
            function (file, next) {
                blobService.createBlockBlobFromLocalFile(
                    config.Azure.Storage.Screenshots,
                    path.join(job.subFolder, file),
                    path.join(job.folder, file),
                    function (error, result, response) {
                        next(error);
                    }
                );
            },
            function () {
                callback();
            }
        );
    });
};

/**
 * Streams a file result
 * @param path
 * @param stream
 * @param callback
 * @constructor
 */
exports.StreamFile = function (path, stream, callback) {
    blobService.getBlobToStream(
        config.Azure.Storage.Screenshots,
        path,
        stream,
        callback
    );
};

/**
 * Pulls down job images
 * @param job
 * @param callback
 * @constructor
 */
exports.FetchFilesForJob = function (job, callback) {
    var currentScan = job.scans[0];
    var previousScan = job.scans[1];

    utils.CreateDirIfNotExists(job.folder);
    utils.CreateDirIfNotExists(path.join(job.siteFolder, previousScan._id.toString()));

    async.eachSeries(
        job.pages,
        function (page, cb) {
            async.waterfall(
                [
                    function DownloadPreviousVersion(next) {
                        page.previousImagePath = path.join(job.siteFolder, previousScan._id.toString(), utils.PageNameFromURL(page.url) + '.png');

                        SaveFileToLocal(
                            path.join(job.siteId, previousScan._id.toString(), utils.PageNameFromURL(page.url) + '.png'),
                            page.previousImagePath,
                            function () {
                                console.log(arguments);
                                next();
                            }
                        );
                    },
                    function SetupCurrentVersion(next) {
                        page.currentImagePath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.png');
                        page.diffImagePath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.diff.png');
                        page.overlayImagePath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.overlay.png');

                        next();
                    }
                ], function () {
                    cb();
                }
            );
        },
        function done() {
            callback();
        }
    );
};

/**
 * Saves a file to the local disk
 * @param remotePath
 * @param localPath
 * @param callback
 * @constructor
 */
function SaveFileToLocal(remotePath, localPath, callback) {
    blobService.getBlobToLocalFile(
        config.Azure.Storage.Screenshots,
        remotePath,
        localPath,
        callback
    );
}