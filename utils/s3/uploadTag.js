const uploadToS3 = async (s3, uploadParams) => {
    return new Promise(resolve => {
        s3.upload(uploadParams, (err, data) => {
            if (err) {
                console.log("Upload to s3 err" + err);
                resolve(false);
            } if (data) {
                resolve(data.Location);
            }
        });
    });
}

module.exports = {
    uploadToS3
}