"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const url = require("url");
const fs = require("fs");
const path = require("path");
const progress = require('request-progress');
const R = require('ramda');
class Downloader {
    download(downloadurl, option, throttle = 0) {
        let link = url.parse(downloadurl);
        option = R.merge({
            url: downloadurl,
            resume: true,
            method: 'GET',
            headers: {},
            output: {
                path: '/tmp',
                filename: link.pathname.split('/').pop()
            }
        }, option);
        const outputfilename = path.resolve(R.path(['output', 'path'], option), R.path(['output', 'filename'], option));
        console.log('outputfilename: '+ outputfilename);
        const supportRanges = new Promise(function (resolve, reject) {
            electron_1.net.request({
                method: 'HEAD',
                host: link.hostname,
                path: link.path,
                port: Number(link.port),
            }, function (req) {
                resolve({
                    resume: 'accept-ranges' in req.headers,
                    contentLength: req.headers['content-length'],
                });
            })
                .on('aborted', () => { reject('The request has been aborted by the server.'); })
                .end();
        });
        const blockSize = new Promise(function (resolve, reject) {
            fs.exists(outputfilename, function (exists) {
                if (exists) {
                    fs.stat(outputfilename, function (err, stat) {
                        resolve(stat.size);
                    });
                }
                else {
                    resolve(0);
                }
            });
        });
        return Promise.all([supportRanges, blockSize])
            .then(function (answer) {
            const resume = answer[0]['resume'];
            const contentLength = answer[0]['contentLength'];
            const bytes = answer[1];
            if (contentLength <= bytes)
                throw new Error('file is done');
            option.resume = option.resume && resume;
            var ses = electron_1.session.fromPartition('downloader', { cache: false });
            console.log('Downloader.download => throttle: ' + throttle);
            ses.disableNetworkEmulation();
            ses.enableNetworkEmulation({
                downloadThroughput: parseInt(throttle),
            });
            option.session = ses;
            
            if (option.resume) {
                option.headers['Range'] = `bytes=${bytes}-${contentLength}`;
            }


            return option;
        }).then(function (option) {
            return {
                request: progress(electron_1.net.request(option)),
                stream: fs.createWriteStream(outputfilename, { flags: option.resume ? 'a' : 'w', autoClose: true }),
                session: option.session
            };
        });
    }
}
exports.Downloader = Downloader;

//# sourceMappingURL=downloader.js.map
