import chalk from 'chalk';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Storage, File } from '@google-cloud/storage';
import request = require('request');
process.env.GOOGLE_APPLICATION_CREDENTIALS = './dev-assets/cloud-storage-key.json';

export function printConsoleStatus(message: string, status: 'danger' | 'success' | 'warning' | 'info', indent: number = 0): void {
    let emoji = (status == 'danger') ? '  ❗' : (status == 'success') ? ' ✅ ' : (status == 'warning') ? ' ⚠️ ' : ' ️️💁 ';
    const color = (status == 'danger') ? chalk.redBright : (status == 'success') ? chalk.greenBright : (status == 'warning') ? chalk.yellowBright : chalk.whiteBright;
    console.log(color(Array(indent).fill('\s').join('') + `| ${emoji}  | ${message}`));
}

function getCurrentBranch(): branches {
    const gitBranch = execSync('git branch').toString() as branches;
    return (
        gitBranch.includes('master-all') ? 'master-all' :
            gitBranch.includes('master') ? 'master' :
                gitBranch.includes('insiders') ? 'insiders' : 'stable'
    );
}

export type buckets = 'quarkjs-release-insiders' | 'quarkjs-builds' | 'quarkjs-auto-update';
export type branches = 'master' | 'master-all' | 'insiders' | 'stable';
export type releaseType = 'nightly' | 'nightly-all' | 'insiders' | 'stable';
export type storageUrl = 'https://quark-build-nightly.quarkjs.io' | 'https://quark-build-nightly-all.quarkjs.io' | 'https://quark-build-insiders.quarkjs.io' | 'https://quark-build-stable.quarkjs.io';
export type bucketName = 'quark-build-nightly.quarkjs.io' | 'quark-build-nightly-all.quarkjs.io' | 'quark-build-insiders.quarkjs.io' | 'quark-build-stable.quarkjs.io';

export const metaData: {
    [key in branches]: {
        type: releaseType;
        autoUpdateUrl: storageUrl;
        bucketName: bucketName;
    }
} = {
    'master': {
        type: 'nightly',
        autoUpdateUrl: 'https://quark-build-nightly.quarkjs.io',
        bucketName: 'quark-build-nightly.quarkjs.io'
    },
    'master-all': {
        type: 'nightly-all',
        autoUpdateUrl: 'https://quark-build-nightly-all.quarkjs.io',
        bucketName: 'quark-build-nightly-all.quarkjs.io'
    },
    'insiders': {
        type: 'insiders',
        autoUpdateUrl: 'https://quark-build-insiders.quarkjs.io',
        bucketName: 'quark-build-insiders.quarkjs.io'
    },
    'stable': {
        type: 'stable',
        autoUpdateUrl: 'https://quark-build-stable.quarkjs.io',
        bucketName: 'quark-build-stable.quarkjs.io'
    }
};

export const currentBranch: branches = process.env.APPVEYOR_REPO_BRANCH || process.env.TRAVIS_BRANCH || getCurrentBranch() as any;

export function getFilesForVersion(version: number, type: typeof process.platform) {
    if (type == 'win32') {
        return [
            `./build/Quark-win-${version}.exe`,
            `./build/Quark-win-${version}.exe.blockmap`,
            `./build/Quark-win-x64-${version}.zip`,
            `./build/Quark-win-x64-${version}.msi`,
            './build/latest.yml'
        ];
    }

    if (type == 'linux') {
        return [
            `./build/Quark-linux-amd64-${version}.deb`,
            `./build/Quark-linux-x64-${version}.tar.gz`,
            `./build/Quark-linux-x86_64-${version}.AppImage`,
            `./build/latest-linux.yml`
        ];
    }
}

const storage = new Storage({
    projectId: 'diy-mechatronics'
});
export function uploadFilesToBucket(bucketName: string, version: number, paths: string[], allowFailFiles: boolean) {


    paths.map((_path) => {
        if (fs.existsSync(_path)) {
            const file = storage.bucket(bucketName).file(`Quark-${version}/${_path.endsWith('txt') ? (process.platform + '-' + path.basename(_path)) : path.basename(_path)}`);
            fs.createReadStream(_path)
                .pipe(file.createWriteStream())
                .on('error', function (err) {
                    if (err) {
                        console.error(err);
                        printConsoleStatus(`Error uploading: ${_path}`, 'danger');
                    }
                })
                .on('finish', function () {
                    printConsoleStatus(`Finished file: ${_path}`, 'success');
                });
            return;
        }


        printConsoleStatus(`File not found: ${_path}; Allow faliure: ${allowFailFiles};`, 'danger');
        if (!allowFailFiles) {
            throw Error(`File not found: ${_path}`);
        }
    });
}

export async function doBucketTransfer(copyFromBucket: bucketName, copyToBucket: bucketName, folderName: string) {
    const folders = await storage.bucket(copyFromBucket).getFiles();

    const destBucket = storage.bucket(copyToBucket);
    const filesToCopy: Promise<[File, request.Response]>[] = [];

    folders.filter((folder) => {
        folder.map((file) => {
            if (file.name.includes(folderName)) {
                filesToCopy.push(file.copy(destBucket.file(file.name)));
            }
        });
    });

    await Promise.all(filesToCopy);
}

export async function copyContentsToRoot(bucketName: bucketName, folder: string) {
    const currentVersionFiles: File[] = [];
    const filesToDelete: File[] = [];
    storage.bucket(bucketName).getFiles().then(async (folders) => {
        folders.map((folder) => {
            folder.map((file) => {
                if (!file.name.includes('/') && !file.name.toLocaleLowerCase().match(/(appimage|blockmap)/)) {
                    filesToDelete.push(file);
                }

                if (!file.name.includes(`${folder}/`)) {
                    return;
                }

                currentVersionFiles.push(file);
            });
        });

    });
    
    const promises: Promise<any>[] = currentVersionFiles.map((file) => {
        return file.copy(file.name.replace(`${folder}/`, ''));
    });

    promises.concat(filesToDelete.map((file) => {
        return file.delete();
    }));

    await Promise.all(promises);
}