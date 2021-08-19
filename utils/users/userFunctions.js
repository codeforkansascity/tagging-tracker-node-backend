require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool } = require('./../../utils/db/dbConnect');
const bcrypt = require('bcrypt');
const saltRounds = 15;
const { getDateTime } = require('./../../utils/datetime/functions');

// internal method currently, need middleware if public
const _createUser = (username, password) => {
    if (!username || !password) {
        return false;
    }

    // do check if username taken
    const userExists = pool.query(
        `SELECT username FROM users WHERE username = ?`,
        [username],
        (err, res) => {
            if (err) {
                console.log('failed to create user', err);
            } else {
                if (res.length && typeof res[0].username !== "undefined") {
                    console.log('failed to create user', err);
                    return false;
                }
            }
        }
    );

    bcrypt.genSalt(saltRounds, (err, salt) => {
        bcrypt.hash(password, salt, (err,hash) => {
            if (hash) {
                pool.query(
                    `INSERT INTO users SET username = ?, password_hash = ?, active = 1`,
                    [username, hash],
                    (err, res) => {
                        if (err) {
                            console.log('failed to create user', err);
                        } else {
                            console.log(`user created with ID: ${res.insertId}`);
                        }
                    }
                );
            }
            
            return false;
        });
    });
}

// internal method currently, need middleware if public
const _deleteUser = (userId) => {
    pool.query(
        `DELETE FROM users WHERE id = ?`,
        [userId],
        (err, res) => {
            if (err) {
                console.log('failed to delete user', err);
            } else {
                console.log('user deleted');
            }
        }
    );
}

const getUserIdFromToken = async (res, token) => {
    return new Promise(resolve => {
        if (token) {
            jwt.verify(token, process.env.JWT_SECRET_KEY, (err, authData) => {
                if (err) {
                    res.status(403).send('Forbidden');
                } else {
                    pool.query(
                        `SELECT id FROM users WHERE username = ?`,
                        [authData.username],
                        (err, res) => {
                            if (err) {
                                resolve(false);
                            } else {
                                if (res.length && typeof res[0].id !== "undefined") {
                                    resolve(res[0].id);
                                }
                            }
                        }
                    );
                }
            });
        } else {
            res.status(403).send('Forbidden');
        }
    });
}

// I suppose it is possible to steal a sync_id on accident eg. race condition but it doesn't really matter
// since it's just a unique reference
const getSyncId = async (userId) => {
    return new Promise(resolve => {
        pool.query(
            `INSERT INTO sync_history SET user_id = ?, sync_timestamp = ?`,
            [userId, getDateTime()], // no sync id on uploads
            (err, res) => {
                if (err) {
                    console.log('getSyncId', err);
                    resolve(false);
                } else {
                    resolve(res.insertId);
                }
            }
        );
    });
}

const getRecentSyncId = (userId) => {
    return new Promise(resolve => {
        pool.query(
            `SELECT id FROM sync_history WHERE user_id = ? ORDER BY sync_timestamp DESC LIMIT 1`,
            [userId],
            (err, res) => {
                if (err) {
                    console.log('select sync id', err);
                    resolve(false);
                } else {
                    if (res.length) {
                        resolve(res[0].id);
                    } else {
                        resolve(false);
                    }
                }
            }
        );
    });
}

module.exports = {
    getUserIdFromToken,
    getSyncId,
    getRecentSyncId
};