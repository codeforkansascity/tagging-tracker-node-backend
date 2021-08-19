require('dotenv').config();
const { getUserIdFromToken } = require('./../users/userFunctions');
const { pool } = require('./../../utils/db/dbConnect');
const { uploadToS3 } = require('./../../utils/s3/uploadTag');
const { getDateTime } = require('./../../utils/datetime/functions');
const { makeRandomStr } = require('./../misc/stringGenerator');

// import s3 stuff from module later
const AWS = require('aws-sdk');
const bucketName = process.env.AWS_S3_NAME;
AWS.config.update({
    region: process.env.AWS_S3_REGION,
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

const maxFileSize = 16_000_000;

// TODO: add resize image option for thumbnail jimp is possibilty
// BLOB has max size of 64KB
const addImageToDatabase = async (userId, imageData, imagePublicS3Url) => {
    const imgCopy = imageData;
    imgCopy.eventId = 999999999; // this is a lazy fix, since some of these columns aren't even needed, upload isn't the same as sync
    imgCopy.datetime = getDateTime();
    return new Promise(resolve => {
        // turn image into binary from base64
        const buff = new Buffer.from(imageData.src, 'base64');
        const thumbnailBuff = '';
        const syncId = 999999999;
        // thumbnail_src not supplied here since sync/save to device does the canvas rescale(client side)
        pool.query(
            `INSERT INTO tags SET user_id = ?, file_name = ?, address_id = ?, event_id = ?, src = ?, thumbnail_src = ?,  public_s3_url= ?, meta = ?, date_time = ?, sync_id = ?`, // ehh date_time
            [userId,  imageData.fileName, imageData.addressId, imgCopy.eventId, buff, thumbnailBuff, imagePublicS3Url, JSON.stringify(imageData.meta), imgCopy.datetime, syncId],
            (err, res) => {
                if (err) {
                    console.log(err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

const uploadTags = async (req, res) => {
    const imagesToUpload = req.body.images;

    // https://stackoverflow.com/questions/7511321/uploading-base64-encoded-image-to-amazon-s3-via-node-js
    if (imagesToUpload.length) {
        let uploadErr = false;

        for (let i = 0; i < imagesToUpload.length; i++) {
            if (uploadErr) {
                break;
            }

            const image = imagesToUpload[i];

            if (image.meta.size >= maxFileSize) {
                console.log(image.fileName + " was too large of an image to upload.");
                continue;
            }

            // considerable this is a waste if first insert attempt fails, but saves subsequent requests
            const userId = await getUserIdFromToken(res, req.body.headers.Authorization.split('Bearer ')[1]);
            if (!userId) {
                res.status(400).send('Failed to upload images, a'); // lol these debug lines
            }

            // plain Buffer is depricated/need to specify size in case secret info released
            // adding user id to filename, seems bad but need way to distinguish between files as it will overwrite/not save
            // if matching file names(Key)
            const buf = new Buffer.from(image.src.replace(/^data:image\/\w+;base64,/, ""), 'base64');
            const uploadParams = {
                Bucket: bucketName,
                Key: userId + '_' + makeRandomStr(24) + '_' + image.fileName, // this could be bad since there can be spaces in file names
                Body: buf,
                ACL: 'public-read',
                ContentEncoding: 'base64',
                ContentType: 'image/jpeg'
            };

            const dataLocation = await uploadToS3(s3, uploadParams);

            if (dataLocation) {
                const addedToDatabase = await addImageToDatabase(userId, imagesToUpload[i], dataLocation);
                if (!addedToDatabase) {
                    uploadErr = true;
                    res.status(400).send('Failed to upload images, b');
                    return;
                }

                if (i === imagesToUpload.length - 1) {
                    res.status(200).send('Upload completed');
                    return;
                }
            } else {
                uploadErr = true;
                res.status(400).send('Failed to upload images, c');
                return;
            }
        }
    }
}

module.exports = {
    uploadTags
}