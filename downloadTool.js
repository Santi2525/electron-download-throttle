// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const minimist = require('minimist')
const electron = require('electron')
const fse = require("fs-extra")
const path = require("path");
const downloader_1 = require("./downloader");

// Module to control application life.
const app = electron.app
const session = electron.session
const network = electron.network
const ipcMain = electron.ipcMain;

var url = '';
var throttle = 0;

let mainWindow
let self = this;

let _req

function stopDownload() {
    if (_req) _req.request.abort('User canceled');
}

function clearDownload(url2) {
    stopDownload();
    var target = targetPath(url2);
    var temp = tempPath(url2);

    if (fse.existsSync(target)) {
        fse.unlinkSync(target)
    }

    if (fse.existsSync(temp)) {
        fse.unlinkSync(temp)
    }
}

function targetPath() {
    return path.join(process.cwd(), url.split('/').pop());
}

function tempPath() {
    return targetPath() + ".download";
}

function download() {

    writeProgress("download ()")
    let self = this;
    return new Promise((resolve, reject) => {
        var tempDownload = tempPath();
        var targetFile = targetPath();
        writeProgress('url: ' + tempDownload);
        writeProgress('dest: ' + tempDownload);
        writeProgress('throttle: ' + throttle);
        
        let option = {
            resume: true,
            output: {
                path: path.join(tempDownload),
                filename: ''
            },
        };        
               
        let downloader = new downloader_1.Downloader();
        let unlinkAndReject = ((msg) => () => {
            fse.unlink(tempDownload);
            reject(msg);
        });
        downloader.download(url, option, throttle).then(req => {
            _req = req;
            let stream = req.stream;
            let progress = true;

            req.request.on('error', unlinkAndReject('HTTP request error'));
            req.request.on('abort', () => {
                stream.close();
            });

            req.request.on('response', (response) => {
                if (response.statusCode !== 200 && response.statusCode !== 206) {
                    return reject(`Error response from server: ${response.statusCode.toString()}`);
                }

                response.on("error", (err) => {
                    writeProgress('Error' + err);
                })

                response.pipe(stream);
                response.on('end', () => {
                    done();
                });
                let streamDone = false;
                stream.on('close', () => {
                    streamDone = true;
                    return resolve(true);
                });
                setTimeout(() => {
                    if (!streamDone) {
                        // writeProgress('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  [Deployment] Reset Bandwidth');
                        // req.session.disableNetworkEmulation();
                        // req.session.enableNetworkEmulation({
                        //     downloadThroughput: parseInt(throttle),
                        // });
                        writeProgress('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  [Deployment] Download Timeout');
                        req.request.abort();
                        // stream.close();
                        resolve(false);
                    }
                }, 10 * 60 * 1000); // 10 minutes
            });
            
            req.request.on('progress', function (state) {
                
                    let date = new Date();
                    writeProgress(date);
                    writeProgress('progress:' + JSON.stringify(state));
                
            });
            req.request.on('close', () => {
                progress = false;
            });
            stream.on('error', unlinkAndReject('Could not save file'));
            req.request.end();
        }).catch(e => {
            if (e.message === 'file is done') {
                writeProgress('[Deployment] Download is already completed');
                done();
                resolve(true);
            }
            else {
                writeProgress(e);
                unlinkAndReject(e);
            }
        });
    });
}

function writeProgress(text) {
    // console.log(text);
    self.mainWindow.webContents.send('progress', text);
}

function done() {
    if (fse.existsSync(tempPath())) { 
        fse.renameSync(tempPath(), targetPath());
    }
    
    writeProgress('[Deployment] Download completed');
    self.mainWindow.webContents.send('done');
}

module.exports = {
    startDownloadWithDelay: function(minutes, url2, bandwidth2, mainWindow) {
        url = url2;
        throttle = bandwidth2;
        self.mainWindow = mainWindow;
        let date = new Date();
        writeProgress(date);
        writeProgress(`Wait minutes: ${minutes}`);
        myVar = setTimeout(download, minutes * 60 * 1000); //milliseconds.
    }, stopDownload, clearDownload
};