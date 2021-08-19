require('dotenv').config();
const { pool } = require('./../../utils/db/dbConnect');

const getRecentAddresses = (req, res) => {
    pool.query(
        `SELECT id, address FROM addresses ORDER BY updated DESC LIMIT 10`,
        (err, qres) => {
            if (err) {
                res.status(400).send('failed to get recent addresses');
            } else {
                res.status(200).send(qres);
            }
        }
    );
}

module.exports = {
    getRecentAddresses
};
