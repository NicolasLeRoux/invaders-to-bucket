const request = require('request');
const Storage = require('@google-cloud/storage');
const { Subject, from } = require('rxjs');
const { map, mergeMap, take, concatMap, tap } = require('rxjs/operators');
const fs = require('fs');
const path = require('path');

const uuid = process.argv[2];
if (!uuid) {
    throw new Error('The UUID params is needed. Ex: `npm start -- $UUID`');
}

const projectId = 'geosaic-207514';
const bucketName = 'geosaic-207514-invaders';
const storage = new Storage({
    projectId,
    keyFilename: 'keyfile.json'
});

/**
 * Method to query the invaders end-point.
 * @param id The user UUID
 * @return An observable of the response
 */
const query = function (id) {
    const url = `http://space-invaders.com/api/flashesV2/?uid=${id}`;
    const subj = new Subject();

    request.get(url, function (error, response, body) {
        const json = JSON.parse(body);

        if (json.code !== 0) {
            throw new Error(`Server response with an error: '${json.message}'.`);
        }

        subj.next(json);
    });

    return subj.asObservable();
}

/**
 * Method to download a given invader.
 * @param invader The invader to download
 * @return An observable of the response
 */
const download = function (invader) {
    const fileName = path.join(__dirname, `tmp/${invader.name}.jpg`);
    const subj = new Subject();

    request.get(invader.image)
        .pipe(fs.createWriteStream(fileName))
        .on('close', () => {
            subj.next(Object.assign({}, invader, {fileName}));
        });

    return subj.asObservable();
}

/**
 * Method to upload a given invader on a bucket.
 */
const upload = function (invader, bucket) {
    const subj = new Subject();

    storage
        .bucket(bucket)
        .upload(invader.fileName)
        .then(() => {
            subj.next(invader);
        });

    return subj.asObservable();
}

query(uuid)
    .pipe(
        tap(() => {
            const dir = path.join(__dirname, 'tmp/');

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }
        }),
        map(json => json.invaders),
        mergeMap(invaders => from(Object.values(invaders))),
        mergeMap(invader => download(invader)),
        mergeMap(invader => upload(invader, bucketName))
    )
    .subscribe(invader => {
        console.log(`The mosaic '${invader.name}' have been saved !`);
    }, error => {
        console.log(error);
    });
