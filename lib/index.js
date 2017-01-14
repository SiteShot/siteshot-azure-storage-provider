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
                logger.jobLog(job, "Uploading " + file);

                blobService.createBlockBlobFromLocalFile(
                    config.Azure.Storage.Screenshots,
                    path.join(job.subFolder, file),
                    path.join(job.folder, file),
                    function (error, result, response) {
                        logger.jobLog(job, {
                            error: error,
                            file: file
                        });

                        next(error);
                    }
                );
            },
            function (err) {
                if (err) {
                    logger.jobLog(job, "Error uploading " + err);
                }

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
                                next();
                            }
                        );
                    },
                    function SetupCurrentVersion(next) {
                        page.currentImagePath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.png');
                        page.currentImageThumbPath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.thumb.png');

                        page.diffImagePath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.diff.png');
                        page.diffImageThumbPath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.diff.thumb.png');

                        page.overlayImagePath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.overlay.png');
                        page.overlayImageThumbPath = path.join(job.folder, utils.PageNameFromURL(page.url) + '.overlay.thumb.png');

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