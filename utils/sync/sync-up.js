require('dotenv').config('./../../.env');
const { getUserIdFromToken, getSyncId } = require('../users/userFunctions');
const { pool } = require('./../../utils/db/dbConnect');
const { getDateTime } = require('./../../utils/datetime/functions');
const { uploadToS3 } = require('./../../utils/s3/uploadTag');
const { generateBuffer } = require('./sync-utils');
const { makeRandomStr } = require('./../misc/stringGenerator');

// import s3 stuff from module later
const AWS = require('aws-sdk');
const bucketName = process.env.AWS_S3_NAME;
AWS.config.update({
    region: process.env.AWS_S3_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

/**
 * The sync process goes like this:
 * create a sync_id which is just an auto incremented id(from sync_history table)
 * this is tied to the user_id
 * then the rows inserted into various tables use this sync_id.
 * Pulling down uses most recent(timestamp) and groups by that sync_id from sync_history
 */

const formatTimeStr = (timeStr) => {
    if (timeStr.indexOf('T') !== -1) {
        timeStr = timeStr.split('T').join(' ').split('.000Z').join('');
    }

    return timeStr;
}

// I think these are still safe i.e. using param = ?
// https://stackoverflow.com/questions/8899802/how-do-i-do-a-bulk-insert-in-mysql-using-node-js
const insertAddresses = async (userId, syncId, addresses) => {
    // insert all rows in one INSERT using VALUES 80-90% faster than sequential individual inserts
    pool.query(
        `INSERT INTO addresses (user_id, address, lat, lng, created, updated, sync_id) VALUES ?`,
        [
            addresses.map(addressRow => (
                [userId, addressRow.address, addressRow.lat, addressRow.lng, formatTimeStr(addressRow.created), formatTimeStr(addressRow.updated), syncId]
            ))
        ],
        (err, qres) => {
            if (err) {
                console.log('insert address', err);
                throw Error(false);
            } else {
                return true;
            }
        }
    );
}

/**
 * TODO: This should use a job queue not upload to s3 synchronously
 * I will keep this as a non-batch upload due to the s3 that's still coupled at this time
 */
const insertTags = async (userId, syncId, tags) => {
    let insertErr = false;
    for (let i = 0; i < tags.length; i++) {
        if (insertErr) {
            break; // may be pointless
        }

        const tagRow = tags[i];

        // insert to s3
        // this should be part of the module
        const buff = generateBuffer(tagRow.src);
        const uploadParams = {
            Bucket: bucketName,
            Key: userId + '_' + makeRandomStr(24) + '_' + tagRow.fileName, // this could be bad since there can be spaces in file names, although public display doesn't matter i.e. S3
            Body: buff,
            ACL: 'public-read',
            ContentEncoding: 'base64',
            ContentType: 'image/jpeg'
        };

        const s3PublicUrl = await uploadToS3(s3, uploadParams);

        // insert
        // this structure does not exactly match Dexie i.e. Dexie has the extra fileName column used for deletion on client side
        // create buffer for thumbnail src
        const thumbnailBuff = generateBuffer(tagRow.thumbnail_src.replace(/^data:image\/\w+;base64,/, ""), 'base64');
        pool.query(
            `INSERT INTO tags SET user_id = ?, file_name = ?, address_id = ?, event_id = ?, src = ?, thumbnail_src = ?,  public_s3_url= ?, meta = ?, date_time = ?, sync_id = ?`, // ehh date_time
            [userId, tagRow.fileName, tagRow.addressId, tagRow.eventId, buff, thumbnailBuff, s3PublicUrl, JSON.stringify(tagRow.meta), tagRow.datetime, syncId],
            (err, qres) => {
                if (err) {
                    console.log('insert tags', err);
                    insertErr = true;
                    throw Error(false);
                } else {
                    if (i === tags.length - 1) {
                        return true;
                    }
                }
            }
        );
    }
}

const insertOwnerInfos = async (userId, syncId, ownerInfos) => {
    pool.query(
        `INSERT INTO owner_info (user_id, address_id, form_data, sync_id) VALUES ?`,
        [
            ownerInfos.map(ownerInfoRow => (
                [userId, ownerInfoRow.addressId, JSON.stringify(ownerInfoRow.formData), syncId]
            ))
        ],
        (err, qres) => {
            if (err) {
                console.log('insert ownerInfo', err);
                throw Error(false);
            } else {
                return true;
            }
        }
    );
}

// also sequential inserts like this is probably bad i.e. for loop
const insertTagInfos = async (userId, syncId, tagInfos) => {
    // insert
    // this structure does not exactly match Dexie i.e. Dexie has the extra fileName column used for deletion on client side
    pool.query(
        `INSERT INTO tag_info (user_id, address_id, event_id, form_data, sync_id) VALUES ?`,
        [
            tagInfos.map(tagInfoRow => (
                [userId, tagInfoRow.addressId, tagInfoRow.eventId, JSON.stringify(tagInfoRow.formData), syncId]
            ))
        ],
        (err, qres) => {
            if (err) {
                console.log('insert tagInfo', err);
                throw Error(false);
            } else {
                return true;
            }
        }
    );
}

const insertEvents = async (userId, syncId, events) => {
    // tag_ids is an array in string form
    pool.query(
        `INSERT INTO events (user_id, address_id, tag_info_id, tag_ids, datetime, sync_id) VALUES ?`,
        [
            events.map(eventsRow => (
                [userId, eventsRow.addressId, eventsRow.tagInfoId, JSON.stringify(eventsRow.tagIds), eventsRow.datetime, syncId]
            ))
        ],
        (err, qres) => {
            if (err) {
                console.log('insert event', err);
                throw Error(false);
            } else {
                return true;
            }
        }
    );
}

/**
 * these are the "non-promises" eg. I don't think await does anything
 * or maybe I have it backwards, the nested promises were redundant, can't remember
 * 
 * this is decision right here, I COULD write a set of asyncs that deletes every row per table...
 * but I can just delete the addresses and leave the technically useless rows that are no longer bound to an address
 * what you can have is a background queue/job that deletes unused rows... which can open up other problems eg. "ACID"
 * but it's arguable it would take much longer to delte the rows per addresses eg. tags/taginfo/etc... vs. just deleting address rows
 * in the grand scheme performance wise and error-wise this is negligible, every sync is specifically tied/to all the data and MySQL I believe only
 * has performance issues in the millions of rows
 *
 * also if these were just ids I wouldn't have to loop... I could juse use IN
 * but the IndexedDB table does not directly line up with the ids here(they're not related at all)
 */
const deleteAddresses = async (userId, syncId, deletedAddresses) => {
    const addressesToDeleteCnt = deletedAddresses.length;
    let deletedAddressesCnt = 0;

    // recursive delete
    const deleteAddress = () => {
        if (deletedAddresses <= addressesToDeleteCnt) {
            pool.query(
                `DELETE from addresses WHERE userId = ? AND address = ? AND sync_id = ?`,
                [userId, deletedAddresses[deletedAddressesCnt], sync_id], // lol
                (err, qres) => {
                    if (err) {
                        console.log('delete address', err);
                        throw Error(false);
                    } else {
                        deletedAddressesCnt += 1;
                        deleteAddress();
                    }
                }
            );
        } else {
            return true;
        }
    }

    deleteAddress();
}

const syncUp = async (req, res) => {
    // somehow req.token is available though sent from body
    const userId = await getUserIdFromToken(res, req.token);
    if (userId) {
        const syncId = await getSyncId(userId);
        const dataToSync = req.body.bundledData;
        let syncErr = false;

        if (typeof dataToSync.addresses !== "undefined") {
            syncErr = await insertAddresses(userId, syncId, dataToSync.addresses);
        }

        if (!syncErr && typeof dataToSync.tags !== "undefined") {
            syncErr = await insertTags(userId, syncId, dataToSync.tags);
        }

        if (!syncErr && typeof dataToSync.ownerInfo !== "undefined") {
            syncErr = await insertOwnerInfos(userId, syncId, dataToSync.ownerInfo); // mixed singular/plural not great, same with client side sync.js
        }

        if (!syncErr && typeof dataToSync.tagInfo !== "undefined") {
            syncErr = await insertTagInfos(userId, syncId, dataToSync.tagInfo);
        }

        if (!syncErr && typeof dataToSync.events !== "undefined") {
            syncErr = await insertEvents(userId, syncId, dataToSync.events);
        }

        if (!syncErr && typeof dataToSync.deletedAddresses !== "undefined") {
            syncErr = await deleteAddresses(userId, syncId, dataToSync.addresses);
        }

        if (syncErr) {
            res.status(400).send('Sync failed');
        } else {
            res.status(200).send('Sync successful');
        }
    } else {
        res.status(403);
    }
}

module.exports = {
    syncUp
}