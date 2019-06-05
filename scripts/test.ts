import { execFile, execSync } from "child_process";
import * as fs from 'fs-extra';
import * as path from 'path';
import { printConsoleStatus } from './util';

let hasEnded: boolean = false;
const packageJSON = JSON.parse(fs.readFileSync('./package.json').toString());
const version = packageJSON.version;

runTest().catch(console.error);
async function runTest() {
    console.time('test');

    setTimeout(() => {
        if (!hasEnded) {
            exitTest();
        }
    }, 1000 * 60 * 2);

    let filePath = process.platform == 'win32' ?
        'win-unpacked/Quark.exe' : process.platform == 'linux' ?
            // 'linux-unpacked/quark' : process.platform == 'darwin' ?
            `Quark-linux-x86_64-${version}.AppImage` : process.platform == 'darwin' ?
                // 'mac/Quark.app' : null;
                `Quark-mac-${version}.dmg` : null;

    filePath.match(/(mac|dmg)/) ? macOSHandle() : null;
    if (!filePath) {
        process.exit(0);
    }

    execFile(`./build/${filePath}`, ['./test/__testing__fjdsbfkbsdibsdi__testing__testing.qrk'], (error, stdout, stderr) => {
        console.timeEnd('test');
        console.log(stdout);
        console.log(stderr);
        console.log(error);
        exitTest();
    });
}

function exitTest() {
    const filePath = './test/__testResults__/result.json';
    hasEnded = true;
    if (fs.existsSync(filePath)) {
        const result = fs.readJsonSync(filePath);
        // console.log(result, result.value, typeof result.value);
        if (result.value == true) {
            printConsoleStatus('Test successful', 'success');
            process.exit(0);
        }
    }
    printConsoleStatus('Test Failed', 'danger');
    process.exit(1);
}

function macOSHandle() {

    const result = execSync(`chmod -R 777 ./build`);
    console.log(result.toString());

    const dir = fs.readdirSync('./build').map((val) => {
        return {
            val,
            stat: fs.statSync(path.join('./build', val)).isDirectory()
        }
    })
    dir.map((val) => {
        if (val.val.endsWith('mac')) {
            console.log('val = ', fs.readdirSync(path.join('./build', val.val)));
        }
    });
    // console.log('dir = ', JSON.stringify(dir, undefined, 4));
    execSync(`ls -ls`);
}

// val =  [ 'Quark.app' ]
// dir =  [ 'Quark-mac-0.2.17.dmg',
//   'Quark-mac-0.2.17.dmg.blockmap',
//   'Quark-mac-0.2.17.zip',
//   'latest-mac.yml',
//   'mac' ]