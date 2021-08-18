require('dotenv').config();
const jwt = require('jsonwebtoken');
const { getDateTime } = require('./../datetime/functions');
const { pool } = require('./../../utils/db/dbConnect');

const addAddress = (req, res) => {
    if (typeof req.body.address === "undefined") {
        res.status(400).send('missing address string');
    } else {
        const addressStr = req.body.address;

        // check if doesn't exist
        const addressIsNew = pool.query(
            `SELECT address FROM addresses WHERE address = ?`,
            [addressStr],
            (err, qres) => {
                if (err) {
                    res.status(400).send('failed to add address');
                } else {
                    if (!qres.length || typeof qres[0].address === "undefined") {
                        return true;
                    }
                }
            }
        );

        if (addressIsNew) {
            // params for inserting address
            const lat = 0.0; // not filling in now, no use for it yet eg. radius search
            const lng = 0.0;
            const curDate = new Date()
            const dateTimeNow = getDateTime();
            const created = dateTimeNow;
            const updated = dateTimeNow;

            // insert
            pool.query(
                `INSERT INTO addresses SET address = ?, lat = ?, lng = ?, created = ?, updated = ?`,
                [addressStr, lat, lng, created, updated],
                (err, qres) => {
                    if (err) {
                        res.status(400).send('failed to create address');
                    } else {
                        res.status(201).send('address created');
                    }
                }
            );
        }
    }
}

module.exports = {
    addAddress
};