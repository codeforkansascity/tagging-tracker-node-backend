require('dotenv').config()
const { getUserIdFromToken, getRecentSyncId } = require('../users/userFunctions');
const { pool } = require('./../../utils/db/dbConnect');
const { generateBase64FromBinaryBuffer } = require('./sync-utils');

const getAddressesFromRecentSync = (syncId) => {
    return new Promise(resolve => {
        pool.query(
            `SELECT address, lat, lng, created, updated FROM addresses WHERE sync_id = ? ORDER BY id`, // limit? no pagination in mind
            [syncId],
            (err, res) => {
                if (err) {
                    console.log('sync down get addresses', err);
                    resolve(false);
                } else {
                    if (res.length) {
                        resolve(res);
                    } else {
                        resolve(false);
                    }
                }
            }
        );
    });
}

const getEventsFromRecentSync = (syncId) => {
    return new Promise(resolve => {
        pool.query(
            `SELECT address_id, tag_info_id, tag_ids, datetime FROM events WHERE sync_id = ? ORDER BY id`,
            [syncId],
            (err, res) => {
                if (err) {
                    console.log('sync down get events', err);
                    resolve(false);
                } else {
                    if (res.length) {
                        // convert binary to base64
                        resolve(res.map((eventRow) => {
                            return {
                                address_id: eventRow.address_id,
                                tag_info_id: eventRow.tag_info_id,
                                tag_ids: eventRow.tag_ids,
                                date_time: eventRow.datetime
                            };
                        }));
                    } else {
                        resolve(false);
                    }
                }
            }
        );
    });
}

const getTagsFromRecentSync = (syncId) => {
    return new Promise(resolve => {
        pool.query(
            `SELECT file_name, address_id, event_id, thumbnail_src, public_s3_url, meta, date_time FROM tags WHERE sync_id = ? ORDER BY id`,
            [syncId],
            (err, res) => {
                if (err) {
                    console.log('sync down get tags', err);
                    resolve(false);
                } else {
                    if (res.length) {
                        // convert binary to base64
                        resolve(res.map((tagRow) => {
                            const tagMeta = JSON.parse(tagRow.meta);
                            return {
                                file_name: tagRow.file_name,
                                name: tagMeta.name,
                                address_id: tagRow.address_id,
                                event_id: tagRow.event_id,
                                // this has to match how it was saved i.e. in sync-up.js or uplaodTags.js
                                thumbnail_src: generateBase64FromBinaryBuffer(tagRow.thumbnail_src),
                                meta: tagRow.meta, // stringify client side
                                datetime: tagRow.date_time,
                                url: tagRow.public_s3_url,
                            };
                        }));
                    } else {
                        resolve(false);
                    }
                }
            }
        );
    });
}

const getOwnerInfoFromRecentSync = (syncId) => {
    return new Promise(resolve => {
        pool.query(
            `SELECT address_id, form_data FROM owner_info WHERE sync_id = ? ORDER BY id`,
            [syncId],
            (err, res) => {
                if (err) {
                    console.log('sync down get owner info', err);
                    resolve(false);
                } else {
                    if (res.length) {
                        resolve(res);
                    } else {
                        resolve(false);
                    }
                }
            }
        );
    });
}

const getTagInfoFromRecentSync = (syncId) => {
    return new Promise(resolve => {
        pool.query(
            `SELECT address_id, event_id, form_data FROM tag_info WHERE sync_id = ? ORDER BY id`,
            [syncId],
            (err, res) => {
                if (err) {
                    resolve(false);
                } else {
                    if (res.length) {
                        resolve(res);
                    } else {
                        resolve(false);
                    }
                }
            }
        );
    });
}

const bundleData = async (syncId) => {
    const bundledData = {};
    bundledData['addresses'] = await getAddressesFromRecentSync(syncId);
    bundledData['events'] = await getEventsFromRecentSync(syncId);
    bundledData['tags'] = await getTagsFromRecentSync(syncId);
    bundledData['ownerInfo'] = await getOwnerInfoFromRecentSync(syncId);
    bundledData['tagInfo'] = await getTagInfoFromRecentSync(syncId);
    return bundledData;
}

const syncDown = async (req, res) => {
    const userId = await getUserIdFromToken(res, req.token);
    const syncId = await getRecentSyncId(userId);
    if (!syncId) {
        res.status(200).send(false);
    } else {
        const bundledData = await bundleData(syncId);
        res.status(200).send(bundledData);
    }
}

module.exports = {
    syncDown,
    bundleData
}