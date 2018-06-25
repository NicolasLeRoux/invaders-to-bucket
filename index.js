const request = require('request');
const Storage = require('@google-cloud/storage');
const { Subject, from } = require('rxjs');
const { map, mergeMap } = require('rxjs/operators');

const uuid = process.argv[2];
if (!uuid) {
    throw new Error('The UUID params is needed. Ex: `npm start -- $UUID`');
}

const projectId = 'geosaic-207514';
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

query(uuid)
    .pipe(
        map(json => json.invaders),
        mergeMap(invaders => from(Object.values(invaders)))
    )
    .subscribe(data => {
        console.log(data);
    }, error => {
        console.log(error);
    });
